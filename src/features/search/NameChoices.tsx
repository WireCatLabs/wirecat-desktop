import type { NameChoices } from "@/domain/search"
import { useMessages } from "@/i18n"
import { ToolIcon } from "@/shared/ToolIcon"
import { Button } from "@/ui/Button"
import { searchMessages } from "./messages"

/** Each person or chat a refused name could mean, with its messenger and how many messages it has, as a button. */
export function NameChoiceButtons(props: {
  tool: string | null
  choices: NameChoices
  onPick: (c: NameChoices["options"][number]) => void
}) {
  const { tool, choices, onPick } = props
  const m = useMessages(searchMessages)
  return (
    <span className="flex flex-wrap gap-2">
      {choices.options.map((c) => (
        <Button
          key={c.value}
          size="sm"
          title={c.query}
          icon={tool ? <ToolIcon id={tool} className="size-4 text-ink-soft" /> : undefined}
          onClick={() => onPick(c)}
        >
          {c.label ?? c.value}
          {c.detail && <span className="text-ink-dim"> @{c.detail.replace(/^@/, "")}</span>}{" "}
          <span className="font-mono text-[0.85rem] text-ink-dim tabular-nums">
            {c.count ? m.messageCount(c.count) : c.value}
          </span>
        </Button>
      ))}
    </span>
  )
}
