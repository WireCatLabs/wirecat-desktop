import type { ToolSource } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { communityLeftOut } from "@/shared/left-out"
import { settingsMessages } from "./messages"

/** What a source left out at start and why, beside the switch that reads it, instead of only in the console. */
export function LeftOut({ source }: { source: ToolSource }) {
  const m = useMessages(settingsMessages)
  const left = communityLeftOut().filter((r) => r.source === source)
  if (left.length === 0) return null
  return (
    <div className="max-w-[70ch] text-[0.9rem] text-ink-soft">
      <p className="font-medium text-warn-ink">{m.leftOut}</p>
      <ul className="mt-1 list-disc pl-5">
        {left.map((r) => (
          <li key={r.text} className="break-words font-mono text-[0.85rem]">
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
