import { useMemo } from "react"
import { create } from "zustand"
import { closedRanges, closedTerm, createdTerm, type Period, sumRows, todayIn } from "@/domain/analytics"
import type { Run } from "@/domain/runs"
import { useLogs } from "@/features/logs"
import { useMemory } from "@/features/memory"
import { useTasks } from "@/features/tasks"
import type {
  Aggregate,
  AnalyticsPreview,
  Ask,
  CountBy,
  CountRow,
  MessageCounts,
  Only,
  Which,
} from "@/platform/analytics-schemas"
import type { StoreInfo, TableList } from "@/platform/archive-schemas"
import { platform } from "@/platform/bridge"
import type { MemoryRead } from "@/platform/memory-schemas"
import type { Project, TaskCounts } from "@/platform/task-schemas"
import { fresh } from "@/shared/fresh"
import { listProfiles, queryClient } from "@/shared/query"
import { useTools } from "@/shared/tools-store"
import { analyticsKeys, earlierAnswer, installed, limiter, useAggregateQuery, useExtraQueries } from "./api"
import { failure, holdsNothing, type Problem } from "./problems"

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
      failed: { profile: string; message: string; code: string | null }[]
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
  created: TaskCounts
  /** Closed tasks per bar, oldest first; empty for all time. */
  bars: { key: string; count: number }[]
}

/** A count beyond the page's own three (day, sender, chat): an hour, a kind of message, the period before. */
/** `period` fixes the window for a card that does not follow the page's period (the week summary). */
export type Spec = {
  by: CountBy
  only: Only
  previous: boolean
  period?: Period
  range?: { from: string; to: string | null } | undefined
  full?: boolean | undefined
}
/** Every messenger has said which profiles it has, or that it is not installed. */
const profilesKnown = (s: Pick<State, "profilesOf" | "sources">) =>
  MESSENGERS.every((x) => s.profilesOf[x.id] !== undefined || s.sources[x.id]?.state === "missing")

/** One aggregate of one tool: `missing` when the tool is not installed. */
export type AggState =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "ready"; parts: { profile: string | null; answer: Aggregate }[]; signedOut?: string[] }

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
  /** When the page last read; it opens again within a minute without reading. */
  readAt: number | null
  /** Names on screen, or initials; the owner's choice for screen sharing, kept for the session. */
  hideNames: boolean
  /** Each tool's signed-in profiles, as listed when the page loaded: a profile never signed in has nothing to read. */
  profilesOf: Record<string, string[]>
  /** Each tool's profiles that were never signed in, said on the page with a sign-in button. */
  signedOut: Record<string, string[]>
  /** Messenger ids and profile names to show; empty is every one. */
  onlySources: string[]
  onlyProfiles: string[]
  load(): void
  /** Reads everything again now, as after a sign-in or a failed tool's "Try again". */
  reload(): void
  setPeriod(period: Period): void
  setHideNames(hide: boolean): void
  setOnlySources(ids: string[]): void
  setOnlyProfiles(names: string[]): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** A profile the tool says was never signed in is not asked: its answer would only be "nothing recorded". */
const split = (list: readonly { name: string; signedIn: boolean | null }[]) => ({
  profiles: list.filter((p) => p.signedIn !== false).map((p) => p.name),
  signedOut: list.filter((p) => p.signedIn === false).map((p) => p.name),
})

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"

const BYS: readonly CountBy[] = ["day", "sender", "chat"]
/** The tools that sync data into the store, in the order the page lists them. */
const SYNCED = ["tg", "max", "wa", "email", "zm", "drive", "memo"]

