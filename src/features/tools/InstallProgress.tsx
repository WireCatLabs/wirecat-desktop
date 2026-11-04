import { useEffect, useState } from "react"
import { findTool, ownerId, samePackage } from "@/domain/catalog"
import { type ToolStage, toolProgress } from "@/domain/install-batch"
import type { InstallSession } from "@/domain/status"
import { clock } from "@/domain/sync"
import { formatList, useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { type ProgressText, progressMessages } from "./messages-progress"
import { useTools } from "./store"

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

type Phase = keyof ProgressText["now"]

const phaseOf = (stage: ToolStage): Phase => {
  switch (stage.kind) {
    case "waiting":
    case "check":
    case "resolve":
    case "fetch":
    case "setup":
    case "verify":
      return stage.kind
    default:
      return "quiet"
  }
}

/** What the install is doing now, in a few words, with npm's own counts. */
export function stageLine(stage: ToolStage, m: ProgressText): string {
  switch (stage.kind) {
    case "waiting":
      return m.waiting
    case "check":
      return m.checking
    case "resolve":
      return m.looking(stage.looked)
    case "fetch":
      return stage.total ? m.of(stage.done, stage.total) : m.unpacking(stage.done)
    case "setup":
      return m.setup
    case "verify":
      return m.verifying
    default:
      return m.quiet
  }
}

const progressOf = (session: InstallSession) => toolProgress({ session, installed: false })

/**
 * The time an install has run, what it is doing with npm's real counts, and a bar that is this tool's share of the
 * overview (`toolProgress`), so the two never disagree.
 */
export function InstallProgress({ session, compact = false }: { session: InstallSession; compact?: boolean }) {
  const m = useMessages(progressMessages)
  const now = useNow(!session.outcome)
  const { stage, fraction } = progressOf(session)
  const since = session.began?.check ?? now
  const line = stageLine(stage, m)
  const pct = Math.round(fraction * 100)
  return (
    <section aria-label={m.label} className="flex items-start gap-5">
      <div className="flex w-[5.5rem] shrink-0 flex-col items-start gap-1">
        <span
          className={cx(
            "font-mono leading-none tracking-[-0.02em] text-ink tabular-nums",
            compact ? "text-[1.35rem]" : "text-[1.8rem]",
          )}
        >
          {clock(Math.max(0, now - since))}
        </span>
        <span className="text-[0.8rem] text-ink-dim">{m.elapsed}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex items-center gap-2 text-[0.95rem] leading-snug">
          <Lamp size="sm" tone={stage.kind === "waiting" ? "idle" : "busy"} />
          <span className="min-w-0 flex-1 truncate font-medium text-ink tabular-nums">{line}</span>
          <span className="shrink-0 font-mono text-[0.9rem] text-ink-soft tabular-nums">{m.percent(pct)}</span>
        </p>
        <Bar value={fraction} label={m.label} text={`${line}, ${m.percent(pct)}`} />
        <p aria-live="polite" className="max-w-[62ch] text-[0.9rem] leading-snug text-ink-soft">
          {m.now[phaseOf(stage)]}
        </p>
      </div>
    </section>
  )
}

function Bar({ value, label, text, thin }: { value: number; label: string; text: string; thin?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={text}
      className={cx("overflow-hidden rounded-full bg-app-3", thin ? "h-1" : "h-1.5")}
    >
      <div
        className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out-quart"
        style={{ width: `${value * 100}%` }}
      />
    </div>
  )
}

/** One line for a row: what the install is doing, its percent, and a thin bar under it. */
export function InstallLine({ session, name }: { session: InstallSession; name: string }) {
  const m = useMessages(progressMessages)
  const { stage, fraction } = progressOf(session)
  const line = stageLine(stage, m)
  const pct = m.percent(Math.round(fraction * 100))
  return (
    <div className="flex w-full min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-baseline gap-2 text-[0.95rem] text-ink-soft">
        <span className="min-w-0 flex-1 truncate tabular-nums">{line}</span>
        <span className="shrink-0 font-mono text-[0.85rem] tabular-nums">{pct}</span>
      </div>
      <Bar thin value={fraction} label={m.labelFor(name)} text={`${line}, ${pct}`} />
    </div>
  )
}

/** Installs that have not finished, in the order they run: the one running first, then the queue. */
export function useUnfinishedInstalls() {
  const sessions = useTools((s) => s.sessions)
  return Object.entries(sessions)
    .filter(([, s]) => s.operation === "install" && !s.outcome)
    .sort(([, a], [, b]) => Number(a.step === "queued") - Number(b.step === "queued"))
    .map(([id, session]) => ({ id, session }))
}

const nameOf = (id: string) => formatList(samePackage(id).map((t) => t.name)) || (findTool(id)?.name ?? id)

/**
 * "Still installing: Telegram 45%" for places away from the install itself. It reads the same store the Tools page
 * and the Install step read, so leaving a page never loses or cancels anything.
 */
export function StillInstalling({ className }: { className?: string }) {
  const m = useMessages(progressMessages)
  const unfinished = useUnfinishedInstalls()
  const first = unfinished[0]
  if (!first) return null
  const { fraction } = progressOf(first.session)
  const pct = Math.round(fraction * 100)
  const name = nameOf(ownerId(first.id))
  const more = unfinished.length - 1
  const text = m.still(name, m.percent(pct), more)
  return (
    <div role="status" className={cx("flex min-w-0 items-center gap-3 text-[0.9rem] text-ink-soft", className)}>
      <Lamp size="sm" tone="busy" />
      <span className="min-w-0 truncate tabular-nums">{text}</span>
      <span className="w-[4.5rem] shrink-0" aria-hidden>
        <span className="block h-1 overflow-hidden rounded-full bg-app-3">
          <span
            className="block h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out-quart"
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
    </div>
  )
}
