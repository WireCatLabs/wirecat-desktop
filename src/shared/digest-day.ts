import { create } from "zustand"

/**
 * The day the Digests page shows, and the digest a `digest/<date>` link or a notification opens;
 * the page takes `digest` once and clears it.
 */
export const useDigestDay = create<{ date: string | null; digest: string | null }>(() => ({
  date: null,
  digest: null,
}))