/** Adds a messenger's profiles up; a profile that failed is named, the others still count. */
export function combine(answers: { profile: string; by: CountBy; answer: MessageCounts }[]): SourceCounts {
  const profiles = [...new Set(answers.map((a) => a.profile))]
  if (profiles.length === 0) return { state: "noProfiles" }
  const ready = answers.filter((a) => a.answer.kind === "ready")
  const old = answers.find((a) => a.answer.kind === "old")
  if (ready.length === 0 && old?.answer.kind === "old") return { state: "old", message: old.answer.message }
  const failed: { profile: string; message: string; code: string | null }[] = []
  for (const a of answers) {
    if (a.answer.kind === "ready" || failed.some((f) => f.profile === a.profile)) continue
    failed.push({
      profile: a.profile,
      message: a.answer.message,
      code: a.answer.kind === "failed" ? a.answer.code : null,
    })
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
  /** Each profile that did not answer, so a card never reads its silence as "no messages". */
  problems: Problem[]
  loading: boolean
  stale: boolean
  /** A copy could not tell a group's size, so `close` counted only its private chats. */
  privateOnly: boolean
} {
  const current = useAnalytics((s) => s.period)
  const period = spec.period ?? current
  const zone = useAnalytics((s) => s.zone)
  const profilesOf = useAnalytics((s) => s.profilesOf)
  const ids = useAnalytics((s) => s.onlySources)
  const profiles = useAnalytics((s) => s.onlyProfiles)
  const known = useAnalytics(profilesKnown)
  const { by, only, previous, range, full } = spec
  const asking = useMemo(
    () => (known ? MESSENGERS.map((x) => x.id).filter((id) => profilesOf[id]?.length) : []),
    [known, profilesOf],
  )
  // The page's own load already asks for every day's messages of its period.
  const own = by === "day" && only === "all" && !previous && period === current && !range && !full
  const results = useExtraQueries(
    asking,
    { by, only, previous, ...(range ? { range } : {}), ...(full ? { full } : {}) },
    { period, zone, profilesOf },
    { enabled: enabled && !(previous && period === "all"), own },
  )
  return useMemo(() => {
    if (!enabled) return { bySource: {}, byProfile: {}, problems: [], loading: false, stale: false, privateOnly: false }
    const settled = asking.length > 0 && results.every((r) => r !== undefined)
    const earlier = settled ? [] : asking.map((id) => earlierAnswer(id, { by, only, previous, range, full }))
    const stale = !settled && asking.length > 0 && earlier.every((e) => e !== undefined)
    const use = stale ? earlier : results
    const bySource: Record<string, CountRow[]> = {}
    const byProfile: Record<string, CountRow[]> = {}
    const problems: Problem[] = []
    let privateOnly = false
    asking.forEach((id, n) => {
      const answers = use[n]
      if (!answers || (ids.length && !ids.includes(id))) return
      const chosen = answers.filter((a) => !profiles.length || profiles.includes(a.profile))
      const ready = chosen.filter((a) => !a.failed)
      if (ready.length) bySource[id] = sumRows(ready.map((a) => a.rows))
      privateOnly ||= ready.some((a) => a.privateOnly)
      for (const a of ready) byProfile[`${id}/${a.profile}`] = a.rows
      for (const a of chosen)
        if (a.failed && !holdsNothing(a.failed.code))
          problems.push(
            a.failed.old
              ? { kind: "old", tool: id, detail: a.failed.message }
              : failure(id, a.profile, a.failed.message),
          )
    })
    return { bySource, byProfile, problems, loading: !settled && !stale, stale, privateOnly }
  }, [enabled, asking, results, ids, profiles, by, only, previous, range, full])
}

/** One aggregate of one tool in the current period, its profiles narrowed to the owner's choice, asked for on first use. */
export function useAggregate(which: Which, id: string, enabled = true, fixed?: Period): AggState {
  const current = useAnalytics((s) => s.period)
  const period = fixed ?? current
  const zone = useAnalytics((s) => s.zone)
  const listed = useAnalytics((s) => s.profilesOf[id])
  const signedOut = useAnalytics((s) => s.signedOut[id])
  // Every profile is signed out: there is nothing to ask, only a sign-in to offer.
  const none = listed?.length === 0 && (signedOut?.length ?? 0) > 0
  const ids = useAnalytics((s) => s.onlySources)
  const profiles = useAnalytics((s) => s.onlyProfiles)
  const missing = useTools((s) => s.installs[id]?.length === 0)
  const query = useAggregateQuery(
    which,
    id,
    listed === undefined ? null : { period, zone, profiles: listed },
    enabled && !missing && !none,
  )
  const parts = query.data
  return useMemo(() => {
    if (!enabled) return { state: "loading" }
    if (missing) return { state: "missing" }
    if (none) return { state: "ready", parts: [], signedOut: signedOut ?? [] }
    if (parts === undefined) return { state: "loading" }
    const messenger = MESSENGERS.some((x) => x.id === id)
    if (messenger && ids.length && !ids.includes(id)) return { state: "ready", parts: [] }
    return {
      state: "ready",
      parts: parts.filter((p) => p.profile === null || !profiles.length || profiles.includes(p.profile)),
    }
  }, [enabled, missing, none, signedOut, parts, ids, profiles, id])
}

export const useAnalytics = create<State>((set, get) => {
  let round = 0

  const loadSource = async (id: string, period: Period, tz: string, mine: number, run: ReturnType<typeof limiter>) => {
    const ok = installed(id)
    if (ok === false) return set((s) => ({ sources: { ...s.sources, [id]: { state: "missing" } } }))
    const { profiles, signedOut } = split((await listProfiles(id).catch(() => null)) ?? [])
    set((s) => ({ profilesOf: { ...s.profilesOf, [id]: profiles }, signedOut: { ...s.signedOut, [id]: signedOut } }))
    const answers = await Promise.all(
      profiles.flatMap((profile) =>
        BYS.map(async (by) => {
          const ask: Ask = { period, by, only: "all", previous: false }
          const answer = await run(() => platform.messageStats(id, profile, ask, tz)).catch(
            (e): MessageCounts => ({ kind: "failed", message: message(e), code: null }),
          )
          return { profile, by, answer }
        }),
      ),
    )
    if (round !== mine) return
    const days = answers.flatMap((a) =>
      a.by === "day" && a.answer.kind === "ready" ? [{ profile: a.profile, rows: a.answer.rows }] : [],
    )
    const spec = { by: "day", only: "all", previous: false } as const
    queryClient().setQueryData(analyticsKeys.extra(id, spec, { period, zone: tz, profiles }), days)
    set((s) => ({ sources: { ...s.sources, [id]: combine(answers) } }))
  }

  const loadTasks = async (period: Period, today: string, mine: number, run: ReturnType<typeof limiter>) => {
    if (installed("memo") === false) return set({ tasks: { state: "missing" } })
    try {
      const [open, overdue, closed, created, bars] = await Promise.all([
        run(() => platform.taskCounts("")),
        run(() => platform.taskCounts("overdue:true")),
        run(() => platform.taskCounts(closedTerm(period))),
        run(() => platform.taskCounts(createdTerm(period))),
        Promise.all(
          closedRanges(period, today).map(async (r) => ({
            key: r.key,
            count: (await run(() => platform.taskCounts(r.query))).total,
          })),
        ),
      ])
      if (round === mine) set({ tasks: { state: "ready", data: { open, overdue, closed, created, bars } } })
    } catch (e) {
      if (round === mine) set({ tasks: { state: "error", error: message(e) } })
    }
  }

  const readSyncs = async () => {
    const ids = SYNCED.filter((id) => installed(id) !== false)
    const lists = await Promise.all(
      ids.map(async (id) => {
        const read = await listProfiles(id).catch(() => null)
        const listed = read?.map((p) => p.name) ?? null
        const { profiles: ready, signedOut } = split(read ?? [])
        set((s) => ({
          profilesOf: { ...s.profilesOf, [id]: s.profilesOf[id] ?? ready },
          signedOut: { ...s.signedOut, [id]: s.signedOut[id] ?? signedOut },
        }))
        const profiles = listed ?? [null]
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
    // What the Memory and Tasks pages read under a minute ago is what memo would answer again.
    const tasks = useTasks.getState()
    ;(fresh(tasks.projectsAt) ? Promise.resolve(tasks.projects) : platform.projectList())
      .then((projects) => set({ projects }))
      .catch(() => undefined)
    const memory = useMemory.getState()
    ;(fresh(memory.readAt) && memory.read && memory.memoPage === 1
      ? Promise.resolve(memory.read)
      : platform.memoryRead()
    )
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
    readAt: null,
    hideNames: false,
    onlySources: [],
    onlyProfiles: [],
    profilesOf: {},
    signedOut: {},
    load() {
      if (fresh(get().readAt)) return
      // A later visit keeps the numbers on screen until each new one arrives.
      set({ today: todayIn(get().zone), readAt: Date.now() })
      void queryClient().invalidateQueries({ queryKey: analyticsKeys.all })
      loadOnce()
      loadPeriod()
    },
    reload() {
      set({ readAt: null })
      get().load()
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
