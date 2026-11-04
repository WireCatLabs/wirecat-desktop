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

/** What one tool's install is doing now, with npm's own counts where it reports them. */
export type ToolStage =
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "check" }
  | { kind: "resolve"; looked: number }
  | { kind: "fetch"; done: number; total: number | null }
  | { kind: "setup" }
  /** A manager that reports nothing (pnpm, bun): it runs, and that is all that is known. */
  | { kind: "quiet" }
  | { kind: "verify" }
  | { kind: "done" }
  | { kind: "failed" }

export type ToolProgress = { stage: ToolStage; fraction: number }

/**
 * One tool's share of its own install, weighted so the bar keeps moving through npm's long lookup phase. The
 * overview and every row read this one mapping, so a row's bar and its slice of the overview never disagree.
 */
export function toolProgress({ session, installed }: BatchItem): ToolProgress {
  if (!session) return installed ? { stage: { kind: "done" }, fraction: 1 } : { stage: { kind: "idle" }, fraction: 0 }
  // A failed tool is not part of what got done, so a batch that failed is not shown as 100%.
  if (session.outcome)
    return session.outcome.event === "failed"
      ? { stage: { kind: "failed" }, fraction: 0 }
      : { stage: { kind: "done" }, fraction: 1 }
  if (session.step === "queued") return { stage: { kind: "waiting" }, fraction: 0 }
  if (session.step === "check") return { stage: { kind: "check" }, fraction: 0.05 }
  if (session.step === "verify") return { stage: { kind: "verify" }, fraction: 0.95 }
  if (session.step !== "install") return { stage: { kind: "check" }, fraction: 0 }
  const p = session.progress
  if (!p || p.phase === null) return { stage: { kind: "quiet" }, fraction: 0.1 }
  if (p.phase === "resolve")
    return { stage: { kind: "resolve", looked: p.looked }, fraction: 0.1 + 0.25 * Math.min(1, p.looked / LOOKUPS) }
  if (p.phase === "fetch")
    return {
      stage: { kind: "fetch", done: p.done, total: p.total },
      fraction: 0.35 + 0.55 * (p.total ? Math.min(1, p.done / p.total) : 0),
    }
  return { stage: { kind: "setup" }, fraction: 0.9 }
}

export const toolFraction = (item: BatchItem): number => toolProgress(item).fraction

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
