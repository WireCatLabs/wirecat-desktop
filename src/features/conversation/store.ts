import { create } from "zustand"
import { type ConversationTarget, joined, placeOf } from "@/domain/conversation"
import type { ChatHeader, ChatMessage, ChatMissing } from "@/platform/bindings"
import { platform } from "@/platform/bridge"

export type Shown =
  | { state: "loading" }
  | { state: "found"; chat: ChatHeader | null; messages: ChatMessage[]; older: boolean; newer: boolean }
  | { state: "missing"; what: ChatMissing }
  | { state: "noMemo" }
  | { state: "old"; message: string }
  | { state: "failed"; message: string }

type Paging = { side: "older" | "newer"; error: string | null } | null

type ConversationState = {
  target: ConversationTarget | null
  shown: Shown
  paging: Paging
  open(target: ConversationTarget): Promise<void>
  more(side: "older" | "newer"): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

// A second link can land while the first is still being read; only the newest read may write.
let reading = 0

export const useConversation = create<ConversationState>((set, get) => ({
  target: null,
  shown: { state: "loading" },
  paging: null,
  async open(target) {
    const run = ++reading
    set({ target, shown: { state: "loading" }, paging: null })
    try {
      const answer = await platform.conversationRead(placeOf(target), { kind: "open" })
      if (run === reading) set({ shown: answer })
    } catch (e) {
      if (run === reading) set({ shown: { state: "failed", message: message(e) } })
    }
  },
  async more(side) {
    const { target, shown, paging } = get()
    if (!target || shown.state !== "found" || (paging && !paging.error)) return
    const edge = side === "older" ? shown.messages[0] : shown.messages.at(-1)
    if (!edge || !shown[side]) return
    const run = reading
    set({ paging: { side, error: null } })
    try {
      const answer = await platform.conversationRead(placeOf(target), { kind: side, message: edge.id })
      if (run !== reading) return
      const now = get().shown
      if (now.state !== "found") return
      if (answer.state !== "found") {
        // The page already shows what it had; the edge just stops offering more.
        set({ paging: null, shown: { ...now, [side]: false } })
        return
      }
      set({
        paging: null,
        shown: { ...now, messages: joined(now.messages, answer.messages, side === "older"), [side]: answer[side] },
      })
    } catch (e) {
      if (run === reading) set({ paging: { side, error: message(e) } })
    }
  },
}))
