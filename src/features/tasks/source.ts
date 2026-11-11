import { create } from "zustand"
import { fromMessages } from "@/domain/tasks"

export type Source = "projects" | "chats"

/**
 * Projects or the tasks memo found in chats and mail: the page's own switch over what was read, kept beside the store
 * and not written into the search.
 */
export const useSource = create<{ source: Source | null; setSource: (source: Source | null) => void }>((set) => ({
  source: null,
  setSource: (source) => set({ source }),
}))

export const ofSource = (task: { account?: string | null | undefined }, source: Source | null) =>
  source === null || (source === "chats") === fromMessages(task)
