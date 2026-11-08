import type { ConversationTarget } from "@/domain/conversation"
import { useNav } from "@/shared/nav"
import { useConversation } from "./store"

/** The hidden section a chat or message link opens; like the link page, never the page the next launch reopens. */
export const CONVERSATION_SECTION = "conversation"

export function openConversation(target: ConversationTarget) {
  useNav.getState().go(CONVERSATION_SECTION)
  void useConversation.getState().open(target)
}
