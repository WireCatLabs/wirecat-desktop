import { crmToolOf, findTool } from "@/domain/catalog"
import { toolOfProvider } from "@/domain/links"
import { cx } from "@/ui/cx"
import { ServiceIcon } from "./ServiceIcon"
import { ToolIcon } from "./ToolIcon"

/** memo's own accounts: notes folders, sources added by hand and imports have no tool but memo. */
const MEMO_OWN = new Set(["notes", "sources", "import"])

/** A source as the owner knows it: memo's `bitrix24` is the Bitrix24 tool, `telegram` is Telegram. */
export function sourceOf(provider: string): { tool: string; name: string } {
  if (MEMO_OWN.has(provider)) return { tool: "memo", name: findTool("memo")?.name ?? "memo" }
  const tool = findTool(toolOfProvider(provider)) ?? crmToolOf(provider)
  return { tool: tool?.id ?? provider, name: tool?.name ?? provider }
}

/** `labelled` when the icon stands in for the source's name, so hover and screen readers still say it. */
export function SourceIcon({
  provider,
  className,
  labelled = false,
  label,
}: {
  provider: string
  className?: string
  labelled?: boolean
  /** The name hover and screen readers say, when the source's own is too general (an account's label). */
  label?: string | undefined
}) {
  const { tool, name } = sourceOf(provider)
  const size = cx("size-4 shrink-0", className)
  return labelled ? (
    <ServiceIcon id={tool} label={label ?? name} className={size} />
  ) : (
    <ToolIcon id={tool} className={size} />
  )
}
