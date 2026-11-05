import { Bot } from "lucide-react"
import { useEffect } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { useBotSignIn } from "../signin/bot-store"
import { botMessages } from "../signin/messages-bot"

/** The tool's bots beside its accounts: each name with a token on this computer, and the way to add one. */
export function BotList({ tool }: { tool: CatalogTool }) {
  const m = useMessages(botMessages)
  const bots = useBotSignIn((s) => s.bots[tool.id])

  useEffect(() => {
    void useBotSignIn.getState().loadBots(tool.id)
  }, [tool.id])

  return (
    <section aria-labelledby={`bots-${tool.id}`} className="flex flex-col gap-2">
      <h5 id={`bots-${tool.id}`} className="text-[0.9rem] font-medium text-ink">
        {m.bots}
        <span className="sr-only">, {tool.name}</span>
      </h5>
      {bots === undefined ? (
        <Skeleton className="h-4 w-28" label={m.bots} />
      ) : bots === null ? (
        <p className="text-[0.9rem] text-ink-soft">{m.botsFailed}</p>
      ) : bots.length === 0 ? (
        <p className="text-[0.9rem] text-ink-soft">{m.noBots}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[0.45rem] border border-line bg-app">
          {bots.map((b) => (
            <li key={b.name} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
              {b.source === "file" && <span className="text-[0.85rem] text-ink-soft">{m.tokenInFile}</span>}
              {b.source === "env" && <span className="text-[0.85rem] text-ink-soft">{m.tokenInEnv}</span>}
              <Pill tone="brand">{m.bot}</Pill>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Bot className="size-4" aria-hidden />}
          onClick={() => useBotSignIn.getState().open(tool.id)}
        >
          {m.addBot}
        </Button>
      </div>
    </section>
  )
}
