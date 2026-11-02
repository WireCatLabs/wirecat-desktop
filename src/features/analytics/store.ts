import { useMemo } from "react"
import { create } from "zustand"
import { closedRanges, closedTerm, type Period, sumRows, todayIn } from "@/domain/analytics"
import type { Run } from "@/domain/runs"
import type { AnalyticsPreview, CountBy, CountRow, MessageCounts } from "@/platform/analytics-schemas"
import type { StoreInfo } from "@/platform/archive-schemas"
import { platform } from "@/platform/bridge"
import type { MemoryRead } from "@/platform/memory-schemas"
import type { Project, TaskCounts } from "@/platform/task-schemas"
import { useLogs } from "../logs/store"
import { useTools } from "../tools/store"

/** The messengers that count their own messages, and the source each writes into storage. */
export const MESSENGERS = [
  { id: "tg", provider: "telegram" },
  { id: "max", provider: "max" },
  { id: "wa", provider: "whatsapp" },
] as const

/**
 * One messenger's counts, every profile added up. `old`: no profile's copy has `stats messages show`; `failed` keeps
 * the profiles that did answer and the first failure's words.
 */
export type SourceCounts =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "noProfiles" }
  | { state: "old"; message: string }
  | {
      state: "ready"
      profiles: string[]
      failed: { profile: string; message: string }[]
      days: { key: string; count: number }[]
      senders: CountRow[]
      chats: CountRow[]
      /** A profile's list was cut at the tool's limit. */
      more: boolean
      /** Each profile's own answers, so a profile filter can add up fewer of them without asking again. */
      answers: { profile: string; by: CountBy; rows: CountRow[]; more: boolean }[]
    }

export type Loaded<T> = { state: "loading" } | { state: "ready"; data: T } | { state: "error"; error: string }

export type TaskNumbers = {
  open: TaskCounts
  overdue: TaskCounts
  closed: TaskCounts
  /** Closed tasks per bar, oldest first; empty for all time. */
  bars: { key: string; count: number }[]
}

