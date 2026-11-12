import { useMessages } from "@/i18n"
import type { DigestItem } from "@/platform/bindings"
import {
  agentName,
  BackgroundAgentChoice,
  costed,
  otherAgent,
  useAgentsLoaded,
  useAgentWarning,
} from "@/shared/BackgroundAgentChoice"
import { backgroundAgentMessages } from "@/shared/messages-background-agent"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { specOf, useDigestBook } from "./schedule-store"

/**
 * The agent that writes the digest, and why its last run failed when the agent's own words say. Another agent is
 * offered, never switched to: the switch is an edit with that agent, so only the next run uses it.
 */
export function DigestAgent({ item, title }: { item: DigestItem; title: string }) {
  const m = useMessages(backgroundAgentMessages)
  const agents = useAgentsLoaded()
  const { busy, remembered, save } = useDigestBook()
  const warning = useAgentWarning()
  if (item.agent === null) return null
  const name = (id: string) => agentName(agents, id)
  const { trouble, last } = item
  // After a switch the last run is still the old agent's: its refusal no longer says anything about the digest.
  const failing =
    trouble !== null && last !== null && !last.ok && (trouble.agent === null || trouble.agent === item.agent)
  const troubled = failing ? (trouble.agent ?? item.agent) : null
  const other = otherAgent(agents, troubled, false)
  const instead = failing ? other.instead : undefined
  const moveTo = (agent: string) =>
    warning.ask(agent, () => void save({ ...specOf(item, title, remembered), agent }, false))
  return (
    <div className="flex flex-col gap-2 text-[0.92rem] text-ink-soft">
      <p>
        {m.runsIn(name(item.agent))}
        {!costed(agents, item.agent) && ` ${m.noCost(name(item.agent))}`}
      </p>
      {failing && (
        <ErrorNotice
          inline
          raw={trouble.line}
          action={
            instead && (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy[item.name] !== undefined}
                onClick={() => moveTo(instead)}
              >
                {m.switchTo(name(instead))}
              </Button>
            )
          }
        >
          {m.trouble[trouble.kind](troubled === null ? m.theAgent : name(troubled))}
        </ErrorNotice>
      )}
      {failing && other.pick && <BackgroundAgentChoice />}
      {warning.dialog}
    </div>
  )
}
