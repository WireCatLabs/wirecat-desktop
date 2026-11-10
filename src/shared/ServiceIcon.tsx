import { useId, useRef } from "react"
import { crmToolOf, findTool } from "@/domain/catalog"
import { TipPanel, useTip } from "@/ui/Tooltip"
import { ToolIcon } from "./ToolIcon"

type Props = {
  id: string
  /** The service's name; the catalog's by default. */
  label?: string
  className?: string
  /**
   * Off where the name is read already, such as inside an option that carries it: otherwise the icon takes a tab stop
   * so the keyboard reaches its name too.
   */
  focusable?: boolean
}

/**
 * A service's logo standing in for its name, so a row says "Telegram" without the word: screen readers read the name,
 * hover and focus show it. Beside a visible name, use `ToolIcon`, which is decoration.
 */
export function ServiceIcon({ id, label, className, focusable = true }: Props) {
  const name = label ?? findTool(id)?.name ?? crmToolOf(id)?.name ?? id
  const tip = useTip({ delay: 300 })
  const anchor = useRef<HTMLSpanElement>(null)
  const tipId = useId()
  return (
    <span
      ref={anchor}
      className="inline-flex shrink-0 rounded-[0.2rem] focus-visible:outline-2 focus-visible:outline-brand"
      {...tip.hover}
      {...(focusable ? { tabIndex: 0, ...tip.focus } : {})}
    >
      <ToolIcon id={id} className={className} />
      <span className="sr-only">{name}</span>
      {/* Mounted only while open: a table shows one per row. */}
      {tip.open && (
        <TipPanel id={tipId} anchor={anchor} open className="w-auto max-w-[16rem] px-2 py-1">
          {name}
        </TipPanel>
      )}
    </span>
  )
}
