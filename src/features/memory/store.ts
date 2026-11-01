import { create } from "zustand"
import { inTab, type Range, type Tab } from "@/domain/memory"
import { platform } from "@/platform/bridge"
import type { MemoryEntry, MemoryRead, MemorySource, SourceContext } from "@/platform/memory-schemas"

export type Context =
  | { state: "loading" }
  | { state: "ready"; context: SourceContext }
  | { state: "failed"; error: string }
export type Op = "confirm" | "discard" | "correct" | "forget"
export type Sources =
  | { state: "loading" }
  | { state: "ready"; sources: MemorySource[] }
  | { state: "failed"; error: string }

type MemoryState = {
  /** null until the first read answers. */
  read: MemoryRead | null
  entries: MemoryEntry[]
  error: string | null
  reading: boolean
  tab: Tab
  /** The owner picked a tab: a later read no longer chooses one for them. */
  tabChosen: boolean
  about: string
  by: string
  kind: string
  project: string
  range: Range
  /** Cited sources read back in place, by ref. */
  contexts: Record<string, Context>
  open: string | null
  /**
   * Rows that changed state while shown keep their place under the tab they were in (rule 9): a confirmed row turns
   * green where it is and leaves Review only when the owner changes the tab or reads again.
   */
  held: string[]
  /** Rows on their way out (forgotten): they fold away before they leave the list. */
  leaving: string[]
  /** Rows just written (a correction): they unfold into place. */
  arriving: string[]
  sources: Record<string, Sources>
  busy: Record<string, Op>
  failed: Record<string, string>
  correcting: string | null
  forgetting: string | null
  /** Findings the owner unticked, per batch: Approve creates the rest. */
  skipped: Record<string, string[]>
  load(): Promise<void>
  setTab(tab: Tab): void
  setAbout(about: string): void
  setBy(by: string): void
  setKind(kind: string): void
  setProject(project: string): void
  setRange(range: Range): void
  clearFilters(): void
  loadContext(ref: string): Promise<void>
  toggle(ref: string): void
  loadSources(ref: string): Promise<void>
  confirm(ref: string): Promise<void>
  discard(ref: string): Promise<void>
  correct(ref: string, text: string): Promise<boolean>
  forget(ref: string): Promise<void>
  startCorrect(ref: string | null): void
  askForget(ref: string | null): void
  skip(ref: string, finding: string, skipped: boolean): void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
const without = <T>(record: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = record
  return rest
}

export const LEAVE_MS = 320

export const useMemory = create<MemoryState>((set, get) => {
  let seq = 0

  const run = async <T>(ref: string, op: Op, f: () => Promise<T>): Promise<T | null> => {
    if (get().busy[ref]) return null
    set((s) => ({ busy: { ...s.busy, [ref]: op }, failed: without(s.failed, ref) }))
    try {
      return await f()
    } catch (e) {
      set((s) => ({ failed: { ...s.failed, [ref]: message(e) } }))
      return null
    } finally {
      set((s) => ({ busy: without(s.busy, ref) }))
    }
  }

  const replace = (entry: MemoryEntry) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.ref === entry.ref ? entry : e)),
      held: s.held.includes(entry.ref) ? s.held : [...s.held, entry.ref],
    }))

  return {
    read: null,
    entries: [],
    error: null,
    reading: false,
    tab: "review",
    tabChosen: false,
    about: "",
    by: "",
    kind: "",
    project: "",
    range: "any",
    contexts: {},
    open: null,
    held: [],
    leaving: [],
    arriving: [],
    sources: {},
    busy: {},
    failed: {},
    correcting: null,
    forgetting: null,
    skipped: {},

    async load() {
      const call = ++seq
      set({ reading: true, error: null })
      try {
        const read = await platform.memoryRead()
        if (call !== seq) return
        const entries = read.kind === "ready" ? read.entries : []
        const tab = get().tabChosen
          ? get().tab
          : entries.some((e) => inTab("review", e.status)) || entries.length === 0
            ? "review"
            : "inuse"
        set({ read, entries, tab, reading: false, held: [], arriving: [], sources: {}, failed: {}, skipped: {} })
      } catch (e) {
        if (call !== seq) return
        set({ error: message(e), reading: false })
      }
    },
    setTab: (tab) => set({ tab, tabChosen: true, held: [], arriving: [] }),
    setAbout: (about) => set({ about }),
    setBy: (by) => set({ by }),
    setKind: (kind) => set({ kind }),
    setProject: (project) => set({ project }),
    setRange: (range) => set({ range }),
    clearFilters: () => set({ about: "", by: "", kind: "", project: "", range: "any" }),
    async loadContext(ref) {
      const had = get().contexts[ref]
      if (had && had.state !== "failed") return
      set((s) => ({ contexts: { ...s.contexts, [ref]: { state: "loading" } } }))
      try {
        const context = await platform.memorySourceContext(ref)
        set((s) => ({ contexts: { ...s.contexts, [ref]: { state: "ready", context } } }))
      } catch (e) {
        set((s) => ({ contexts: { ...s.contexts, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    toggle(ref) {
      const opening = get().open !== ref
      set((s) => ({ open: opening ? ref : null, correcting: s.correcting === ref ? null : s.correcting }))
      if (opening && !get().sources[ref]) get().loadSources(ref)
    },
    async loadSources(ref) {
      const entry = get().entries.find((e) => e.ref === ref)
      // A plain action cites nothing; a findings batch's sources come with it from memo.
      if (!entry || (entry.type === "action" && !entry.findings)) return
      set((s) => ({ sources: { ...s.sources, [ref]: { state: "loading" } } }))
      try {
        const sources = await platform.memorySources(ref)
        set((s) => ({ sources: { ...s.sources, [ref]: { state: "ready", sources } } }))
      } catch (e) {
        set((s) => ({ sources: { ...s.sources, [ref]: { state: "failed", error: message(e) } } }))
      }
    },
    async confirm(ref) {
      const findings = get().entries.find((e) => e.ref === ref)?.findings
      // Approve on a closed row takes every finding; picking happens in the opened row.
      const skipped = get().open === ref ? (get().skipped[ref] ?? []) : []
      const accept = findings ? findings.map((f) => f.id).filter((id) => !skipped.includes(id)) : undefined
      const entry = await run(ref, "confirm", () => platform.memoryConfirm(ref, accept))
      if (entry) replace(entry)
    },
    async discard(ref) {
      const entry = await run(ref, "discard", () => platform.memoryDiscard(ref))
      if (entry) replace(entry)
    },
    async correct(ref, text) {
      const added = await run(ref, "correct", () => platform.memoryCorrect(ref, text))
      if (!added) return false
      set((s) => ({
        // memo marks the old record superseded; the page says so without reading everything again.
        entries: [added, ...s.entries.map((e) => (e.ref === ref ? { ...e, status: "superseded" } : e))],
        held: [...s.held, ref, added.ref],
        arriving: [...s.arriving, added.ref],
        correcting: null,
      }))
      return true
    },
    async forget(ref) {
      set({ forgetting: null })
      const done = await run(ref, "forget", () => platform.memoryForget(ref))
      if (!done) return
      set((s) => ({ leaving: [...s.leaving, ref], open: s.open === ref ? null : s.open }))
      setTimeout(
        () =>
          set((s) => ({
            entries: s.entries.filter((e) => e.ref !== ref),
            leaving: s.leaving.filter((r) => r !== ref),
            sources: without(s.sources, ref),
          })),
        LEAVE_MS,
      )
    },
    startCorrect: (ref) => set((s) => ({ correcting: ref, failed: ref ? without(s.failed, ref) : s.failed })),
    askForget: (ref) => set({ forgetting: ref }),
    skip: (ref, finding, skipped) =>
      set((s) => {
        const now = (s.skipped[ref] ?? []).filter((id) => id !== finding)
        return { skipped: { ...s.skipped, [ref]: skipped ? [...now, finding] : now } }
      }),
  }
})
