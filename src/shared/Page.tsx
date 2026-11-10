import { LoaderCircle } from "lucide-react"
import type { ReactNode } from "react"
import { ExtLink } from "@/shared/ExtLink"
import { cx } from "@/ui/cx"

/** The frame every page sits in: the side gutter, the top and bottom space, and the gap between blocks. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]", className)}>
      {children}
    </div>
  )
}

type Props = {
  title: string
  /** A short line beside the title. While `busy` (the default) it has a spinner and is announced, as "Checking…". */
  status?: string | null
  busy?: boolean
  intro?: ReactNode
  /** A link to the page's guide on the website, at the end of the intro. */
  guide?: { label: string; href: string }
  /** On the right, bottom-aligned with the title block: the refresh button, a view switch, the page's one action. */
  actions?: ReactNode
}

/** The one page title row (DESIGN.md, Layout): display title, intro capped at 70ch, quiet actions on the right. */
export function PageHeader({ title, status, busy = true, intro, guide, actions }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      {/* A basis, not the content, decides when the actions wrap: a status line appearing must not push them down. */}
      <div className="min-w-0 flex-1 basis-[24rem]">
        <div className="flex min-w-0 items-baseline gap-[1.2rem]">
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{title}</h1>
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
        {(intro || guide) && (
          <p className="mt-3 max-w-[70ch] text-body text-ink-soft">
            {intro}
            {guide && (
              <>
                {" "}
                <ExtLink href={guide.href} className="font-medium">
                  {guide.label}
                </ExtLink>
              </>
            )}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
