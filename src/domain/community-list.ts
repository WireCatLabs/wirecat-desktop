type ListStatus = {
  show: boolean
  state: "fresh" | "expiring" | "expired" | "neverFetched"
  expiresAt: string | null
}

export type ListNotice = { kind: "expiring"; days: number; until: string } | { kind: "expired"; since: string } | null

const DAY = 86_400_000

/** What the top of the app says about the signed list of community tools, while the owner shows them. */
export function listNotice(status: ListStatus | null, now = Date.now()): ListNotice {
  if (!status?.show || !status.expiresAt) return null
  if (status.state === "expired") return { kind: "expired", since: status.expiresAt }
  if (status.state !== "expiring") return null
  const days = Math.max(1, Math.ceil((Date.parse(status.expiresAt) - now) / DAY))
  return { kind: "expiring", days, until: status.expiresAt }
}

/** Rust refuses to install or update a listed tool then (`listed_release_allowed` in `install.rs`). */
export const listBlocksInstalls = (status: ListStatus | null) =>
  status !== null && (status.state === "expired" || status.state === "neverFetched")
