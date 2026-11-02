import { TriangleAlert } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { agentPathFix, CHAT_AGENTS, type CheckTool, chatName } from "@/domain/agents"
import { catalogCommand, findTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { useTools } from "../tools/store"
import { ToolIcon } from "../tools/ToolIcon"
import { useConnect } from "./connect"
import { type ConnectPlan, type StepState, type StepText, useConnectFlow } from "./connect-flow"
import { type AgentsMessages, agentsMessages } from "./messages"
import type { AgentSkill, AgentView } from "./view"

/** A tool Connect cannot install yet says why instead of offering a box to tick. */
function unavailable(s: AgentSkill, m: AgentsMessages): string | null {
  if (s.busy) return m.writing
  if (s.cell.kind === "checking") return m.state.checking
  if (s.cell.kind === "unsupported") return m.needsNewer(s.tool.name)
  if (s.cell.kind === "unknown") return m.updateFirst(s.tool.name)
  return null
}

const STEP_TONE: Record<StepState, LampTone> = {
  waiting: "idle",
  running: "busy",
  ok: "ok",
  warn: "warn",
  failed: "bad",
}

const dirOf = (path: string) => path.replace(/[\\/][^\\/]+$/, "").replace(/^~(?=\/)/, "$HOME")

/** Agents that run commands in an ordinary terminal get the shell-profile line. */
function terminalFix(agent: string, missing: CheckTool[], m: AgentsMessages) {
  const dirs = [...new Set(missing.flatMap((t) => (t.path ? [dirOf(t.path)] : [])))]
  const names = missing.map((t) => t.name)
  return {
    title: m.notOnTerminalPath(names),
    detail: m.terminalFixDetail(names, dirs.length, agent),
    command: dirs.length > 0 && platform.os !== "windows" ? `export PATH="${dirs.join(":")}:$PATH"` : null,
  }
}

const pathFix = (agent: { id: string; name: string }, missing: CheckTool[], m: AgentsMessages) =>
  agentPathFix(agent, missing, m.check, platform.os === "windows") ?? terminalFix(agent.name, missing, m)

function stepText(t: StepText, agent: { id: string; name: string }, m: AgentsMessages): string {
  switch (t.k) {
    case "skill":
      return m.step.skill(t.tool)
    case "readOnly":
      return m.step.readOnly(t.tool, t.profile)
    case "finds":
      return m.step.finds(t.agent)
    case "findsAll":
      return m.step.findsAll(t.agent)
    case "pathFix":
      return pathFix(agent, t.missing, m)[t.part]
    case "stillAllowed":
      return m.step.stillAllowed(t.n, t.tool)
    case "keptBlock":
      return m.step.keptBlock(t.groups)
    case "opened":
      return m.step.opened(t.commands, t.tool)
    case "printed":
      return t.text
    default:
      return m.step[t.k]
  }
}

/** "Connect WireCat to <agent>": choose tools, install each skill with the tool's own command, check the PATH. */
export function ConnectDialog({ view }: { view: AgentView }) {
  const { agent } = view
  const flow = useConnectFlow()
  const open = flow.agent === agent.id
  const profiles = useConnect((s) => s.profiles)
  const installs = useTools((s) => s.installs)
  const running = flow.phase === "running"
  const m = useMessages(agentsMessages)

  const chosen = view.skills.filter((s) => flow.tools.includes(s.tool.id))
  const [tried, setTried] = useState(false)
  const toolsId = useId()
  const noneChosen = tried && chosen.length === 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: each opening starts without the last one's message
  useEffect(() => setTried(false), [open])
  const connect = () => {
    if (chosen.length > 0) return flow.run(plan())
    setTried(true)
    document.getElementById(toolsId)?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus()
  }
  const chat = CHAT_AGENTS.has(agent.id)
  // A tool without per-profile settings would write the level for every profile at once.
  const limitable = (id: string) =>
    (findTool(id)?.permissions?.groups ?? []).length > 0 && findTool(id)?.settings?.perProfile === true
  const unlimited = chosen.filter((s) => !limitable(s.tool.id)).map((s) => s.tool.name)
  const readOnlyChoices = chosen.flatMap((s) => {
    const groups = findTool(s.tool.id)?.permissions?.groups ?? []
    if (!limitable(s.tool.id)) return []
    return (profiles[s.tool.id] ?? []).map((p) => ({
      key: `${s.tool.id}/${p.name}`,
      tool: s.tool,
      profile: p.name,
      groups: groups.map((g) => g.key),
    }))
  })
  // Only a chat-driven agent takes orders from other people; for it, writing is what the owner opts into.
  const readOnly = chat ? readOnlyChoices.filter((c) => !flow.writable.includes(c.key)) : []

  const commands = [
    ...chosen.map((s) => catalogCommand(s.tool, s.tool.skill?.install ?? [], { target: s.target })),
    ...readOnly.flatMap((c) => {
      const set = findTool(c.tool.id)?.settings?.set ?? []
      return c.groups.map((g) =>
        catalogCommand(c.tool, [...set, `permissions.${g}`, "readonly"], { profile: c.profile }),
      )
    }),
  ]

  const plan = (): ConnectPlan => {
    const tools: CheckTool[] = chosen.map((s) => ({
      id: s.tool.id,
      name: s.tool.name,
      bin: s.tool.bin,
      path: installs[s.tool.id]?.[0]?.path ?? null,
    }))
    return {
      agent: { id: agent.id, name: agent.name },
      installs: chosen.map((s) => ({ tool: s.tool.id, name: s.tool.name, target: s.target })),
      readOnly: readOnly.map((c) => ({ tool: c.tool.id, name: c.tool.name, profile: c.profile, groups: c.groups })),
      tools,
      pathCommand: (missing) => pathFix(agent, missing, m).command,
    }
  }

  return (
    <Dialog
      open={open}
      wide
      scroll
      title={m.connectTo(agent.name)}
      onClose={() => !running && flow.close()}
      actions={
        flow.phase === "choose" ? (
          <>
            <Button variant="ghost" onClick={flow.close}>
              {m.cancel}
            </Button>
            <Button variant="primary" onClick={connect}>
              {chosen.length === 0 ? m.connect : m.connectTools(chosen.length)}
            </Button>
          </>
        ) : (
          <Button variant="secondary" data-autofocus disabled={running} onClick={flow.close}>
            {running ? m.connecting : m.close}
          </Button>
        )
      }
    >
      {open && flow.phase === "choose" ? (
        <div className="flex flex-col gap-4">
          <p className="max-w-[70ch] text-[0.95rem] text-ink-soft">{m.connectIntro(agent.name)}</p>
          <fieldset
            id={toolsId}
            className="flex flex-col gap-1"
            aria-describedby={noneChosen ? `${toolsId}-none` : undefined}
          >
            <legend className="mb-1 text-[0.9rem] font-medium text-ink-dim">{m.tools}</legend>
            {view.skills.map((s) => {
              const why = unavailable(s, m)
              const id = `connect-${agent.id}-${s.tool.id}`
              return (
                <label
                  key={s.tool.id}
                  htmlFor={id}
                  className="flex min-h-9 items-center gap-3 rounded-[0.35rem] px-2 hover:bg-app-3/60"
                >
                  <Checkbox
                    id={id}
                    checked={flow.tools.includes(s.tool.id)}
                    disabled={why !== null}
                    onChange={() => flow.toggleTool(s.tool.id)}
                  />
                  <ToolIcon id={s.tool.id} className="size-[1.15rem] shrink-0 text-ink" />
                  <span className="font-semibold">{s.tool.name}</span>
                  <span className="text-[0.9rem] text-ink-soft">{why ?? m.state[s.cell.kind]}</span>
                </label>
              )
            })}
          </fieldset>
          <Collapse open={noneChosen}>
            <ErrorNotice inline>
              <span id={`${toolsId}-none`}>{m.chooseATool}</span>
            </ErrorNotice>
          </Collapse>
          {chat && <ChatWarning agentName={agent.name} />}
          {chat && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-[0.9rem] font-medium text-ink-dim">{m.readOnly}</legend>
              <p className="mb-1 max-w-[70ch] text-[0.9rem] text-ink-soft">{m.readOnlyIntro(agent.name)}</p>
              {chosen.length === 0 && <p className="text-[0.9rem] text-ink-dim">{m.chooseTool}</p>}
              {unlimited.length > 0 && (
                <p className="max-w-[70ch] text-[0.9rem] text-warn">{m.cannotLimit(unlimited, agent.name)}</p>
              )}
              {readOnlyChoices.length > 0 &&
                readOnlyChoices.map((c) => {
                  const id = `connect-ro-${c.key}`
                  return (
                    <label key={c.key} htmlFor={id} className="flex min-h-8 items-center gap-3 px-2">
                      <Checkbox
                        id={id}
                        checked={!flow.writable.includes(c.key)}
                        onChange={() => flow.toggleWritable(c.key)}
                      />
                      <span>
                        {c.tool.name} · <span className="font-medium">{c.profile}</span>
                      </span>
                    </label>
                  )
                })}
            </fieldset>
          )}
          {commands.length > 0 && (
            <div>
              <span className="text-[0.9rem] font-medium text-ink-dim">{m.appRuns}</span>
              <code className="selectable mt-1 block max-h-[10rem] overflow-y-auto rounded-[0.4rem] border border-line bg-app-2 px-3 py-2 font-mono text-[0.9rem] break-all whitespace-pre-wrap text-ink">
                {commands.join("\n")}
              </code>
            </div>
          )}
        </div>
      ) : open ? (
        <Steps agent={agent} />
      ) : null}
    </Dialog>
  )
}

