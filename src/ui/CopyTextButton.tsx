import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "./Button"
import { cx } from "./cx"
import { uiMessages } from "./messages"
import { StableText } from "./Skeleton"

/** A labelled button that copies `text`, such as a prompt; for a moment it says Copied, aloud too, at the same width. */
export function CopyTextButton({
  text,
  label,
  primary = false,
  className,
}: {
  text: string
  label: string
  primary?: boolean
  className?: string
}) {
  const m = useMessages(uiMessages)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      className={className}
      icon={
        copied ? (
          <Check className={cx("size-4", primary ? "text-brand-ink" : "text-ok")} aria-hidden />
        ) : (
          <Copy className={cx("size-4", primary ? "text-brand-ink" : "text-ink-dim")} aria-hidden />
        )
      }
      onClick={async () => {
        await navigator.clipboard?.writeText(text).catch(() => undefined)
        setCopied(true)
      }}
    >
      <StableText value={copied ? m.copied : label} variants={[label, m.copied]} />
      <span className="sr-only" aria-live="polite">
        {copied ? m.copiedAnnounce : ""}
      </span>
    </Button>
  )
}
