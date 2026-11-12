import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { cx } from "@/ui/cx"
import { externalHref } from "./external-href"
import { linkMessages } from "./messages-links"

type Props = {
  url: string
  children?: ReactNode
  variant?: "primary" | "secondary" | "ghost"
  size?: "md" | "sm"
  /** Markers a dialog finds its next button by, such as `data-autofocus`. */
  marks?: Record<`data-${string}`, boolean>
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host || url
  } catch {
    return url
  }
}

/** A button that opens a web page, and beside it the page's link to copy for a browser the system did not choose. */
export function OpenLink({ url, children, variant = "secondary", size = "sm", marks }: Props) {
  const m = useMessages(linkMessages)
  const host = hostOf(url)
  return (
    <div className="flex items-center gap-1">
      <Button
        variant={variant}
        size={size}
        icon={<ExternalLink className="size-4" aria-hidden />}
        onClick={() => platform.openUrl(url)}
        {...externalHref(url)}
        {...marks}
      >
        {children ?? m.openHost(host)}
      </Button>
      <CopyButton
        value={url}
        label={m.copyLink(host)}
        // Framed like the button beside it: a bare icon next to a framed button goes unnoticed.
        className={cx(
          variant !== "ghost" && "border border-line-strong text-ink-soft",
          size === "md" && "size-[2.4rem] rounded-button",
        )}
      />
    </div>
  )
}
