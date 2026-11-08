import * as v from "valibot"
import { create } from "zustand"
import { platform } from "@/platform/bridge"
import { type DigestDay, type Report, ReportSchema } from "@/platform/digest-schemas"

export type Shown =
  | { state: "loading" }
  | { state: "report"; report: Report }
  | { state: "text"; text: string }
  | { state: "failed"; error: string }

type DigestsState = {
  /** null until the first read answers. */
  days: DigestDay[] | null
  error: string | null
  reading: boolean
  shown: Record<string, Shown>
  load(): Promise<void>
  show(date: string): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useDigests = create<DigestsState>((set, get) => ({
  days: null,
  error: null,
  reading: false,
  shown: {},
  async load() {
    set({ reading: true })
    try {
      const days = await platform.digestList()
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
      set({ error: message(e), reading: false })
    }
  },
  async show(date) {
    const now = get().shown[date]
    if (now && now.state !== "failed") return
    set((s) => ({ shown: { ...s.shown, [date]: { state: "loading" } } }))
    let shown: Shown
    try {
      const digest = await platform.digestShow(date)
      const report = digest.document === null ? null : v.safeParse(ReportSchema, digest.document)
      shown = report?.success
        ? { state: "report", report: report.output }
        : { state: "text", text: digest.text ?? JSON.stringify(digest.document, null, 2) }
    } catch (e) {
      shown = { state: "failed", error: message(e) }
    }
    set((s) => ({ shown: { ...s.shown, [date]: shown } }))
  },
}))
