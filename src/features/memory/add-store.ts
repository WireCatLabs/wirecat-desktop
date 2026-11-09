import { create } from "zustand"
import { type Draft, emptyDraft, givenOf, untickedAtFirst, type Way } from "@/domain/memory-add"
import { platform } from "@/platform/bridge"
import type { AddedSource, FilePreview, LinkPreview, Mentions, StoredSource } from "@/platform/memory-add-schemas"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { errorText as message } from "@/shared/errors"
import { useMemory } from "./store"

export type Step = "source" | "saved" | "facts" | "done"

/** A look at the link or file before it is saved; `of` is the address or path it shows, so a stale one is never shown. */
export type Preview =
  | { of: string; state: "loading" }
  | { of: string; state: "link"; link: LinkPreview }
  | { of: string; state: "file"; file: FilePreview }
  /** No preview: an older memo, or a look that failed. Save still works, and its own refusal is worded. */
  | { of: string; state: "none" }
export const STEPS: Step[] = ["source", "saved", "facts", "done"]

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
  /** What memo says the source is linked to, read once the panel is done; the summary shows only these. */
  linked: string[] | null
  /** Mentions the owner ticked: the suggested facts are about them. */
  subjects: string[]
  batch: MemoryEntry | null
  reused: boolean
  /** Findings the owner unticked; Keep creates the rest. */
  skipped: string[]
  /** What Keep created, by finding id; empty when the owner kept the source only. */
  kept: string[]
  preview: Preview | null
  /** Reads the page at `url` without keeping it; the panel calls it once the address stops changing. */
  previewLink(url: string): Promise<void>
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
  skipAll(skipped: boolean): void
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
  linked: null,
  subjects: [],
  batch: null,
  reused: false,
  skipped: [],
  kept: [],
  preview: null,
}

export const useAddSource = create<AddState>((set, get) => ({
  open:
    platform.kind === "mock" &&
    new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("add") === "open",
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
      if (path) {
        set((s) => ({ draft: { ...s.draft, path }, preview: { of: path, state: "loading" } }))
        void showFile(path)
      }
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: null })
    }
  },
  async previewLink(url) {
    set({ preview: { of: url, state: "loading" } })
    try {
      const link = await platform.memoryLinkPreview(url)
      if (get().preview?.of === url)
        set({ preview: link ? { of: url, state: "link", link } : { of: url, state: "none" } })
    } catch {
      if (get().preview?.of === url) set({ preview: { of: url, state: "none" } })
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
  skipAll: (skipped) => set((s) => ({ skipped: skipped ? (s.batch?.findings ?? []).map((f) => f.id) : [] })),
  async keep() {
    const { batch, skipped, busy } = get()
    if (!batch || busy) return
    if (batch.status !== "proposed") return get().finish()
    const accept = (batch.findings ?? []).map((f) => f.id).filter((id) => !skipped.includes(id))
    set({ busy: "keep", error: null })
    try {
      // Ticking is confirming: the kept facts count at once. Nothing ticked turns the batch down, the source stays.
      await (accept.length ? platform.memoryConfirm(batch.ref, accept) : platform.memoryDiscard(batch.ref))
      set({ kept: accept, step: "done" })
      void loadLinked()
      void useMemory.getState().load()
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: null })
    }
  },
  finish: () => {
    set({ step: "done", kept: [] })
    void loadLinked()
    void useMemory.getState().load()
  },
  another: () => set({ ...fresh, draft: emptyDraft(get().draft.way) }),
}))

async function loadLinked() {
  const ref = useAddSource.getState().added?.ref
  if (!ref) return
  try {
    const shown = await platform.memorySourceShow(ref)
    if (useAddSource.getState().added?.ref === ref) useAddSource.setState({ linked: shown.subjects.map((s) => s.ref) })
  } catch {
    if (useAddSource.getState().added?.ref === ref) useAddSource.setState({ linked: [] })
  }
}

async function loadMentions(ref: string) {
  try {
    const mentions = await platform.memoryMentions(ref)
    if (useAddSource.getState().added?.ref === ref) useAddSource.setState({ mentions: { state: "ready", mentions } })
  } catch (e) {
    if (useAddSource.getState().added?.ref === ref)
      useAddSource.setState({ mentions: { state: "failed", error: message(e) } })
  }
}

async function showFile(path: string) {
  try {
    const file = await platform.memoryFilePreview()
    if (useAddSource.getState().preview?.of === path)
      useAddSource.setState({ preview: file ? { of: path, state: "file", file } : { of: path, state: "none" } })
  } catch {
    if (useAddSource.getState().preview?.of === path) useAddSource.setState({ preview: { of: path, state: "none" } })
  }
}
