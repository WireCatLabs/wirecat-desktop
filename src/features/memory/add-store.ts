import { create } from "zustand"
import { type Draft, emptyDraft, givenOf, untickedAtFirst, type Way } from "@/domain/memory-add"
import { platform } from "@/platform/bridge"
import type { AddedSource, Mentions, StoredSource } from "@/platform/memory-add-schemas"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { useMemory } from "./store"

export type Step = "source" | "saved" | "facts" | "done"
export const STEPS: Step[] = ["source", "saved", "facts", "done"]

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

type AddState = {
  open: boolean
  step: Step
  draft: Draft
  busy: "save" | "pick" | "suggest" | "keep" | null
  /** The last refusal, on the step that made it; a later step never loses what an earlier one saved. */
  error: string | null
  added: AddedSource | null
  mentions: { state: "loading" } | { state: "ready"; mentions: Mentions } | { state: "failed"; error: string } | null
  /** The text as memo stored it: the source opens here, not at a path that may be gone. */
  stored: { state: "loading" } | { state: "ready"; source: StoredSource } | { state: "failed"; error: string } | null
  /** Mentions the owner ticked: the suggested facts are about them. */
  subjects: string[]
  batch: MemoryEntry | null
  reused: boolean
  /** Findings the owner unticked; Keep creates the rest. */
  skipped: string[]
  /** What Keep created, by finding id; empty when the owner kept the source only. */
  kept: string[]
  openPanel(): void
  close(): void
  setWay(way: Way): void
  edit(patch: Partial<Omit<Draft, "way">>): void
  pickFile(): Promise<void>
  save(): Promise<void>
  loadText(): Promise<void>
  toggleSubject(ref: string): void
  suggest(reader: string, again?: boolean): Promise<void>
  skip(id: string, skipped: boolean): void
  keep(): Promise<void>
  /** Only save it: the source is kept, no reader is asked. */
  finish(): void
  another(): void
}

const fresh = {
  step: "source" as Step,
  draft: emptyDraft(),
  busy: null,
  error: null,
  added: null,
  mentions: null,
  stored: null,
  subjects: [],
  batch: null,
  reused: false,
  skipped: [],
  kept: [],
}

export const useAddSource = create<AddState>((set, get) => ({
  open: new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("add") === "open",
  ...fresh,
  openPanel: () => set({ open: true }),
  close: () => set({ open: false, ...(get().step === "done" ? fresh : {}) }),
  setWay: (way) => set((s) => ({ draft: { ...s.draft, way }, error: null })),
  edit: (patch) => set((s) => ({ draft: { ...s.draft, ...patch }, error: null })),
  async pickFile() {
    if (get().busy) return
    set({ busy: "pick", error: null })
    try {
      const path = await platform.memoryPickFile()
      if (path) set((s) => ({ draft: { ...s.draft, path } }))
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: null })
    }
  },
  async save() {
    const { draft, busy } = get()
    const given = givenOf(draft)
    if (!given || busy) return
    set({ busy: "save", error: null })
    try {
      const added = await platform.memorySourceAdd({ given, title: draft.title.trim() || null, subjects: [] })
      set({ added, step: "saved", mentions: { state: "loading" } })
      void loadMentions(added.ref)
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: null })
    }
  },
  async loadText() {
    const ref = get().added?.ref
    if (!ref || get().stored?.state === "ready") return
    set({ stored: { state: "loading" } })
    try {
      const source = await platform.memorySourceShow(ref)
      if (get().added?.ref === ref) set({ stored: { state: "ready", source } })
    } catch (e) {
      if (get().added?.ref === ref) set({ stored: { state: "failed", error: message(e) } })
    }
  },
  toggleSubject: (ref) =>
    set((s) => ({ subjects: s.subjects.includes(ref) ? s.subjects.filter((r) => r !== ref) : [...s.subjects, ref] })),
  async suggest(reader, again = false) {
    const { added, subjects, busy } = get()
    if (!added || busy) return
    set({ busy: "suggest", error: null })
    try {
      const { batch, reused } = await platform.memorySourceSuggest(added.ref, reader, subjects, again)
      set({ batch, reused, skipped: untickedAtFirst(batch.findings ?? []), step: "facts" })
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: null })
    }
  },
  skip: (id, skipped) =>
    set((s) => ({ skipped: skipped ? [...s.skipped.filter((x) => x !== id), id] : s.skipped.filter((x) => x !== id) })),
  async keep() {
    const { batch, skipped, busy } = get()
    if (!batch || busy) return
    const accept = (batch.findings ?? []).map((f) => f.id).filter((id) => !skipped.includes(id))
    set({ busy: "keep", error: null })
    try {
      // Ticking is confirming: the kept facts count at once. Nothing ticked turns the batch down, the source stays.
      await (accept.length ? platform.memoryConfirm(batch.ref, accept) : platform.memoryDiscard(batch.ref))
      set({ kept: accept, step: "done" })
      void useMemory.getState().load()
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: null })
    }
  },
  finish: () => {
    set({ step: "done", kept: [] })
    void useMemory.getState().load()
  },
  another: () => set({ ...fresh, draft: emptyDraft(get().draft.way) }),
}))

async function loadMentions(ref: string) {
  try {
    const mentions = await platform.memoryMentions(ref)
    if (useAddSource.getState().added?.ref === ref) useAddSource.setState({ mentions: { state: "ready", mentions } })
  } catch (e) {
    if (useAddSource.getState().added?.ref === ref)
      useAddSource.setState({ mentions: { state: "failed", error: message(e) } })
  }
}
