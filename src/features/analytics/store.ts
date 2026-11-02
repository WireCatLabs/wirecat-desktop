import { useEffect, useMemo } from "react"
import { create } from "zustand"
import { closedRanges, closedTerm, type Period, sumRows, todayIn } from "@/domain/analytics"
import type { Run } from "@/domain/runs"
import type { AnalyticsPreview, Ask, CountBy, CountRow, MessageCounts, Only } from "@/platform/analytics-schemas"
import type { StoreInfo, TableList } from "@/platform/archive-schemas"
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

/** A count beyond the page's own three (day, sender, chat): an hour, a kind of message, the period before. */
export type Spec = { by: CountBy; only: Only; previous: boolean }
/** One messenger's answers to a spec, per profile; a profile that failed or is too old has none. */
export type Extra = { state: "loading" } | { state: "ready"; answers: { profile: string; rows: CountRow[] }[] }

/** Every messenger has said which profiles it has, or that it is not installed. */
const profilesKnown = (s: Pick<State, "profilesOf" | "sources">) =>
  MESSENGERS.every((x) => s.profilesOf[x.id] !== undefined || s.sources[x.id]?.state === "missing")

const specKey = (period: Period, spec: Spec) => `${period}|${spec.by}|${spec.only}|${spec.previous ? 1 : 0}`

