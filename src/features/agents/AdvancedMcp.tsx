import { useRef } from "react"
import { connections, serverName } from "@/domain/agents"
import { tools as catalogTools } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { Agent, Registrations } from "@/platform/agents-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useNav } from "../nav"
import { ReportThis } from "../report/ReportThis"
import { askMcpRemove, mcpKey } from "./actions"
import { useConnect } from "./connect"
import { agentsMessages } from "./messages"

// Email shares memo's program, so one entry per program keeps a server from being listed twice.
const PROGRAMS = catalogTools.filter((t) => !t.partOf)

/**
 * Leftover WireCat MCP servers an agent here has registered, to remove: agents on this computer use the tools through
 * their skill, so MCP is never offered here. Shown only once such a server is found, and kept after the last one is
 * removed this visit, so the owner sees that it worked instead of the section vanishing under the pointer.
 */
export function AdvancedMcp({ agent }: { agent: Agent }) {
  const servers = useConnect((s) => s.servers[agent.id])
  const m = useMessages(agentsMessages)
  // A removal reads the servers again; the last answer stays on screen meanwhile, so the list does not blink.
  const last = useRef<Registrations | null>(null)
  if (servers?.state === "ready") last.current = servers.data
  const data = last.current
  const rows =
    data && !data.unread
      ? PROGRAMS.flatMap((tool) => connections(data.names, tool.bin, []).map((row) => ({ tool, profile: row.profile })))
      : []
  const seen = useRef(false)
  if (rows.length > 0) seen.current = true
  return (
    <Collapse open={seen.current}>
      <section aria-label={m.mcpTitle} className="flex flex-col gap-2">
        <h4 className="text-[0.9rem] font-medium text-ink-dim">{m.mcpTitle}</h4>
        <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">
          {rows.length > 0 ? m.mcpIntro(agent.name) : m.mcpGone(agent.name)}
        </p>
        {rows.length > 0 && data && (
          <ul className="flex flex-col gap-1.5" aria-label={m.mcpList(agent.name)}>
            {rows.map(({ tool, profile }) => (
              <ServerRow
                key={serverName(tool.bin, profile)}
                agent={agent}
                toolId={tool.id}
                toolName={tool.name}
                name={serverName(tool.bin, profile)}
                profile={profile}
                canRemove={data.canRemove}
              />
            ))}
          </ul>
        )}
        {data && (
          <p className="text-[0.85rem] text-ink-dim">
            {m.readFrom(<span className="selectable font-mono">{data.source}</span>)}
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-ink-soft">
          {m.mcpChatApps}
          <Button size="sm" variant="ghost" onClick={() => useNav.getState().go("tools")}>
            {m.openTools}
          </Button>
        </p>
      </section>
    </Collapse>
  )
}

function ServerRow(props: {
  agent: Agent
  toolId: string
  toolName: string
  name: string
  profile: string | null
  canRemove: boolean
}) {
  const { agent, toolId, toolName, name, profile, canRemove } = props
  const key = mcpKey(agent.id, toolId, profile)
  const busy = useConnect((s) => s.busy[key] === true)
  const failure = useConnect((s) => s.failures[key])
  const m = useMessages(agentsMessages)
  return (
    <li>
      <div className="flex min-h-8 flex-wrap items-center gap-2 text-[0.9rem]">
        <span className="selectable font-mono text-ink">{name}</span>
        <span className="text-ink-soft">{toolName}</span>
        {canRemove && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={busy}
            onClick={() => askMcpRemove(toolId, profile, agent)}
            aria-label={m.removeServer(name, agent.name)}
          >
            {busy ? m.removing : m.remove}
          </Button>
        )}
      </div>
      {failure && !busy && (
        <ErrorNotice
          inline
          action={<ReportThis what={`Removing ${name} from ${agent.name}`} tool={toolId} error={failure} />}
        >
          {failure}
        </ErrorNotice>
      )}
    </li>
  )
}
