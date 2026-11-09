import { create } from "zustand"
import type { AiChecked, AiModel, AiModelChoice } from "@/platform/ai-model-schemas"
import { platform } from "@/platform/bridge"
import { errorText as message } from "./errors"

type AiModelState = {
  /** null until memo answers. */
  model: AiModel | null
  error: string | null
  busy: "save" | "off" | "check" | null
  /** memo's refusal of the last save or turn off: a reason the page words, or memo's own words. */
  actionError: string | null
  checked: AiChecked | null
  load(): Promise<void>
  save(choice: AiModelChoice): Promise<boolean>
  off(): Promise<boolean>
  check(): Promise<void>
}

/** The AI model memo and the other tools share, as memo reports it. The key is never held here. */
export const useAiModel = create<AiModelState>((set, get) => ({
  model: null,
  error: null,
  busy: null,
  actionError: null,
  checked: null,
  async load() {
    set({ error: null })
    try {
      set({ model: await platform.aiModelShow() })
    } catch (e) {
      set({ error: message(e) })
    }
  },
  async save(choice) {
    if (get().busy) return false
    set({ busy: "save", actionError: null, checked: null })
    try {
      set({ model: await platform.aiModelSet(choice) })
      return true
    } catch (e) {
      set({ actionError: message(e) })
      return false
    } finally {
      set({ busy: null })
    }
  },
  async off() {
    if (get().busy) return false
    set({ busy: "off", actionError: null, checked: null })
    try {
      await platform.aiModelOff()
      set({ model: await platform.aiModelShow() })
      return true
    } catch (e) {
      set({ actionError: message(e) })
      return false
    } finally {
      set({ busy: null })
    }
  },
  async check() {
    if (get().busy) return
    set({ busy: "check", checked: null, actionError: null })
    try {
      set({ checked: await platform.aiModelCheck() })
    } catch (e) {
      set({ actionError: message(e) })
    } finally {
      set({ busy: null })
    }
  },
}))
