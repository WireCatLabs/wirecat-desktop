import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeStorage } from "./safe-storage"

type ChatAgentLimitState = { on: boolean; set(on: boolean): void }

/**
 * Whether Connect sets a chat-driven agent's profiles read only. Off by default (owner, 2026-11-14): connecting
 * leaves the tools' own levels as they are.
 */
export const useChatAgentLimit = create<ChatAgentLimitState>()(
  persist((set) => ({ on: false, set: (on) => set({ on }) }), {
    name: "wirecat.chat-agent-read-only",
    storage: createJSONStorage(() => safeStorage),
    partialize: ({ on }) => ({ on }),
  }),
)
