import * as v from "valibot"
import { create } from "zustand"
import { platform } from "@/platform/bridge"
import { type DigestDay, type Report, ReportSchema } from "@/platform/digest-schemas"
import { errorText } from "@/shared/errors"

export type Shown =
  | { state: "loading" }
  | { state: "report"; report: Report }
  | { state: "text"; text: string }
  | { state: "failed"; error: string }

type DigestsState = {
  /** The digest whose days these are; undefined is the morning digest. */
  name: string | undefined
  /** null until the first read answers. */
  days: DigestDay[] | null
  error: string | null
  reading: boolean
  shown: Record<string, Shown>
  /** Reads the days of `name`, or of the digest already shown when left out. */
  load(name?: string): Promise<void>
  show(date: string): Promise<void>
}

export const MORNING = "morning-digest"

export const useDigests = create<DigestsState>((set, get) => ({
  name: undefined,
  days: null,
  error: null,
  reading: false,
  shown: {},
  async load(name) {
    const which = name === undefined ? get().name : name === MORNING ? undefined : name
    // Another digest's days are not this one's: start over, so its days never show under the new name.
    if (which !== get().name) set({ name: which, days: null, shown: {}, error: null })
    set({ reading: true })
    try {
      const days = await platform.digestList(which)
      if (get().name !== which) return
      // A day whose newest run changed is read again when it is next shown.
      const before = new Map((get().days ?? []).map((d) => [d.date, d.stamp]))
      const stale = days.filter((d) => before.has(d.date) && before.get(d.date) !== d.stamp).map((d) => d.date)
      set((s) => ({
        days,
        error: null,
        reading: false,
        shown: Object.fromEntries(Object.entries(s.shown).filter(([date]) => !stale.includes(date))),
      }))
    } catch (e) {
      if (get().name === which) set({ error: errorText(e), reading: false })
    }
  },
  async show(date) {
    const now = get().shown[date]
    if (now && now.state !== "failed") return
    set((s) => ({ shown: { ...s.shown, [date]: { state: "loading" } } }))
    const name = get().name
    let shown: Shown
    try {
      const digest = await platform.digestShow(date, name)
      const report = digest.document === null ? null : v.safeParse(ReportSchema, digest.document)
      shown = report?.success
        ? { state: "report", report: report.output }
        : { state: "text", text: digest.text ?? JSON.stringify(digest.document, null, 2) }
    } catch (e) {
      shown = { state: "failed", error: errorText(e) }
    }
    if (get().name !== name) return
    set((s) => ({ shown: { ...s.shown, [date]: shown } }))
  },
}))
