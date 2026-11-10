import { ExternalLink, LoaderCircle } from "lucide-react"
import type { ReactNode } from "react"
import { platform } from "@/platform/bridge"
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
  /** A short live line beside the title, such as "Checking…"; `busy` puts a spinner before it. */
  status?: string | null
  busy?: boolean
  intro?: ReactNode
  /** A link to the page's guide on the website, at the end of the intro. */
  guide?: { label: string; href: string }
  /** On the right, bottom-aligned with the title block: the refresh button, a view switch, the page's one action. */
  actions?: ReactNode
  tour?: string
}

/** The one page title row (DESIGN.md, Layout): display title, intro capped at 70ch, quiet actions on the right. */
export function PageHeader({ title, status, busy = false, intro, guide, actions, tour }: Props) {
  return (
    <div data-tour={tour} className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-[1.2rem]">
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{title}</h1>
          {status !== undefined && (
            <p aria-live="polite" className="flex min-w-0 items-center gap-1.5 text-[0.9rem] text-ink-soft">
              {busy && status && <LoaderCircle className="size-4 shrink-0 animate-spin text-brand" aria-hidden />}
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
                <GuideLink {...guide} />
              </>
            )}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

function GuideLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        void platform.openUrl(href)
      }}
      className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
    >
      {label}
      <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
    </a>
  )
}
