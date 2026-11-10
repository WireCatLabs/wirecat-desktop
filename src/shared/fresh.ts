/** As long as Clients keeps memo's answer; a page opened again within it shows what it has and reads nothing. */
export const FRESH_MS = 60_000

let changedAt = 0

/** Something outside the pages changed what they show (a sync ended, the tour gave the pages back): read again. */
export const markStale = () => {
  changedAt = Date.now()
}

export const fresh = (at: number | null, now = Date.now()) => at !== null && at > changedAt && now - at < FRESH_MS
