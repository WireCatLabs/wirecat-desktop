import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { Reader } from "@/platform/memory-add-schemas"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

type ReadersState = {
  /** null until memo answers. */
  readers: Reader[] | null
  error: string | null
  busy: "choose" | "key" | null
  chooseError: string | null
  keyError: string | null
  /** Where memo kept the key the owner just gave; the key itself is never held here. */
  keySaved: string | null
  load(): Promise<void>
  choose(id: string): Promise<void>
  saveKey(provider: string, key: string): Promise<boolean>
}

/** The ways to read a source for facts, as memo found them; shared by Settings and the Add to memory panel. */
export const useReaders = create<ReadersState>((set, get) => ({
  readers: null,
  error: null,
  busy: null,
  chooseError: null,
  keyError: null,
  keySaved: null,
  async load() {
    set({ error: null })
    try {
      set({ readers: await platform.memoryReaders() })
    } catch (e) {
      set({ error: message(e) })
    }
  },
  async choose(id) {
    if (get().busy) return
    set({ busy: "choose", chooseError: null })
    try {
      set({ readers: await platform.memoryReaderChoose(id) })
    } catch (e) {
      set({ chooseError: message(e) })
    } finally {
      set({ busy: null })
    }
  },
  async saveKey(provider, key) {
    if (get().busy) return false
    set({ busy: "key", keyError: null, keySaved: null })
    try {
      const saved = await platform.memoryReaderKey(provider, key)
      set({ keySaved: saved.source ?? "keyring" })
      await get().load()
      return true
    } catch (e) {
      set({ keyError: message(e) })
      return false
    } finally {
      set({ busy: null })
    }
  },
}))
