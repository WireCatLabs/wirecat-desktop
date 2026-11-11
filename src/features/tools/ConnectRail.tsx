import { Check } from "lucide-react"
import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { LinkButton } from "@/ui/LinkButton"
import { type ConnectStepId, stepStates } from "./connect-steps"
import { connectMessages } from "./messages-connect"

const STEP_COUNT = 6

export function Rail(props: {
  current: ConnectStepId
  finished: boolean
  summary: Partial<Record<ConnectStepId, string | undefined>>
  onChoose?: (() => void) | undefined
}) {
  const { current, finished, summary, onChoose } = props
  const m = useMessages(connectMessages)
  return (
    <ol className="flex flex-col gap-0.5" aria-label={m.rail.label}>
      {stepStates(current, finished).map((step, i) => (
        <li
          key={step.id}
          aria-current={step.state === "current" ? "step" : undefined}
          className="relative flex gap-3 pb-3 last:pb-0"
        >
          {i < STEP_COUNT - 1 && (
            <span
              aria-hidden
              className={cx(
                "absolute top-7 bottom-0 left-[0.7rem] w-[2px] -translate-x-1/2 transition-colors duration-(--motion-progress)",
                step.state === "done" ? "bg-ok/60" : "bg-line-strong",
              )}
            />
          )}
          <span
            aria-hidden
            className={cx(
              "relative z-10 grid size-[1.4rem] shrink-0 place-items-center rounded-full text-[0.85rem] font-semibold tabular-nums transition-colors duration-(--motion-slow)",
              step.state === "done" && "bg-ok text-on-status",
              step.state === "current" && "bg-brand text-brand-ink",
              step.state === "todo" && "bg-app-3 text-ink-dim",
            )}
          >
            {step.state === "done" ? <Check className="size-3" strokeWidth={3} /> : i + 1}
          </span>
          <span className="flex min-w-0 flex-col pt-px">
            <span
              className={cx(
                "text-[0.92rem]",
                step.state === "current"
                  ? "font-semibold text-ink"
                  : step.state === "done"
                    ? "text-ink"
                    : "text-ink-dim",
              )}
            >
              <span className="sr-only">{m.rail.step(i + 1)}</span>
              {m.steps[step.id]}
              <span className="sr-only">
                {step.state === "done" ? m.rail.done : step.state === "current" ? m.rail.current : ""}
              </span>
            </span>
            {step.state === "done" && summary[step.id] && (
              <span className="flex min-w-0 items-baseline gap-2 text-[0.85rem] text-ink-dim">
                <span className="truncate">{summary[step.id]}</span>
                {step.id === "choose" && onChoose && (
                  <LinkButton className="shrink-0" onClick={onChoose}>
                    {m.rail.change}
                  </LinkButton>
                )}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