type State = {
  period: Period
  zone: string
  today: string
  volume: Loaded<StoreInfo | null>
  sources: Record<string, SourceCounts>
  tasks: Loaded<TaskNumbers> | { state: "missing" }
  memory: Loaded<MemoryRead>
  runs: Loaded<Run[]>
  /** memo's projects, to match a memory's project ref to the key its tasks use. */
  projects: Project[]
  preview: AnalyticsPreview | null
  /** A new period is being read; the charts keep the last one, dimmed, until it arrives. */
  refreshing: boolean
  /** Names on screen, or initials; the owner's choice for screen sharing, kept for the session. */
  hideNames: boolean
  /** Messenger ids and profile names to show; empty is every one. */
  onlySources: string[]
  onlyProfiles: string[]
  load(): void
  setPeriod(period: Period): void
  setHideNames(hide: boolean): void
  setOnlySources(ids: string[]): void
  setOnlyProfiles(names: string[]): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

/** At most `n` tool processes at once: every one is a Node.js start, and the page asks a dozen. */
function limiter(n: number) {
  let running = 0
  const waiting: (() => void)[] = []
  return async <T>(job: () => Promise<T>): Promise<T> => {
    if (running >= n) await new Promise<void>((go) => waiting.push(go))
    running += 1
    try {
      return await job()
    } finally {
      running -= 1
      waiting.shift()?.()
    }
  }
}

const BYS: readonly CountBy[] = ["day", "sender", "chat"]

/** Adds a messenger's profiles up; a profile that failed is named, the others still count. */
export function combine(answers: { profile: string; by: CountBy; answer: MessageCounts }[]): SourceCounts {
  const profiles = [...new Set(answers.map((a) => a.profile))]
  if (profiles.length === 0) return { state: "noProfiles" }
  const ready = answers.filter((a) => a.answer.kind === "ready")
  const old = answers.find((a) => a.answer.kind === "old")
  if (ready.length === 0 && old?.answer.kind === "old") return { state: "old", message: old.answer.message }
  const failed: { profile: string; message: string }[] = []
  for (const a of answers) {
    if (a.answer.kind === "ready" || failed.some((f) => f.profile === a.profile)) continue
    failed.push({ profile: a.profile, message: a.answer.message })
  }
  const kept = ready.flatMap((a) =>
    a.answer.kind === "ready" ? [{ profile: a.profile, by: a.by, rows: a.answer.rows, more: a.answer.more }] : [],
  )
  return {
    state: "ready",
    profiles: profiles.filter((p) => !failed.some((f) => f.profile === p)),
    failed,
    ...sums(kept),
    answers: kept,
  }
}

function sums(answers: { by: CountBy; rows: CountRow[]; more: boolean }[]) {
  const rows = (by: CountBy) => sumRows(answers.filter((a) => a.by === by).map((a) => a.rows))
  return {
    days: rows("day"),
    senders: rows("sender").sort((a, b) => b.count - a.count),
    chats: rows("chat").sort((a, b) => b.count - a.count),
    more: answers.some((a) => a.more && a.by === "day"),
  }
}

/**
 * The messengers and profiles the owner chose to see; nothing chosen is all of them. A filtered-out messenger is left
 * out, so the others keep their colours and places.
 */
export function shown(
  sources: Readonly<Record<string, SourceCounts>>,
  ids: readonly string[],
  profiles: readonly string[],
): Record<string, SourceCounts> {
  const out: Record<string, SourceCounts> = {}
  for (const [id, s] of Object.entries(sources)) {
    if (ids.length && !ids.includes(id)) continue
    if (s.state !== "ready" || profiles.length === 0) {
      out[id] = s
      continue
    }
    const answers = s.answers.filter((a) => profiles.includes(a.profile))
    out[id] = {
      ...s,
      ...sums(answers),
      profiles: s.profiles.filter((p) => profiles.includes(p)),
      failed: s.failed.filter((f) => profiles.includes(f.profile)),
      answers,
    }
  }
  return out
}

const loadingSources = () => Object.fromEntries(MESSENGERS.map((m) => [m.id, { state: "loading" } as SourceCounts]))

/** The sources as the page shows them, after the owner's filters. */
export const useShownSources = () => {
  const sources = useAnalytics((s) => s.sources)
  const ids = useAnalytics((s) => s.onlySources)
  const profiles = useAnalytics((s) => s.onlyProfiles)
  return useMemo(() => shown(sources, ids, profiles), [sources, ids, profiles])
}

export const useAnalytics = create<State>((set, get) => {
  let round = 0

  const installed = (id: string) => {
    const installs = useTools.getState().installs[id]
    return installs === undefined ? null : installs.length > 0
  }

  const loadSource = async (id: string, period: Period, tz: string, mine: number, run: ReturnType<typeof limiter>) => {
    const ok = installed(id)
    if (ok === false) return set((s) => ({ sources: { ...s.sources, [id]: { state: "missing" } } }))
    const profiles = ((await platform.listProfiles(id).catch(() => null)) ?? []).map((p) => p.name)
    const answers = await Promise.all(
      profiles.flatMap((profile) =>
        BYS.map(async (by) => {
          const answer = await run(() => platform.messageStats(id, profile, period, by, tz)).catch(
            (e): MessageCounts => ({ kind: "failed", message: message(e) }),
          )
          return { profile, by, answer }
        }),
      ),
    )
    if (round !== mine) return
    set((s) => ({ sources: { ...s.sources, [id]: combine(answers) } }))
  }

  const loadTasks = async (period: Period, today: string, mine: number, run: ReturnType<typeof limiter>) => {
    if (installed("memo") === false) return set({ tasks: { state: "missing" } })
    try {
      const [open, overdue, closed, bars] = await Promise.all([
        run(() => platform.taskCounts("")),
        run(() => platform.taskCounts("overdue:true")),
        run(() => platform.taskCounts(closedTerm(period))),
        Promise.all(
          closedRanges(period, today).map(async (r) => ({
            key: r.key,
            count: (await run(() => platform.taskCounts(r.query))).total,
          })),
        ),
      ])
      if (round === mine) set({ tasks: { state: "ready", data: { open, overdue, closed, bars } } })
    } catch (e) {
      if (round === mine) set({ tasks: { state: "error", error: message(e) } })
    }
  }

  const loadOnce = () => {
    platform
      .storeInfo()
      .then((data) => set({ volume: { state: "ready", data } }))
      .catch((e) => set({ volume: { state: "error", error: message(e) } }))
    platform
      .projectList()
      .then((projects) => set({ projects }))
      .catch(() => undefined)
    platform
      .memoryRead()
      .then((data) => set({ memory: { state: "ready", data } }))
      .catch((e) => set({ memory: { state: "error", error: message(e) } }))
    const logs = useLogs.getState()
    ;(logs.loadedAt === null ? logs.load() : Promise.resolve())
      .then(() => {
        const runs = Object.values(useLogs.getState().sources).flatMap((s) => s.runs)
        set({ runs: { state: "ready", data: runs } })
      })
      .catch((e) => set({ runs: { state: "error", error: message(e) } }))
  }

  const loadPeriod = () => {
    round += 1
    const mine = round
    const { period, zone: tz, today } = get()
    const run = limiter(3)
    set({ refreshing: true })
    const jobs = [
      ...MESSENGERS.map((m) => loadSource(m.id, period, tz, mine, run)),
      loadTasks(period, today, mine, run),
      platform
        .analyticsPreview(period)
        .then((preview) => round === mine && set({ preview }))
        .catch(() => set({ preview: null })),
    ]
    void Promise.allSettled(jobs).then(() => round === mine && set({ refreshing: false }))
  }

  return {
    period: "30d",
    zone: zone(),
    today: todayIn(zone()),
    volume: { state: "loading" },
    sources: loadingSources(),
    tasks: { state: "loading" },
    memory: { state: "loading" },
    runs: { state: "loading" },
    projects: [],
    preview: null,
    refreshing: false,
    hideNames: false,
    onlySources: [],
    onlyProfiles: [],
    load() {
      set({
        today: todayIn(get().zone),
        volume: { state: "loading" },
        sources: loadingSources(),
        tasks: { state: "loading" },
        memory: { state: "loading" },
        runs: { state: "loading" },
      })
      loadOnce()
      loadPeriod()
    },
    setPeriod(period) {
      if (period === get().period) return
      set({ period })
      loadPeriod()
    },
    setHideNames: (hideNames) => set({ hideNames }),
    setOnlySources: (onlySources) => set({ onlySources }),
    setOnlyProfiles: (onlyProfiles) => set({ onlyProfiles }),
  }
})
