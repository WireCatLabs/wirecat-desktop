/** How the mail agent's last run went, as memo reports it in `schedule list`. */
export type RunOutcome = "ok" | "skipped" | "failed"

/** A run memo did not start, such as one past the day's cost cap, ends with exit 1 and memo's reason. */
export function runOutcome(last: { exitCode: number; reason: string | null }): RunOutcome {
  if (last.exitCode === 0) return "ok"
  return last.reason ? "skipped" : "failed"
}

/** US dollars as memo counts them, to the cent. */
export function formatUsd(usd: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(usd)
}
