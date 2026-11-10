import { create } from "zustand"
import { findTool, ownerId, syncNeedsProfile, syncsHere } from "@/domain/catalog"
import { failureSuperseded, type SyncFailure, type SyncSummary } from "@/domain/sync"
import type { SyncSchedule } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import type { LastSync, SyncEvent } from "@/platform/sync-schemas"
import { markStale } from "@/shared/fresh"
import { listProfiles } from "@/shared/query"

export type SyncRun = {
  phase: "running" | "done" | "stopped" | "failed"
  startedAt: number
  endedAt: number | null
  stage: string | null
  /** From a tool that prints cli-core's progress lines; null from one that does not, whose bar stays indeterminate. */
  progress: { chats: number | null; chatsDone: number | null; fetched: number } | null
  stopping: boolean
  summary: SyncSummary | null
  failure: SyncFailure | null
}

type State = {
  /** By `syncKey`; a finished run stays until the owner dismisses it or syncs again. */
  runs: Record<string, SyncRun>
  /** By `syncKey`; missing while it is read. */
  last: Record<string, LastSync>
  /** By `syncKey`: the account's sync on a timer; missing while it is read, `null` when it could not be read. */
  schedules: Record<string, SyncSchedule | null>
  /** Profile names per tool, read for the Tools row's compact line; null when the tool has none. */
  profiles: Record<string, string[] | null>
  start(tool: string, profile: string | null): void
  stop(tool: string, profile: string | null): void
  dismiss(tool: string, profile: string | null): void
  loadLast(tool: string, profile: string | null): Promise<void>
  loadSchedule(tool: string, profile: string): Promise<void>
  /** `every` turns the timer on at that interval or changes it; null turns it off. Rejects with the tool's words. */
  setSchedule(tool: string, profile: string, every: string | null): Promise<void>
  /** Once per tool: its profiles, and the last sync when there is only one to show. */
  loadRow(tool: string): void
}

export const syncKey = (tool: string, profile: string | null) => `${tool}:${profile ?? ""}`

/** One read at a time across the page: each is a tool process, and the owner's computer is easily loaded. */
let queue: Promise<unknown> = Promise.resolve()
const queued = <T>(read: () => Promise<T>): Promise<T> => {
  const next = queue.then(read, read)
  queue = next.catch(() => {})
  return next
}

const rows = new Set<string>()
const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** A run of the same package and profile, or of memo's one lock, already going. */
export function blockedBy(runs: Record<string, SyncRun>, tool: string, profile: string | null): boolean {
  return Object.entries(runs).some(([key, run]) => {
    if (run.phase !== "running") return false
    const [other = "", otherProfile = ""] = key.split(":")
    if (ownerId(other) !== ownerId(tool)) return false
    const entry = findTool(tool)
    return !entry || !syncNeedsProfile(entry) || otherProfile === (profile ?? "")
  })
}

