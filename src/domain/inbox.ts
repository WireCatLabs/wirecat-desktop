// The Inbox tab of Digests: mail sorted by the AI model (mail-cli's `inbox`), its filter and why a run stopped.
import { freeWords, valuesOf } from "./query-terms"

const BUCKETS = ["answer", "read", "later"] as const
export type Bucket = (typeof BUCKETS)[number]

/** The field the account chip writes into the search text. */
export const ACCOUNT_FIELD = "account"

/** What Rust filters by: the accounts the chip chose and the words typed. */
export const filterOf = (query: string): { accounts: string[]; words: string[] } => ({
  accounts: valuesOf(query, ACCOUNT_FIELD),
  words: freeWords(query, ACCOUNT_FIELD),
})

type Group<T> = { bucket: Bucket; total: number; threads: T[] }

/**
 * One page's threads under their groups, in the order Rust sorted them. A group the page does not reach is left out;
 * `total` is the whole group across pages, so a group cut by the page still says how many it holds.
 */
export function groupsOf<T extends { bucket: string }>(page: {
  threads: readonly T[]
  buckets: Record<Bucket, number>
}): Group<T>[] {
  return BUCKETS.flatMap((bucket) => {
    const threads = page.threads.filter((t) => t.bucket === bucket)
    return threads.length > 0 ? [{ bucket, total: page.buckets[bucket], threads }] : []
  })
}

/** Why a read or a run was refused, as the page words it; `other` shows the tool's own message. */
export type Refusal =
  | "noModel"
  | "noKey"
  | "localOnly"
  | "ask"
  | "denied"
  | "agent"
  | "notSynced"
  | "busy"
  | "old"
  | "other"

const BY_REASON: Record<string, Refusal> = {
  "ai.not-set": "noModel",
  "ai.key-missing": "noKey",
  "local-only.refused": "localOnly",
  "chat-sending.ask": "ask",
  "chat-sending.denied": "denied",
  "mail.inbox-agent": "agent",
  "item.not-found": "notSynced",
  "store.locked": "busy",
}

export function refusalOf(failed: { code: string | null; reason: string | null }): Refusal {
  if (failed.code === "needs_update") return "old"
  if (failed.reason && BY_REASON[failed.reason]) return BY_REASON[failed.reason] ?? "other"
  if (failed.code === "store_busy") return "busy"
  return "other"
}