type State = {
  period: Period
  zone: string
  today: string
  volume: Loaded<StoreInfo | null>
  sources: Record<string, SourceCounts>
  tasks: Loaded<TaskNumbers> | { state: "missing" }
  memory: Loaded<MemoryRead>
  runs: Loaded<Run[]>
  /** The store's tables with their rows: transcripts and links are counted from them. */
  tables: TableList | null | undefined
  /** When each installed tool's profile last synced, as the tool itself says. */
  syncs: Loaded<{ id: string; profile: string | null; at: string | null; known: boolean }[]>
  /** memo's projects, to match a memory's project ref to the key its tasks use. */
  projects: Project[]
  preview: AnalyticsPreview | null
  /** A new period is being read; the charts keep the last one, dimmed, until it arrives. */
  refreshing: boolean
  /** Names on screen, or initials; the owner's choice for screen sharing, kept for the session. */
  hideNames: boolean
  /** Each messenger's profiles, as listed when the page loaded. */
  profilesOf: Record<string, string[]>
  /** Extra counts by `specKey`, then messenger id; kept for the session, so a period seen once comes back at once. */
  extra: Record<string, Record<string, Extra>>
  /** Asks for a spec in the current period unless it was asked already. */
  need(spec: Spec): void
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
/** The tools that sync data into the store, in the order the page lists them. */
const SYNCED = ["tg", "max", "wa", "zm", "drive", "memo"]

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

/**
 * One spec's rows per messenger, after the owner's filters: every chosen profile added up. `stale` while the current
 * period is still being read: the rows are then the last period's that had them, so the chart keeps its frame.
 */
export function useExtra(
  spec: Spec,
  enabled = true,
): {
  bySource: Record<string, CountRow[]>
  /** Keyed `tg/personal`, for a chart split by profile. */
  byProfile: Record<string, CountRow[]>
  loading: boolean
  stale: boolean
} {
  const period = useAnalytics((s) => s.period)
  const extra = useAnalytics((s) => s.extra)
  const ids = useAnalytics((s) => s.onlySources)
  const profiles = useAnalytics((s) => s.onlyProfiles)
  const known = useAnalytics(profilesKnown)
  const { by, only, previous } = spec
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new period, or the profiles becoming known, asks again
  useEffect(() => {
    if (enabled) useAnalytics.getState().need({ by, only, previous })
  }, [enabled, by, only, previous, period, known])
  return useMemo(() => {
    if (!enabled) return { bySource: {}, byProfile: {}, loading: false, stale: false }
    const now = extra[specKey(period, { by, only, previous })]
    const settled = (set: Record<string, Extra> | undefined) =>
      set !== undefined && Object.values(set).every((e) => e.state === "ready")
    const fallback = Object.entries(extra).find(
      ([k, set]) => k.endsWith(`|${by}|${only}|${previous ? 1 : 0}`) && settled(set),
    )?.[1]
    const use = settled(now) ? now : (fallback ?? now)
    const bySource: Record<string, CountRow[]> = {}
    const byProfile: Record<string, CountRow[]> = {}
    for (const [id, e] of Object.entries(use ?? {})) {
      if (ids.length && !ids.includes(id)) continue
      if (e.state !== "ready") continue
      const chosen = e.answers.filter((a) => !profiles.length || profiles.includes(a.profile))
      bySource[id] = sumRows(chosen.map((a) => a.rows))
      for (const a of chosen) byProfile[`${id}/${a.profile}`] = a.rows
    }
    return { bySource, byProfile, loading: !settled(now) && use === now, stale: !settled(now) && use !== now }
  }, [enabled, extra, period, by, only, previous, ids, profiles])
}

export const useAnalytics = create<State>((set, get) => {
  let round = 0
  const extraRun = limiter(3)

  const installed = (id: string) => {
    const installs = useTools.getState().installs[id]
    return installs === undefined ? null : installs.length > 0
  }

  const loadSource = async (id: string, period: Period, tz: string, mine: number, run: ReturnType<typeof limiter>) => {
    const ok = installed(id)
    if (ok === false) return set((s) => ({ sources: { ...s.sources, [id]: { state: "missing" } } }))
    const profiles = ((await platform.listProfiles(id).catch(() => null)) ?? []).map((p) => p.name)
    set((s) => ({ profilesOf: { ...s.profilesOf, [id]: profiles } }))
    const answers = await Promise.all(
      profiles.flatMap((profile) =>
        BYS.map(async (by) => {
          const ask: Ask = { period, by, only: "all", previous: false }
          const answer = await run(() => platform.messageStats(id, profile, ask, tz)).catch(
            (e): MessageCounts => ({ kind: "failed", message: message(e) }),
          )
          return { profile, by, answer }
        }),
      ),
    )
    if (round !== mine) return
    const days = answers.flatMap((a) =>
      a.by === "day" && a.answer.kind === "ready" ? [{ profile: a.profile, rows: a.answer.rows }] : [],
    )
    const key = specKey(period, { by: "day", only: "all", previous: false })
    set((s) => ({
      sources: { ...s.sources, [id]: combine(answers) },
      extra: { ...s.extra, [key]: { ...s.extra[key], [id]: { state: "ready", answers: days } } },
    }))
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

  const readSyncs = async () => {
    const ids = SYNCED.filter((id) => installed(id) !== false)
    const lists = await Promise.all(
      ids.map(async (id) => {
        const profiles = (await platform.listProfiles(id).catch(() => null))?.map((p) => p.name) ?? [null]
        return Promise.all(
          (profiles.length ? profiles : [null]).map(async (profile) => {
            const last = await platform.syncLast(id, profile).catch(() => ({ at: null, known: false }))
            return { id, profile, at: last.at, known: last.known }
          }),
        )
      }),
    )
    return lists.flat()
  }

  const loadOnce = () => {
    platform
      .storeInfo()
      .then((data) => set({ volume: { state: "ready", data } }))
      .catch((e) => set({ volume: { state: "error", error: message(e) } }))
    platform
      .storeTables(false)
      .then((tables) => set({ tables }))
      .catch(() => set({ tables: null }))
    void readSyncs()
      .then((data) => set({ syncs: { state: "ready", data } }))
      .catch((e) => set({ syncs: { state: "error", error: message(e) } }))
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
    tables: undefined,
    syncs: { state: "loading" },
    preview: null,
    refreshing: false,
    hideNames: false,
    onlySources: [],
    onlyProfiles: [],
    profilesOf: {},
    extra: {},
    need(spec) {
      const { period, zone: tz, profilesOf } = get()
      if ((spec.previous && period === "all") || !profilesKnown(get())) return
      // The page's own load already asks for every day's messages.
      if (spec.by === "day" && spec.only === "all" && !spec.previous) return
      const key = specKey(period, spec)
      if (get().extra[key]) return
      const ids = MESSENGERS.map((x) => x.id).filter((id) => profilesOf[id]?.length)
      if (!ids.length) return
      set((s) => ({
        extra: { ...s.extra, [key]: Object.fromEntries(ids.map((id) => [id, { state: "loading" } as Extra])) },
      }))
      for (const id of ids) {
        const profiles = profilesOf[id] ?? []
        void Promise.all(
          profiles.map(async (profile) => {
            const answer = await extraRun(() => platform.messageStats(id, profile, { period, ...spec }, tz)).catch(
              (): MessageCounts => ({ kind: "failed", message: "" }),
            )
            return answer.kind === "ready" ? [{ profile, rows: answer.rows }] : []
          }),
        ).then((parts) =>
          set((s) => ({
            extra: { ...s.extra, [key]: { ...s.extra[key], [id]: { state: "ready", answers: parts.flat() } } },
          })),
        )
      }
    },
    load() {
      set({
        today: todayIn(get().zone),
        volume: { state: "loading" },
        sources: loadingSources(),
        tasks: { state: "loading" },
        memory: { state: "loading" },
        runs: { state: "loading" },
        extra: {},
        tables: undefined,
        syncs: { state: "loading" },
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
