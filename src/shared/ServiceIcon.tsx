import { type ReactNode, useId, useRef } from "react"
import { TipPanel, useTip } from "@/ui/Tooltip"
import { ToolIcon } from "./ToolIcon"

/**
 * A service's logo standing in for its name, so a row says "Telegram" without the word: screen readers read `label`
 * and hover shows it. Beside a visible name, use `ToolIcon`, which is decoration.
 */
export function ServiceIcon({ id, label, className }: { id: string; label: string; className?: string }) {
  return (
    <Named label={label}>
      <ToolIcon id={id} className={className} />
    </Named>
  )
}

function Named({ label, children }: { label: string; children: ReactNode }) {
  const tip = useTip({ delay: 300 })
  const anchor = useRef<HTMLSpanElement>(null)
  const id = useId()
  return (
    <span ref={anchor} className="inline-flex shrink-0" {...tip.hover}>
      {children}
      <span className="sr-only">{label}</span>
      <TipPanel id={id} anchor={anchor} open={tip.open} className="w-auto max-w-[16rem] px-2 py-1">
        {label}
      </TipPanel>
    </span>
  )
}
