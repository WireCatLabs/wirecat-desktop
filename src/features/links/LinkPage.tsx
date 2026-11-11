import { useEffect, useRef } from "react"
import { referenceOf } from "@/domain/links"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { Page, PageHeader } from "@/shared/Page"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { EmptyState } from "@/ui/EmptyState"
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
    <Page>
      <PageHeader title={title} headingRef={heading} />
      <EmptyState
        action={
          canBack && (
            <Button size="sm" variant="secondary" onClick={() => useNav.getState().back()}>
              {m.back}
            </Button>
          )
        }
      >
        <p>{body}</p>
        {reference && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[0.85rem] text-ink-dim">{m.reference}</span>
            <code className="min-w-0 truncate rounded-[0.2rem] bg-app-2 px-2 py-[0.15rem] font-mono text-[0.85rem]">
              {reference}
            </code>
            <CopyButton value={reference} label={m.copyReference} />
          </div>
        )}
      </EmptyState>
    </Page>
  )
}
