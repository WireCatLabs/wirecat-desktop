import { Check, Copy, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useMessages } from "@/i18n"
import { Button, type ButtonSize, type ButtonVariant } from "./Button"
import { cx } from "./cx"
import { uiMessages } from "./messages"
import { StableText } from "./Skeleton"

type Props = {
  value: string
  label: string
  className?: string
  title?: string
  /** After a copy that worked. */
  onCopied?: () => void
  /** A text button with these words instead of an icon button. */
  text?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

/**
 * Copies `value`; for a moment it says Copied, aloud too. A copy the system refuses says so and stays said, so the
 * owner does not paste nothing.
 */
export function CopyButton({
  value,
  label,
  className,
  title,
  onCopied,
  text,
  variant = "secondary",
  size = "md",
}: Props) {
  const m = useMessages(uiMessages)
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")

  useEffect(() => {
    if (state !== "copied") return
    const t = setTimeout(() => setState("idle"), 1600)
    return () => clearTimeout(t)
  }, [state])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setState("copied")
      onCopied?.()
    } catch {
      setState("failed")
    }
  }

  const said = state === "copied" ? m.copied : state === "failed" ? m.copyFailed : null
  const icon =
    state === "copied" ? (
      <Check className={cx("size-4", !text && "text-ok")} aria-hidden />
    ) : state === "failed" ? (
      <X className="size-4 text-bad" aria-hidden />
    ) : (
      <Copy className="size-4" aria-hidden />
    )
  const announce = (
    <span className="sr-only" aria-live="polite">
      {state === "copied" ? m.copiedAnnounce : state === "failed" ? m.copyFailedAnnounce : ""}
    </span>
  )

  if (text !== undefined) {
    return (
      <Button
        variant={variant}
        size={size}
        icon={icon}
        title={title}
        aria-label={said ?? label}
        onClick={() => void copy()}
        className={className}
      >
        <StableText value={said ?? text} variants={[text, m.copied, m.copyFailed]} />
        {announce}
      </Button>
    )
  }

  return (
    <>
      <button
        type="button"
        // It sits inside rows that open on a click or on Enter; copying must not open them too.
        onClick={(e) => {
          e.stopPropagation()
          void copy()
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") e.stopPropagation()
        }}
        aria-label={said ?? label}
        title={said ?? title ?? label}
        className={cx(
          "grid size-8 shrink-0 place-items-center rounded-[0.3rem] text-ink-dim transition-colors hover:bg-app-3 hover:text-ink",
          className,
        )}
      >
        {icon}
      </button>
      {announce}
    </>
  )
}
