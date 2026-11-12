import { create } from "zustand"
import type { PictureAgent, PictureReading, PictureReadingSetting } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { errorText as message } from "@/shared/errors"

type PictureReadingState = {
  /** null until memo answers. */
  answer: PictureReading | null
  error: string | null
  busy: boolean
  /** memo's refusal of the last change: a reason the page words, or memo's own words. */
  actionError: string | null
  load(): Promise<void>
  set(mode: PictureReadingSetting["mode"], agent: PictureAgent | null, model: string | null): Promise<boolean>
}

/** memo's picture reading setting, as memo reports it. */
export const usePictureReading = create<PictureReadingState>((set, get) => ({
  answer: null,
  error: null,
  busy: false,
  actionError: null,
  async load() {
    set({ error: null })
    try {
      set({ answer: await platform.pictureReadingStatus() })
    } catch (e) {
      set({ error: message(e) })
    }
  },
  async set(mode, agent, model) {
    if (get().busy) return false
    set({ busy: true, actionError: null })
    try {
      set({ answer: { state: "ready", setting: await platform.pictureReadingSet(mode, agent, model) } })
      return true
    } catch (e) {
      set({ actionError: message(e) })
      return false
    } finally {
      set({ busy: false })
    }
  },
}))
