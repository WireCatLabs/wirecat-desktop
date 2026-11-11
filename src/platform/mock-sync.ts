import { findTool, ownerId, syncCommand } from "@/domain/catalog"
import { delay } from "./mock-delay"
import { recordFailedSync } from "./mock-runs"
import type { Background, BackgroundAction, BackgroundOutcome, LastSync, SyncEvent, SyncSummary } from "./sync-schemas"
import type { Platform } from "./types"

// Each tool's sync as Rust reports it: stages read from its notes, then the counts. `?sync=<tool>` starts that tool's
// sync for personal (`src/app/scenarios.ts`); `?sync-hold=<tool>` keeps it running; `?sync-fail=<tool>` ends it with
// another sync holding the profile; `?sync-timeout=<tool>` at the time limit; `?sync-limited=<tool>` when the service
// asks to wait 25 minutes (`?sync-limited=<tool>&wait=none` without saying how long); `?sync=never` has no profile synced
// yet. `?sync-recovered=<tool>` ends it with configuration_error (see mock-sync-schedule.ts).
// Background services: personal runs, any other profile is stopped with its unit written. `?service=<tool>` is that
// scenario for one tool; `?service=<tool>:stopped` (nothing runs, no unit), `:missing` (the service manager does not
// answer; "Run it for now" still works), `:fail` (another program holds the login), `:old` (the tool has no `server`
// command), `:offline` (running, never connected, as when the phone is offline).

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const MIN = 60_000
const [serviceTool, variant = "running"] = (params.get("service") ?? "").split(":")

const LAST: Record<string, { ago: number | null; left?: number }> = {
  "tg:personal": { ago: 12 * MIN },
  "tg:work": { ago: null },
  "max:personal": { ago: 3 * 24 * 60 * MIN },
  "zm:personal": { ago: 26 * 60 * MIN },
  "drive:personal": { ago: null, left: 340 },
  "memo:": { ago: 2 * 60 * MIN },
  "email:personal": { ago: 2 * 60 * MIN },
  "email:": { ago: 2 * 60 * MIN },
}
const finished: Record<string, number> = {}

const STAGES: Record<string, string[]> = {
  tg: ["Fetching messages", "Waiting for the service's rate limit", "Fetching messages"],
  max: ["Fetching messages", "Waiting for the service's rate limit", "Fetching messages"],
  memo: ["Reading mail", "Preparing search"],
  email: ["Reading mail"],
}

/** What memo 0.131.61 reports beside a sync while search rewriting is on (`?enrich=on|nokey`). */
function memoEnrichment(): SyncSummary["enrichment"] {
  const scenario = params.get("enrich")
  if (scenario === "on")
    return {
      status: "done",
      sent: 284,
      enriched: 284,
      failed: 0,
      left: 0,
      costUsd: 0.0141,
      reason: null,
      reasonId: null,
    }
  if (scenario === "nokey")
    return {
      status: "stopped",
      sent: 0,
      enriched: 0,
      failed: 0,
      left: 284,
      costUsd: 0,
      reason: "no openai key: set OPENAI_API_KEY, or the tool's own key; nothing was sent",
      reasonId: "enrichment.no-key",
    }
  return null
}

const DONE: Record<string, SyncEvent> = {
  tg: { event: "done", summary: { new: 1240, places: 3, failed: 0, left: 0, complete: true, enrichment: null } },
  max: { event: "done", summary: { new: 86, places: 2, failed: 1, left: 0, complete: false, enrichment: null } },
  zm: { event: "done", summary: { new: 2, places: 0, failed: 0, left: 0, complete: true, enrichment: null } },
  drive: { event: "done", summary: { new: 200, places: 0, failed: 0, left: 140, complete: false, enrichment: null } },
  memo: {
    event: "done",
    summary: { new: 37, places: 2, failed: 0, left: 0, complete: true, enrichment: memoEnrichment() },
  },
  email: { event: "done", summary: { new: 0, places: 0, failed: 0, left: 0, complete: true, enrichment: null } },
}

const asService = (id: string) => serviceTool === id
const serviceOff = new Set(["stopped", "missing", "fail", "old"])

function initialService(id: string, profile: string): Background {
  if (asService(id) && variant === "offline") return { state: "running", connected: false, startsAtLogin: true }
  if (asService(id) && serviceOff.has(variant))
    return { state: "stopped", unit: false, startsAtLogin: null, stoppedFor: null }
  if (id === "wa" && profile === "work" && !asService(id))
    return { state: "stopped", unit: true, startsAtLogin: true, stoppedFor: "authentication_error" }
  return profile === "personal"
    ? { state: "running", connected: true, startsAtLogin: true }
    : { state: "stopped", unit: true, startsAtLogin: true, stoppedFor: null }
}

function serviceFault(id: string, action: BackgroundAction): BackgroundOutcome["fault"] {
  if (!asService(id)) return null
  if (variant === "missing" && action === "keep")
    return {
      kind: "managerMissing",
      message: "systemctl --user enable wa-serve-personal.service failed: Failed to connect to bus",
    }
  if (variant === "fail" && (action === "keep" || action === "start"))
    return { kind: "loginInUse", message: "login in use by wa serve" }
  if (variant === "old") return { kind: "tooOld", message: "unknown command 'server'" }
  return null
}

