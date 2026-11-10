/** As long as Clients keeps memo's answer; a page opened again within it shows what it has and reads nothing. */
export const FRESH_MS = 60_000

export const fresh = (at: number | null, now = Date.now()) => at !== null && now - at < FRESH_MS
