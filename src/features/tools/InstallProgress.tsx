import { useEffect, useState } from "react"
import { fraction, type NpmProgress, startProgress } from "@/domain/install-progress"
import type { InstallSession } from "@/domain/status"
import { clock } from "@/domain/sync"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { type ProgressText, progressMessages } from "./messages-progress"

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

function status(p: NpmProgress, m: ProgressText) {
  if (p.phase === "resolve") return m.looking(p.looked)
  if (p.phase === "fetch") return p.total ? m.of(p.done, p.total) : m.unpacking(p.done)
  if (p.phase === "setup") return m.setup
  return m.quiet
}

/**
 * The time an install has run, what npm is doing with its real counts, and a bar that fills only with what npm has
 * reported. A manager that reports nothing (pnpm, bun) gets no bar: an empty or moving one would claim progress.
 */
export function InstallProgress({ session, compact = false }: { session: InstallSession; compact?: boolean }) {
  const m = useMessages(progressMessages)
  const now = useNow(!session.outcome)
  const p = session.progress ?? startProgress()
  const since = session.began?.install ?? session.began?.check ?? now
  const value = fraction(p)
  const line = status(p, m)
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
          <Lamp size="sm" tone="busy" />
          <span className="font-medium text-ink tabular-nums">{line}</span>
        </p>
        {value !== null && <Bar value={value} label={m.label} text={line} />}
        <p aria-live="polite" className="max-w-[62ch] text-[0.9rem] leading-snug text-ink-soft">
          {m.now[p.phase ?? "quiet"]}
        </p>
      </div>
    </section>
  )
}

function Bar({ value, label, text }: { value: number; label: string; text: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={text}
      className="h-1.5 overflow-hidden rounded-full bg-app-3"
    >
      <div
        className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-300"
        style={{ width: `${value * 100}%` }}
      />
    </div>
  )
}
