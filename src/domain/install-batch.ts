import type { InstallSession } from "./status"

/**
 * How long one tool install takes before this batch has timed one of its own. Replaced by the batch's own average
 * as soon as a tool finishes, because a slow disk or connection makes every tool in the batch slow alike.
 */
export const TYPICAL_INSTALL_MS = 60_000

/** npm prints about this many package lookups before its first download (`install-progress.ts`). */
const LOOKUPS = 300

export type BatchItem = { session: InstallSession | undefined; installed: boolean }

export type Batch = {
  /** 0 to 1 over every tool in the batch; a tool already on the computer counts as done. */
  fraction: number
  total: number
  /** Tools with an outcome, or on the computer before the batch began. */
  finished: number
  /** The 1-based place of the tool being installed now, or null when none is. */
  current: number | null
  /** null while nothing runs or waits. */
  remainingMs: number | null
  failed: number
}

/** One tool's share of its own install, weighted so the bar keeps moving through npm's long lookup phase. */
export function toolFraction({ session, installed }: BatchItem): number {
  if (!session) return installed ? 1 : 0
  // A failed tool is not part of what got done, so a batch that failed is not shown as 100%.
  if (session.outcome) return session.outcome.event === "failed" ? 0 : 1
  if (session.step === "check") return 0.05
  if (session.step === "verify") return 0.95
  if (session.step !== "install") return 0
  const p = session.progress
  if (!p || p.phase === null) return 0.1
  if (p.phase === "resolve") return 0.1 + 0.25 * Math.min(1, p.looked / LOOKUPS)
  if (p.phase === "fetch") return 0.35 + 0.55 * (p.total ? Math.min(1, p.done / p.total) : 0)
  return 0.9
}

const tookMs = (s: InstallSession) => (s.ended && s.began?.check ? s.ended - s.began.check : null)

export function batch(items: readonly BatchItem[], now: number): Batch {
  const total = items.length
  const fractions = items.map(toolFraction)
  const fraction = total === 0 ? 0 : fractions.reduce((a, b) => a + b, 0) / total
  const finished = items.filter((i) => i.session?.outcome || (!i.session && i.installed)).length
  const failed = items.filter((i) => i.session?.outcome?.event === "failed").length
  const runningAt = items.findIndex((i) => i.session && !i.session.outcome && i.session.step !== "queued")
  const waiting = items.filter((i) => i.session && !i.session.outcome && i.session.step === "queued").length

  const timed = items.flatMap((i) => (i.session?.outcome?.event === "done" ? [tookMs(i.session)] : []))
  const known = timed.filter((ms): ms is number => ms !== null)
  const perTool = known.length ? known.reduce((a, b) => a + b, 0) / known.length : TYPICAL_INSTALL_MS

  let remainingMs: number | null = null
  if (runningAt >= 0 || waiting > 0) {
    let current = 0
    if (runningAt >= 0) {
      const item = items[runningAt] as BatchItem
      const elapsed = now - (item.session?.began?.check ?? now)
      const f = fractions[runningAt] ?? 0
      // Below 15% the projection from npm's own counts swings too much to show.
      current = f >= 0.15 ? (elapsed * (1 - f)) / f : Math.max(perTool - elapsed, perTool * 0.2)
    }
    remainingMs = Math.max(0, current + waiting * perTool)
  }

  return { fraction, total, finished, current: runningAt >= 0 ? runningAt + 1 : null, remainingMs, failed }
}

export type Remaining = { kind: "almost" } | { kind: "underMinute" } | { kind: "minutes"; n: number }

/** Coarse on purpose: a seconds countdown that jumps back up reads as a broken promise. */
export function roughly(ms: number): Remaining {
  if (ms < 15_000) return { kind: "almost" }
  if (ms < 60_000) return { kind: "underMinute" }
  return { kind: "minutes", n: Math.round(ms / 60_000) }
}
