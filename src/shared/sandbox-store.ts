import { create } from "zustand"
import { platform } from "@/platform/bridge"
import { recordError } from "@/shared/errors"

type SandboxState = {
  /** The name `bin/sandbox` gave this test copy; null in the real app. */
  name: string | null
  /** The pending sign-in warning's answer; null while none is asked. */
  asking: ((ok: boolean) => void) | null
  load(): Promise<void>
  /** True at once in the real app; in a test copy, true only once the owner chose to go on. */
  confirmSignIn(): Promise<boolean>
  answer(ok: boolean): void
}

export const useSandbox = create<SandboxState>((set, get) => ({
  name: null,
  asking: null,
  async load() {
    try {
      const name = await platform.sandbox()
      set({ name })
      // Rust titles the window too; this keeps the page from naming it plain "WireCat" again.
      if (name) document.title = `WireCat — sandbox ${name}`
    } catch (e) {
      recordError("error", e)
      set({ name: null })
    }
  },
  confirmSignIn() {
    if (!get().name) return Promise.resolve(true)
    get().asking?.(false)
    return new Promise((resolve) => set({ asking: resolve }))
  },
  answer(ok) {
    const resolve = get().asking
    set({ asking: null })
    resolve?.(ok)
  },
}))