function ChatWarning({ agentName }: { agentName: string }) {
  const chats = useConnectFlow((s) => s.chats)
  const m = useMessages(agentsMessages)
  if (!chats || chats.state === "loading")
    return <Skeleton className="h-[4.5rem] w-full" label={m.readingChats(agentName)} />
  const apps = chats.state === "ready" ? chats.data.channels.map(chatName) : []
  if (chats.state === "ready" && apps.length === 0)
    return <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.noChats(agentName)}</p>
  const stopped = chats.state === "ready" && chats.data.running === false
  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-[0.35rem] border border-warn/40 bg-warn/10 px-4 py-3 text-[0.95rem]"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <p className="max-w-[70ch]">
        {chats.state === "ready" ? m.chatsReady(agentName, apps, stopped) : m.chatsFailed(agentName, chats.error)}
      </p>
    </div>
  )
}

function Steps({ agent }: { agent: { id: string; name: string } }) {
  const steps = useConnectFlow((s) => s.steps)
  const m = useMessages(agentsMessages)
  // The Connect button that had focus is gone once the steps replace the form.
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => list.current?.focus(), [])
  return (
    <ol
      ref={list}
      tabIndex={-1}
      className="flex flex-col divide-y divide-line rounded-[0.45rem] border border-line outline-none"
      aria-label={m.steps}
    >
      {steps.map((step) => {
        const label = stepText(step.label, agent, m)
        const detail = step.detail.map((t) => stepText(t, agent, m)).join(" ")
        return (
          <li key={step.key} className="flex flex-col gap-2 px-4 py-2.5" aria-live="polite">
            <div className="flex items-start gap-2.5">
              <span className="mt-[0.4rem]">
                <Lamp size="sm" tone={STEP_TONE[step.state]} label={`${label}: ${m.stepState[step.state]}`} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] text-ink">{label}</p>
                {detail && <p className="mt-0.5 max-w-[70ch] text-[0.9rem] text-ink-soft">{detail}</p>}
              </div>
            </div>
            {step.command && (
              <div className="pl-6">
                <CopyField value={step.command} label={m.copyCommand} />
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
