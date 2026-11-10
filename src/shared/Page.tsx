import { LoaderCircle } from "lucide-react"
import type { ReactNode } from "react"
import { useMessages } from "@/i18n"
import { BetaBadge } from "@/shared/BetaBadge"
import { ExtLink } from "@/shared/ExtLink"
import { cx } from "@/ui/cx"
import { InfoTip } from "@/ui/InfoTip"
import { uiMessages } from "@/ui/messages"

/**
 * The frame every page sits in: the side gutter, the top and bottom space, and the gap between blocks. `fill` makes
 * it the window's height, so a `Board fill` below the header takes what is left and its columns scroll inside.
 */
export function Page({
  children,
  className,
  fill = false,
}: {
  children: ReactNode
  className?: string
  fill?: boolean
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col px-[2.1rem] pt-[1.6rem]",
        fill ? "h-full gap-[1rem] pb-[1.2rem]" : "gap-[1.5rem] pb-[2.2rem]",
        className,
      )}
    >
      {children}
    </div>
  )
}

type Props = {
  title: string
  /** The sidebar section this page is; a section marked beta gets its β beside the title. */
  section?: string
  /** A short line beside the title. While `busy` (the default) it has a spinner and is announced, as "Checking…". */
  status?: string | null
  busy?: boolean
  intro?: ReactNode
  /** A link to the page's guide on the website, at the end of the intro. */
  guide?: { label: string; href: string }
  /** On the right, bottom-aligned with the title block: the refresh button, a view switch, the page's one action. */
  actions?: ReactNode
  /**
   * One line, for a page with a board: a smaller title, the intro and guide behind an "i" beside it. Set for every view
   * of the page, so switching to the board moves nothing under the pointer.
   */
  compact?: boolean
}

/** The one page title row (DESIGN.md, Layout): display title, intro capped at 70ch, quiet actions on the right. */
export function PageHeader({ title, section, status, busy = true, intro, guide, actions, compact }: Props) {
  const m = useMessages(uiMessages)
  const introText = (intro || guide) && (
    <>
      {intro}
      {guide && (
        <>
          {" "}
          <ExtLink href={guide.href} className="font-medium">
            {guide.label}
          </ExtLink>
        </>
      )}
    </>
  )
  return (
    <div className={cx("flex flex-wrap justify-between gap-4", compact ? "items-center" : "items-end")}>
      {/* A basis, not the content, decides when the actions wrap: a status line appearing must not push them down. */}
      <div className="min-w-0 flex-1 basis-[24rem]">
        <div className="flex min-w-0 items-baseline gap-[1.2rem]">
          <h1
            className={cx(
              "font-display font-extrabold leading-none tracking-[-0.035em]",
              compact ? "text-[1.6rem]" : "text-[2.1rem]",
            )}
          >
            {title}
          </h1>
          {/* Beside the heading, not in it: the β must not become part of the page's name for a screen reader. */}
          {section && <BetaBadge section={section} className="-ml-[0.5rem] self-center" />}
          {compact && introText && (
            <InfoTip label={m.aboutPage(title)} className="-ml-[0.6rem] self-center">
              {introText}
            </InfoTip>
          )}
          {status !== undefined && (
            <p
              aria-live={busy ? "polite" : undefined}
              className="flex min-w-0 items-center gap-1.5 text-[0.9rem] text-ink-soft"
            >
              {busy && status && (
                <LoaderCircle className="size-4 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />
              )}
              <span className="truncate">{status}</span>
            </p>
          )}
        </div>
        {!compact && introText && <p className="mt-3 max-w-[70ch] text-body text-ink-soft">{introText}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
