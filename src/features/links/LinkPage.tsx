import { Link2Off } from "lucide-react"
import { useEffect, useRef } from "react"
import { referenceOf } from "@/domain/links"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { focusInPlace } from "@/ui/motion"
import { linkMessages } from "./messages"
import { useLinks } from "./store"

/** Where a link lands when it has no page of its own: one calm message, the reference to copy, and the way back. */
export function LinkPage() {
  const m = useMessages(linkMessages)
  const shown = useLinks((s) => s.shown)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => focusInPlace(heading.current), [])
  const canBack = useNav((s) => s.past.length > 0)

  const target = shown && shown.kind !== "refused" ? shown.target : null
  const what = target ? m.kinds[target.type] : ""
  const [title, body] =
    shown?.kind === "unsupported"
      ? [m.unsupportedTitle, m.unsupportedBody(what)]
      : shown?.kind === "missing"
        ? [m.missingTitle, m.missingBody(what)]
        : [m.refusedTitle, m.refusedBody]
  const reference = target ? referenceOf(target) : null

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="max-w-[44rem] rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem]">
        <div className="flex items-start gap-3">
          <Link2Off className="mt-[0.2rem] size-5 shrink-0 text-ink-dim" aria-hidden />
          <div className="min-w-0">
            <h1 ref={heading} tabIndex={-1} className="step-heading text-[1.15rem] font-semibold text-ink">
              {title}
            </h1>
            <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">{body}</p>
            {reference && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[0.85rem] text-ink-dim">{m.reference}</span>
                <code className="min-w-0 truncate rounded-[0.2rem] bg-app-2 px-2 py-[0.15rem] font-mono text-[0.85rem]">
                  {reference}
                </code>
                <CopyButton value={reference} label={m.copyReference} />
              </div>
            )}
            {canBack && (
              <Button size="sm" variant="secondary" className="mt-4" onClick={() => useNav.getState().back()}>
                {m.back}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
