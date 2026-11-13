import { create } from "zustand"
import { queryOfNode } from "@/domain/documents"
import { PAGE_SIZES } from "@/ui/Pager"

/** How long typing pauses before the search reads memo: each read is a memo process. */
const TYPING_MS = 300

type State = {
  /** What the search field shows. */
  query: string
  /** What memo was asked: the field once typing pauses, a chip or a folder at once. */
  asked: string
  page: number
  size: number
  /** The document whose details are open, and its name until its details come. */
  open: string | null
  title: string
  type(query: string): void
  setQuery(query: string): void
  choose(node: string): void
  setPage(page: number): void
  setSize(size: number): void
  reveal(ref: string | null, title?: string): void
}

let typing: ReturnType<typeof setTimeout> | undefined

export const useDocuments = create<State>()((set, get) => ({
  query: "",
  asked: "",
  page: 1,
  size: PAGE_SIZES[0],
  open: null,
  title: "",
  type(query) {
    set({ query })
    clearTimeout(typing)
    typing = setTimeout(() => set({ asked: query.trim(), page: 1 }), TYPING_MS)
  },
  setQuery(query) {
    clearTimeout(typing)
    set({ query, asked: query.trim(), page: 1 })
  },
  choose(node) {
    get().setQuery(queryOfNode(get().query, node))
  },
  setPage: (page) => set({ page }),
  setSize: (size) => set({ size, page: 1 }),
  reveal: (open, title = "") => set(open ? { open, title } : { open }),
}))
