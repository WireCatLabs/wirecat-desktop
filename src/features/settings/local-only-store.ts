import { create } from "zustand"
import type { LocalOnly } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { errorText as message } from "@/shared/errors"

type LocalOnlyState = {
  /** null until memo answers. */
  answer: LocalOnly | null
  error: string | null
  busy: boolean
  /** memo's refusal of the last switch: a reason the page words, or memo's own words. */
  actionError: string | null
  load(): Promise<void>
  set(on: boolean): Promise<void>
}

/** memo's local only switch and where each feature sends data, as memo reports them. */
export const useLocalOnly = create<LocalOnlyState>((set, get) => ({
  answer: null,
  error: null,
  busy: false,
  actionError: null,
  async load() {
    set({ error: null })
    try {
      set({ answer: await platform.localOnlyStatus() })
    } catch (e) {
      set({ error: message(e) })
    }
  },
  async set(on) {
    if (get().busy) return
    set({ busy: true, actionError: null })
    try {
      // memo's answer is the whole new state, so nothing is read again.
      set({ answer: { state: "ready", status: await platform.localOnlySet(on) } })
    } catch (e) {
      set({ actionError: message(e) })
    } finally {
      set({ busy: false })
    }
  },
}))
