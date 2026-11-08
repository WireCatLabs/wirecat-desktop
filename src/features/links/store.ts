import { create } from "zustand"
import type { DeepLinkTarget } from "@/domain/links"

/** What the link page says when a link did not land on a page of its own. */
export type Shown =
  | { kind: "refused" }
  | { kind: "unsupported"; target: DeepLinkTarget }
  | { kind: "missing"; target: DeepLinkTarget }

type LinksState = {
  shown: Shown | null
  /** A link that arrived while the setup held the window; it opens once the setup closes. */
  waiting: { target: DeepLinkTarget | null } | null
}

export const useLinks = create<LinksState>(() => ({ shown: null, waiting: null }))
