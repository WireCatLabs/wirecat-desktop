import { useNav } from "@/shared/nav"
import { useDocuments } from "./store"

export { DocumentsPage } from "./DocumentsPage"
export { useDocuments } from "./store"

/** Documents with this document's details open, from another page. */
export function openDocument(ref: string, title = "") {
  useDocuments.getState().reveal(ref, title)
  useNav.getState().go("documents")
}
