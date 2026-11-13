import { LoaderCircle } from "lucide-react"
import { createContext, type HTMLAttributes, type ReactNode, type Ref, useContext } from "react"
import { createPortal } from "react-dom"
import { useMessages } from "@/i18n"
import { BetaBadge } from "@/shared/BetaBadge"
import { ExtLink } from "@/shared/ExtLink"
import { cx } from "@/ui/cx"
import { InfoTip } from "@/ui/InfoTip"
import { uiMessages } from "@/ui/messages"

/** Set inside a tab: where the tab's actions go, on the line of the tabs. */
const InTab = createContext<{ actions: HTMLElement | null } | null>(null)

/**
 * Wraps a page shown as a tab of another (Agents on Tools): its `Page` drops the frame the tabbed page already draws,
 * and its `PageHeader` drops the title, which the tabbed page and the selected tab already say. Its status and actions
 * move to the right of the tabs, so the title's line keeps them on every page.
 */
export const PageAsTab = ({ actions, children }: { actions: HTMLElement | null; children: ReactNode }) => (
  <InTab.Provider value={{ actions }}>{children}</InTab.Provider>
)

/**
 * The frame every page sits in: the side gutter, the top and bottom space, and the gap between blocks. `fill` makes
 * it the window's height, so a `Board fill` below the header takes what is left and its columns scroll inside.
 */
export function Page({
  children,
  className,
  fill = false,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  fill?: boolean
}) {
  const inTab = useContext(InTab)
  if (inTab)
    return (
      <div {...rest} className={cx("flex min-w-0 flex-col gap-[1.5rem]", className)}>
        {children}
      </div>
    )
  return (
    <div
      {...rest}
      className={cx(
        "flex min-w-0 flex-col px-[2.1rem] pt-[1.6rem]",
        // A spacer, not padding: when the header and a board at its least overflow the window, the padding of a
        // full-height box would be left behind and the board would end at the window's edge.
        "gap-[1.5rem]",
        fill ? "h-full after:h-0 after:shrink-0 after:content-['']" : "pb-[2.2rem]",
        className,
      )}
    >
      {children}
    </div>
  )
}

type Props = {
  title: ReactNode
  /** The sidebar section this page is; a section marked beta gets its β beside the title. */
  section?: string
  /** A short line beside the title. While `busy` (the default) it has a spinner and is announced, as "Checking…". */
  status?: string | null
  busy?: boolean
  intro?: ReactNode
  /** A link to the page's guide on the website, at the end of the intro. */
  guide?: { label: string; href: string }
  /** On the right, on the title's line on every page: the refresh button, a view switch, the page's one action. */
  actions?: ReactNode
  /**
   * One line, for a page with a board: the intro behind an "i" beside the title, the guide link after it. Set for every
   * view of the page, so switching to the board moves nothing under the pointer.
   */
  compact?: boolean
  /** Before the title, for a page reached from another: its Back button. */
  back?: ReactNode
  /** For a page that moves focus to its title when it opens. */
  headingRef?: Ref<HTMLHeadingElement>
}

/** The one page title row (DESIGN.md, Layout): display title, intro capped at 70ch, quiet actions on the right. */
export function PageHeader(props: Props) {
  const { title, section, status, busy = true, intro, guide, actions, compact, back, headingRef } = props
  const m = useMessages(uiMessages)
  const inTab = useContext(InTab)
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
  if (inTab) return <TabHeader to={inTab.actions} status={status} busy={busy} intro={introText} actions={actions} />
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      {/* A basis, not the content, decides when the actions wrap: a status line appearing must not push them down. */}
      <div className="min-w-0 flex-1 basis-[24rem]">
        <div className="flex min-h-[2.1rem] min-w-0 items-baseline gap-[1.2rem]">
          {back && <div className="shrink-0 self-center">{back}</div>}
          <h1
            ref={headingRef}
            tabIndex={headingRef ? -1 : undefined}
            className={cx(
              "font-display text-[2.1rem] font-extrabold leading-tight tracking-[-0.035em]",
              Boolean(back) && "min-w-0 break-words",
              headingRef && "step-heading",
            )}
          >
            {title}
          </h1>
          {/* Beside the heading, not in it: the β must not become part of the page's name for a screen reader. */}
          {section && <BetaBadge section={section} className="-ml-[0.5rem] self-center" />}
          {compact && intro && typeof title === "string" && (
            <InfoTip label={m.aboutPage(title)} className="-ml-[0.6rem] self-center">
              {intro}
            </InfoTip>
          )}
          {/* Out of the tip: a link in it would close with the tip before the keyboard reaches it. */}
          {compact && guide && (
            <ExtLink href={guide.href} className="-ml-[0.6rem] self-center text-[0.9rem] font-medium">
              {guide.label}
            </ExtLink>
          )}
          {status !== undefined && <Status status={status} busy={busy} />}
        </div>
        {!compact && introText && <p className="mt-3 max-w-[70ch] text-body text-ink-soft">{introText}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

function Status({ status, busy }: { status: string | null; busy: boolean }) {
  return (
    <p
      aria-live={busy ? "polite" : undefined}
      className="flex min-w-0 items-center gap-1.5 text-[0.9rem] text-ink-soft"
    >
      {busy && status && <LoaderCircle className="size-4 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />}
      <span className="truncate">{status}</span>
    </p>
  )
}

/** A tab's intro under the tabs; its status and actions beside the tabs. */
function TabHeader(props: {
  to: HTMLElement | null
  status: string | null | undefined
  busy: boolean
  intro: ReactNode
  actions: ReactNode
}) {
  const { to, status, busy, intro, actions } = props
  const side = (status !== undefined || actions) && (
    <>
      {status !== undefined && <Status status={status} busy={busy} />}
      {actions}
    </>
  )
  return (
    <>
      {to && side && createPortal(side, to)}
      {intro && <p className="max-w-[70ch] text-body text-ink-soft">{intro}</p>}
    </>
  )
}
