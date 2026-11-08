import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { platform } from "@/platform/bridge"
import { cx } from "@/ui/cx"

/** A web link the app's opener shows in the browser; the address is the title, so it can be read before the click. */
export function ExtLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a
      href={href}
      title={href}
      onClick={(e) => {
        e.preventDefault()
        void platform.openUrl(href)
      }}
      className={cx(
        "inline-flex min-w-0 items-center gap-1 break-all text-brand hover:text-brand-hover hover:underline hover:underline-offset-4",
        className,
      )}
    >
      {children}
      <ExternalLink className="size-[0.85rem] shrink-0" aria-hidden />
    </a>
  )
}
