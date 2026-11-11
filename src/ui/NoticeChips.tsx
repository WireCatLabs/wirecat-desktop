import { type ReactNode, useEffect, useId, useState } from "react"
import { Collapse } from "./Collapse"
import { cx } from "./cx"
import { ExpandChevron } from "./ExpandChevron"

export type Notice = {
  id: string
  /** `warn` for something waiting on the owner; `neutral` for a fact about the page. */
  tone: "neutral" | "warn"
  /** A few words: the chip. */
  label: string
  icon?: ReactNode
  /** The whole notice with its action, shown under the chips while its chip is open. */
  body: ReactNode
}

/**
 * Several notices above a page's content as one line of chips, so the content keeps its height; a chip opens its full
 * text and action under the line, one at a time.
 */
export function NoticeChips({ notices, label }: { notices: readonly Notice[]; label: string }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const base = useId()
  const open = notices.find((n) => n.id === openId) ?? null
  // A notice that went (its stages confirmed) closes, so it does not open by itself when it comes back.
  useEffect(() => {
    if (openId !== null && open === null) setOpenId(null)
  }, [openId, open])
  return (
    <Collapse open={notices.length > 0}>
      <div className="flex flex-col gap-[0.6rem]">
        <ul aria-label={label} className="flex flex-wrap items-center gap-[0.5rem]">
          {notices.map((n) => {
            const expanded = n.id === open?.id
            return (
              <li key={n.id} className="reveal">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`${base}-body`}
                  onClick={() => setOpenId(expanded ? null : n.id)}
                  className={cx(
                    "inline-flex min-h-[2rem] items-center gap-[0.45rem] rounded-full border px-[0.75rem] text-[0.9rem] font-medium transition-colors duration-(--motion-fast)",
                    n.tone === "warn"
                      ? "border-warn/40 bg-warn/10 text-warn-ink hover:bg-warn/20"
                      : "border-line-strong bg-app text-ink-soft hover:bg-app-3 hover:text-ink",
                    expanded && "ring-1 ring-current/30",
                  )}
                >
                  {n.icon}
                  {n.label}
                  <ExpandChevron open={expanded} className="text-current" />
                </button>
              </li>
            )
          })}
        </ul>
        <Collapse open={open !== null} id={`${base}-body`}>
          {open && (
            <div
              className={cx(
                "rounded-[0.2rem] border px-[1.1rem] py-[0.9rem] text-[0.95rem]",
                open.tone === "warn" ? "border-warn/40 bg-warn/10" : "border-line-strong bg-app",
              )}
            >
              {open.body}
            </div>
          )}
        </Collapse>
      </div>
    </Collapse>
  )
}
