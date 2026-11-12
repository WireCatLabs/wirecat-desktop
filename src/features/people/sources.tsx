import { crmToolOf, findTool } from "@/domain/catalog"
import { toolOfProvider } from "@/domain/links"
import type { Identity } from "@/platform/people-schemas"
import { ServiceIcon } from "@/shared/ServiceIcon"
import { ToolIcon } from "@/shared/ToolIcon"
import { cx } from "@/ui/cx"

/** A source as the owner knows it: memo's `bitrix24` is the Bitrix24 tool, `telegram` is Telegram. */
export function sourceOf(provider: string): { tool: string; name: string } {
  const tool = findTool(toolOfProvider(provider)) ?? crmToolOf(provider)
  return { tool: tool?.id ?? provider, name: tool?.name ?? provider }
}

/** One account in words: its name or handle, never memo's id, which for a CRM is a whole URL. */
export const accountName = (i: Pick<Identity, "name" | "username">) =>
  i.username ? `@${i.username.replace(/^@/, "")}` : (i.name?.trim() ?? null)

/** `labelled` when the icon stands in for the source's name, so hover and screen readers still say it. */
export function SourceIcon({
  provider,
  className,
  labelled = false,
}: {
  provider: string
  className?: string
  labelled?: boolean
}) {
  const { tool, name } = sourceOf(provider)
  const size = cx("size-4 shrink-0", className)
  return labelled ? <ServiceIcon id={tool} label={name} className={size} /> : <ToolIcon id={tool} className={size} />
}
