import { Check, X } from "lucide-react"
import type { CSSProperties } from "react"
import { useMessages } from "@/i18n"
import { cx } from "./cx"
import { uiMessages } from "./messages"

export type StepState = "done" | "active" | "failed" | "todo"

export type Step = {
  label: string
  state: StepState
  /** Makes the label a button; the caller decides whether it goes back or only explains. */
  onSelect?: () => void
}

/** A row of steps; with `rail`, from `md` up a column to the side of the content. */
export function Stepper({ steps, rail = false }: { steps: readonly Step[]; rail?: boolean }) {
  return (
    <ol
      className={cx("grid grid-cols-(--steps)", rail && "md:grid-cols-1 md:gap-4")}
      style={{ "--steps": `repeat(${steps.length}, minmax(0, 1fr))` } as CSSProperties}
    >
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={cx(
            "relative flex flex-col items-center gap-3 text-center",
            rail && "md:flex-row md:items-start md:text-left",
          )}
        >
          {i > 0 && (
            <span
              aria-hidden
              className={cx(
                "absolute top-[0.8rem] right-1/2 h-[2px] w-full -translate-y-1/2 transition-colors duration-(--motion-progress)",
                rail &&
                  "md:top-auto md:right-auto md:bottom-full md:left-[0.8rem] md:h-4 md:w-[2px] md:-translate-x-1/2 md:translate-y-0",
                s.state === "todo" ? "bg-line-strong" : s.state === "failed" ? "bg-bad/60" : "bg-brand",
              )}
            />
          )}
          <span
            className={cx(
              "relative z-10 grid size-[1.6rem] shrink-0 place-items-center rounded-full transition-colors duration-(--motion-slow)",
              s.state === "done" && "bg-ok text-on-status",
              s.state === "active" && "step-pulse bg-brand",
              s.state === "failed" && "bg-bad text-on-status",
              s.state === "todo" && "scale-[0.62] bg-idle",
            )}
          >
            {s.state === "done" && <Check className="check-in size-4" strokeWidth={3} aria-hidden />}
            {s.state === "failed" && <X className="size-4" strokeWidth={3} aria-hidden />}
          </span>
          <span
            className={cx(
              "text-body",
              rail && "md:pt-[0.15rem]",
              s.state === "active" ? "font-semibold text-ink" : "text-ink-soft",
              s.state === "failed" && "font-semibold text-bad",
            )}
          >
            {s.onSelect ? (
              <button
                type="button"
                onClick={s.onSelect}
                className={cx(
                  "rounded-[0.2rem] text-inherit underline-offset-2 hover:text-ink hover:underline",
                  rail && "md:text-left",
                )}
              >
                {s.label}
                <Announce state={s.state} />
              </button>
            ) : (
              <>
                {s.label}
                <Announce state={s.state} />
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Announce({ state }: { state: StepState }) {
  const m = useMessages(uiMessages)
  const text =
    state === "done" ? m.stepDone : state === "active" ? m.stepActive : state === "failed" ? m.stepFailed : ""
  return <span className="sr-only">{text}</span>
}