function nextService(before: Background, action: BackgroundAction): Background {
  const unit = before.state === "unknown" ? null : before.state === "running" ? before.startsAtLogin : before.unit
  if (action === "stop") return { state: "stopped", unit, startsAtLogin: unit, stoppedFor: null }
  if (action === "uninstall") return { state: "stopped", unit: false, startsAtLogin: null, stoppedFor: null }
  const installed = action === "keep" ? true : unit
  return { state: "running", connected: true, startsAtLogin: installed ? true : null }
}

export function syncMock(): Pick<Platform, "syncRun" | "syncStop" | "syncLast" | "backgroundStatus" | "backgroundRun"> {
  const stops = new Map<string, () => void>()
  const services = new Map<string, Background>()
  const keyOf = (id: string, profile: string | null) => `${id}:${profile ?? ""}`
  return {
    async syncRun(id, profile, onEvent) {
      const key = keyOf(id, profile)
      let stopped = false
      stops.set(key, () => {
        stopped = true
      })
      const wait = async (ms: number) => {
        const until = Date.now() + ms
        while (!stopped && Date.now() < until) await delay(100)
        return stopped
      }
      const hold = params.get("sync-hold") === id
      // tg prints cli-core's progress lines; max, from an older cli-core, only its notes.
      const counts = id === "tg"
      let chatsDone = 0
      let fetched = 0
      if (counts) onEvent({ event: "progress", chats: 40, chatsDone, fetched })
      const stages = STAGES[id] ?? []
      for (let n = 0; hold || n < stages.length; n++) {
        const stage = stages[n % Math.max(1, stages.length)]
        if (stage) onEvent({ event: "stage", stage })
        if (await wait(1800)) break
        if (counts) {
          chatsDone = Math.min(39, chatsDone + 1 + (n % 3))
          fetched += 140 + n * 37
          onEvent({ event: "progress", chats: 40, chatsDone, fetched })
        }
      }
      if (!stopped && stages.length === 0 && (await wait(4000))) stopped = true
      stops.delete(key)
      if (stopped) return onEvent({ event: "stopped" })
      const entry = findTool(id)
      const command = entry ? syncCommand(entry) : "sync"
      if (params.get("sync-fail") === id) {
        const message = "another sync or knowledge operation holds this profile's lock; retry later"
        const code = "provider_unavailable"
        return onEvent({
          event: "failed",
          message,
          code,
          reason: "profile.locked",
          run: recordFailedSync(ownerId(id), { profile, command, code, message }),
          retryAfterMs: null,
        })
      }
      if (params.get("sync-recovered") === id) {
        const message = "store schema 56 is newer than this mail; update mail"
        const code = "configuration_error"
        return onEvent({
          event: "failed",
          message,
          code,
          reason: null,
          run: recordFailedSync(ownerId(id), { profile, command, code, message }),
          retryAfterMs: null,
        })
      }
      if (params.get("sync-signedout") === id) {
        const message = "the session may have expired; sign in again"
        const code = "authentication_error"
        return onEvent({
          event: "failed",
          message,
          code,
          reason: null,
          run: recordFailedSync(ownerId(id), { profile, command, code, message }),
          retryAfterMs: null,
        })
      }
      if (params.get("sync-keyring") === id) {
        const message = "no token for this profile, although it has logged in on this machine"
        const code = "provider_unavailable"
        return onEvent({
          event: "failed",
          message,
          code,
          reason: "credentials.unreachable",
          run: recordFailedSync(ownerId(id), { profile, command, code, message }),
          retryAfterMs: null,
        })
      }
      if (params.get("sync-limited") === id) {
        const message = "too many requests; wait"
        const code = "rate_limited"
        return onEvent({
          event: "failed",
          message,
          code,
          reason: "provider.rate-limited",
          run: recordFailedSync(ownerId(id), { profile, command, code, message }),
          retryAfterMs: params.get("wait") === "none" ? null : 25 * MIN,
        })
      }
      if (params.get("sync-timeout") === id) {
        return onEvent({
          event: "failed",
          message: "the command took longer than 2h",
          code: "timeout",
          reason: "command.timed-out",
          run: null,
          retryAfterMs: null,
        })
      }
      finished[key] = Date.now()
      onEvent(
        DONE[id] ?? {
          event: "done",
          summary: { new: 0, places: 0, failed: 0, left: 0, complete: true, enrichment: null },
        },
      )
    },
    async syncStop(id, profile) {
      stops.get(keyOf(id, profile))?.()
    },
    async backgroundStatus(id, profile): Promise<Background> {
      await delay(400)
      if (variant === "old" && serviceTool === id) return { state: "unknown" }
      return services.get(keyOf(id, profile)) ?? initialService(id, profile)
    },
    async backgroundRun(id, profile, action): Promise<BackgroundOutcome> {
      await delay(action === "stop" ? 700 : 1800)
      const key = keyOf(id, profile)
      const before = services.get(key) ?? initialService(id, profile)
      const fault = serviceFault(id, action)
      if (fault) return { state: before, fault }
      const next = nextService(before, action)
      services.set(key, next)
      return { state: next, fault: null }
    },
    async syncLast(id, profile): Promise<LastSync> {
      await delay(300)
      const key = keyOf(id, profile)
      const at = finished[key]
      if (at) return { at: new Date(at).toISOString(), left: id === "drive" ? 140 : null, known: true }
      const last = params.get("sync") === "never" ? undefined : LAST[key]
      return {
        at: last?.ago == null ? null : new Date(Date.now() - last.ago).toISOString(),
        left: last?.left ?? null,
        known: true,
      }
    },
  }
}
