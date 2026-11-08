import { create } from "zustand"

/** The day the Digests page shows; a `digest/<date>` link or a notification sets it before opening the page. */
export const useDigestDay = create<{ date: string | null }>(() => ({ date: null }))
