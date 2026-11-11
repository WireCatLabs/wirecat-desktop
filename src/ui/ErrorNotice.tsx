import type { ReactNode } from "react"
import { useMessages } from "@/i18n"
import { cx } from "./cx"
import { Disclosure } from "./Disclosure"
import { uiMessages } from "./messages"

type Props = {
  children: ReactNode
  detail?: ReactNode
  /** What the tool itself said, usually English and technical: folded away under "Details", never in the sentence. */
  raw?: string | null
  /** Usually a "Report this" button; it sits beside the message and wraps under it when space runs out. */
  action?: ReactNode
  /** A line inside a row or a panel instead of a box across the page. */
  inline?: boolean
  /** `warn` for something to know or fix that did not fail, such as a setting read from another profile. */
  tone?: "bad" | "warn"
  className?: string
}

/** Something that went wrong, or needs attention, said where it happened. */
export function ErrorNotice({ children, detail, raw, action, inline = false, tone = "bad", className }: Props) {
  const m = useMessages(uiMessages)
  return (
    <div
      role={tone === "bad" ? "alert" : "status"}
      className={cx(
        // An error that appears fades in where it happened, so it reads as the answer to the click, not a glitch.
        "reveal flex flex-wrap items-center gap-x-3 gap-y-1.5",
        inline ? "text-[0.875rem]" : "rounded-[0.2rem] border py-2 pr-2 pl-4 text-body",
        !inline && (tone === "bad" ? "border-bad/40 bg-bad/10" : "border-warn/40 bg-warn/10"),
        className,
      )}
    >
      <div className={cx("min-w-0 flex-1 basis-[16rem]", !inline && "py-1")}>
        <p className={cx("selectable", inline && (tone === "bad" ? "text-bad" : "text-warn-ink"))}>{children}</p>
        {detail && <div className="selectable mt-1 text-[0.9rem] text-ink-soft">{detail}</div>}
        {raw && (
          <div className="mt-1 text-[0.9rem] text-ink-soft">
            <Disclosure summary={m.details}>
              <p className="selectable whitespace-pre-wrap break-words">{raw}</p>
            </Disclosure>
          </div>
        )}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  )
}