export const useSync = create<State>()((set, get) => {
  const patch = (key: string, change: Partial<SyncRun>) =>
    set((s) => {
      const run = s.runs[key]
      return run ? { runs: { ...s.runs, [key]: { ...run, ...change } } } : {}
    })

  // A failure from this window stays until a later run succeeds, here or on the account's timer.
  const settle = (key: string) =>
    set((s) => {
      const run = s.runs[key]
      if (run?.phase !== "failed") return {}
      const scheduled = s.schedules[key]
      const last = scheduled?.state === "on" ? scheduled.last : null
      if (!failureSuperseded(run.endedAt, s.last[key]?.at ?? null, last)) return {}
      const { [key]: _, ...runs } = s.runs
      return { runs }
    })

  const apply = (tool: string, profile: string | null, e: SyncEvent) => {
    const key = syncKey(tool, profile)
    const ended = { endedAt: Date.now(), stopping: false, stage: null }
    switch (e.event) {
      case "stage":
        return patch(key, { stage: e.stage })
      case "progress":
        return patch(key, { progress: { chats: e.chats, chatsDone: e.chatsDone, fetched: e.fetched } })
      case "done":
        patch(key, { ...ended, phase: "done", summary: e.summary })
        markStale()
        return void get().loadLast(tool, profile)
      case "stopped":
        return patch(key, { ...ended, phase: "stopped" })
      case "failed":
        return patch(key, {
          ...ended,
          phase: "failed",
          failure: {
            message: e.message,
            code: e.code,
            reason: e.reason,
            run: e.run,
            retryAfterMs: e.retryAfterMs ?? null,
          },
        })
    }
  }

  return {
    runs: {},
    last: {},
    schedules: {},
    profiles: {},
    start(tool, profile) {
      if (blockedBy(get().runs, tool, profile)) return
      const key = syncKey(tool, profile)
      const run: SyncRun = {
        phase: "running",
        startedAt: Date.now(),
        endedAt: null,
        stage: null,
        progress: null,
        stopping: false,
        summary: null,
        failure: null,
      }
      set((s) => ({ runs: { ...s.runs, [key]: run } }))
      const still = () => get().runs[key]?.startedAt === run.startedAt
      const running = () => still() && get().runs[key]?.phase === "running"
      platform
        .syncRun(tool, profile, (e) => still() && apply(tool, profile, e))
        .then(
          () => {
            if (running())
              apply(tool, profile, {
                event: "failed",
                // An empty message is the interface's cue to say the sync ended without a result.
                message: "",
                code: null,
                reason: null,
                run: null,
                retryAfterMs: null,
              })
          },
          (e) =>
            running() &&
            apply(tool, profile, {
              event: "failed",
              message: message(e),
              code: null,
              reason: null,
              run: null,
              retryAfterMs: null,
            }),
        )
    },
    stop(tool, profile) {
      const key = syncKey(tool, profile)
      const run = get().runs[key]
      if (run?.phase !== "running" || run.stopping) return
      patch(key, { stopping: true })
      platform.syncStop(tool, profile).catch((e) => patch(key, { stopping: false, stage: message(e) }))
    },
    dismiss(tool, profile) {
      const key = syncKey(tool, profile)
      if (get().runs[key]?.phase === "running") return
      set((s) => {
        const { [key]: _, ...runs } = s.runs
        return { runs }
      })
    },
    async loadLast(tool, profile) {
      const key = syncKey(tool, profile)
      try {
        const last = await queued(() => platform.syncLast(tool, profile))
        set((s) => ({ last: { ...s.last, [key]: last } }))
        settle(key)
      } catch {
        set((s) => ({ last: { ...s.last, [key]: { at: null, left: null, known: false } } }))
      }
    },
    async loadSchedule(tool, profile) {
      const key = syncKey(tool, profile)
      try {
        const schedule = await queued(() => platform.syncScheduleStatus(tool, profile))
        set((s) => ({ schedules: { ...s.schedules, [key]: schedule } }))
        settle(key)
      } catch {
        set((s) => ({ schedules: { ...s.schedules, [key]: null } }))
      }
    },
    async setSchedule(tool, profile, every) {
      const schedule = await platform.syncScheduleSet(tool, profile, every)
      set((s) => ({ schedules: { ...s.schedules, [syncKey(tool, profile)]: schedule } }))
    },
    loadRow(tool) {
      const entry = findTool(tool)
      if (!entry || !syncsHere(entry) || rows.has(tool)) return
      rows.add(tool)
      if (!syncNeedsProfile(entry)) {
        set((s) => ({ profiles: { ...s.profiles, [tool]: null } }))
        void get().loadLast(tool, null)
        return
      }
      queued(() => listProfiles(tool)).then(
        (list) => {
          const names = (list ?? []).map((p) => p.name)
          set((s) => ({ profiles: { ...s.profiles, [tool]: names } }))
          const [only] = names
          if (names.length === 1 && only) void get().loadLast(tool, only)
        },
        () => rows.delete(tool),
      )
    },
  }
})
