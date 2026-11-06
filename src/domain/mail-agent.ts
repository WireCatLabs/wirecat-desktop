/** How the mail agent's last run went, as memo reports it in `schedule list`. */
export type RunOutcome = "ok" | "skipped" | "failed"

/** memo keeps the last run's result and notes a later start it skipped; a run after the skip clears the note. */
export function runOutcome(last: { exitCode: number; skipped: unknown | null }): RunOutcome {
  if (last.skipped) return "skipped"
  return last.exitCode === 0 ? "ok" : "failed"
}

/** The day's cap, or null when there is none (memo says 0) or memo is too old to say. */
export function dailyCap(maxCostPerDayUsd: number | null): number | null {
  return maxCostPerDayUsd ? maxCostPerDayUsd : null
}

/** US dollars as memo counts them, to the cent. */
export function formatUsd(usd: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(usd)
}
