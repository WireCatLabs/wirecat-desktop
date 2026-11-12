// `?memo-state=missing|old|failing` sets memo for every page at once, so one load shows how the whole app behaves
// without it. Each page's own switch (`?memory=`, `?tasks=`…) still wins.
const state = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("memo-state")

export const memoState = state === "missing" || state === "old" || state === "failing" ? state : null

/** Below every page's catalog minVersion, so each gated read says memo is too old. */
export const OLD_MEMO = "0.131.0"

/** What the real app passes on when memo's server stops before it answers (memo_server.rs). */
const MEMO_FAILED = "memo's command server stopped before it answered"

/** A page switch's word for the global state, in that page's own vocabulary. */
export function memoDefault(words: Partial<Record<"missing" | "old" | "failing", string>>): string | null {
  return memoState ? (words[memoState] ?? null) : null
}

export function failIfMemoFails(): void {
  if (memoState === "failing") throw new Error(MEMO_FAILED)
}
