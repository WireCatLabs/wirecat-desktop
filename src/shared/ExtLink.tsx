import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { platform } from "@/platform/bridge"
import { cx } from "@/ui/cx"

type Props = {
  href: string
  children: ReactNode
  className?: string
  /** For a screen reader, where the words on screen are too short alone ("Open"). */
  label?: string
  /** Grey, for a link beside the main text rather than in it. */
  quiet?: boolean
}

/** A web link the app's opener shows in the browser; the address is the title, so it can be read before the click. */
export function ExtLink({ href, children, className, label, quiet = false }: Props) {
  return (
    <a
      href={href}
      title={href}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault()
        void platform.openUrl(href)
      }}
      className={cx(
        "inline-flex min-w-0 items-center gap-1 break-all hover:underline hover:underline-offset-4",
        quiet ? "text-ink-dim hover:text-ink" : "text-brand hover:text-brand-hover",
        className,
      )}
    >
      {children}
      <ExternalLink className="size-[0.85rem] shrink-0" aria-hidden />
    </a>
  )
}
