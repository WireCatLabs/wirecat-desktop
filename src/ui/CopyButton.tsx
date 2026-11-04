import { Check, Copy } from "lucide-react"
import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { uiMessages } from "./messages"

/** An icon button that copies `value`; for a moment it says Copied, aloud too. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const m = useMessages(uiMessages)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? m.copied : label}
        title={copied ? m.copied : label}
        className="grid size-8 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim transition-colors hover:bg-app-3 hover:text-ink"
      >
        {copied ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? m.copiedAnnounce : ""}
      </span>
    </>
  )
}
