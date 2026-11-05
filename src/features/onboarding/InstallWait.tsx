import {
  BookOpenText,
  Bot,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileText,
  HardDrive,
  type LucideIcon,
  Mail,
  MessageCircle,
  Send,
  Video,
} from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { findTool, ownerId } from "@/domain/catalog"
import { type BatchItem, batch, roughly, toolFraction } from "@/domain/install-batch"
import { useMessages } from "@/i18n"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { reducedMotion } from "@/ui/motion"
import { ProgressBar } from "@/ui/ProgressBar"
import { useTools } from "../tools/store"
import { type OnboardingText, onboardingMessages } from "./messages"

type Tip = keyof OnboardingText["wait"]["tips"]

const icons: Record<Tip, LucideIcon> = {
  agents: Bot,
  tg: Send,
  wa: MessageCircle,
  zm: Video,
  drive: FileText,
  memo: Mail,
  guides: BookOpenText,
  memory: Brain,
  local: HardDrive,
}

const TOOL_TIPS: Partial<Record<string, Tip>> = {
  tg: "tg",
  wa: "wa",
  zm: "zm",
  drive: "drive",
  memo: "memo",
  email: "memo",
}
const ROTATE_MS = 9000

function useBatchItems(chosen: readonly string[]): BatchItem[] {
  const sessions = useTools((s) => s.sessions)
  const installs = useTools((s) => s.installs)
  return chosen.map((id) => ({ session: sessions[ownerId(id)], installed: Boolean(installs[id]?.length) }))
}

function useTick(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/** The whole batch at a glance: one figure, one bar split per tool, and a rough time left. */
export function InstallOverview({ chosen }: { chosen: readonly string[] }) {
  const w = useMessages(onboardingMessages).wait
  const items = useBatchItems(chosen)
  const started = items.some((i) => i.session)
  const b = batch(items, useTick(started))
  if (!started) return null

  const pct = Math.round(b.fraction * 100)
  const currentId = b.current === null ? null : chosen[b.current - 1]
  const name = currentId ? (findTool(currentId)?.name ?? currentId) : null
  const left = b.remainingMs === null ? null : roughly(b.remainingMs)
  const headline =
    name && b.current !== null
      ? `${w.installing(name)} · ${w.of(b.current, b.total)}`
      : left
        ? w.waiting
        : w.finished(b.finished - b.failed)
  const sub = !left
    ? b.failed > 0
      ? w.failed(b.failed)
      : null
    : b.finished === 0 && b.fraction < 0.15
      ? w.typical
      : left.kind === "minutes"
        ? w.left.minutes(left.n)
        : w.left[left.kind]

  return (
    <section aria-label={w.label} className="flex flex-col gap-3">
      <div className="flex items-end gap-5">
        <span className="w-[5.5rem] shrink-0 font-mono text-[2.1rem] leading-none tracking-[-0.03em] text-ink tabular-nums">
          {pct}
          <span className="text-[1.1rem] text-ink-dim">%</span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate font-medium text-ink">{headline}</p>
          <p
            aria-live="polite"
            className={cx("min-h-[1.4rem] text-[0.9rem]", b.failed && !left ? "text-bad" : "text-ink-soft")}
          >
            {sub}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label={w.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={[headline, sub].filter(Boolean).join(". ")}
        className="flex gap-[3px]"
      >
        {items.map((item, i) => {
          const failed = item.session?.outcome?.event === "failed"
          const f = failed ? 1 : toolFraction(item)
          const running = Boolean(item.session && !item.session.outcome && item.session.step !== "queued")
          return (
            <ProgressBar
              key={chosen[i]}
              decorative
              label={w.label}
              value={f * 100}
              tone={failed ? "bad" : f >= 1 ? "ok" : "brand"}
              busy={running}
              className="flex-1"
            />
          )
        })}
      </div>
    </section>
  )
}

/** Tips about what the tools being installed make possible, shown only while something installs. */
export function InstallTips({ chosen }: { chosen: readonly string[] }) {
  const w = useMessages(onboardingMessages).wait
  const items = useBatchItems(chosen)
  const busy = items.some((i) => i.session && !i.session.outcome)
  const tips: Tip[] = [
    "agents",
    ...new Set(chosen.flatMap((id) => (TOOL_TIPS[id] ? [TOOL_TIPS[id] as Tip] : []))),
    "guides",
    "memory",
    "local",
  ]
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const at = index % tips.length

  // Turning pages for a reader who asked for less motion would be motion too; the buttons still turn them.
  useEffect(() => {
    if (!busy || paused || reducedMotion()) return
    const timer = setInterval(() => setIndex((n) => n + 1), ROTATE_MS)
    return () => clearInterval(timer)
  }, [busy, paused])

  const tip = tips[at] as Tip
  const Icon = icons[tip]
  const text = w.tips[tip]
  const turn = (by: number) => setIndex((n) => (((n + by) % tips.length) + tips.length) % tips.length)

  return (
    <Collapse open={busy}>
      <section
        aria-label={w.hints}
        className="rounded-[0.45rem] bg-app-2/60 px-[1.3rem] pt-[1.1rem] pb-[0.7rem]"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false)
        }}
      >
        <div className="flex items-start gap-4">
          <Icon aria-hidden className="mt-[0.15rem] size-5 shrink-0 text-ink-soft" />
          {/* Reserves the tallest tip's room, so turning a page never moves the line below. */}
          <Crossfade swap={tip} className="min-h-[4.9rem] min-w-0 flex-1">
            <p className="font-semibold text-ink">{text.title}</p>
            <p className="max-w-[64ch] text-body leading-relaxed text-ink-soft">{text.text}</p>
          </Crossfade>
        </div>
        <div className="flex items-center justify-between gap-3 pl-9">
          <span className="text-[0.85rem] text-ink-dim">{w.hints}</span>
          <div className="flex items-center gap-1">
            <span className="mr-1 font-mono text-[0.85rem] text-ink-dim tabular-nums">
              {w.hintOf(at + 1, tips.length)}
            </span>
            <TurnButton label={w.previous} onClick={() => turn(-1)}>
              <ChevronLeft aria-hidden className="size-4" />
            </TurnButton>
            <TurnButton label={w.next} onClick={() => turn(1)}>
              <ChevronRight aria-hidden className="size-4" />
            </TurnButton>
          </div>
        </div>
      </section>
    </Collapse>
  )
}

function TurnButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-[0.35rem] text-ink-soft transition-colors duration-150 hover:bg-app-3 hover:text-ink"
    >
      {children}
    </button>
  )
}
