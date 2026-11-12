import { type ReactNode, useEffect, useId } from "react"
import { useMessages } from "@/i18n"
import type { BackgroundAgent, BackgroundAgents } from "@/platform/background-agent-schemas"
import type { DigestItem, DigestSpec } from "@/platform/bindings"
import {
  agentName,
  agentState,
  BackgroundAgentChoice,
  costed,
  otherAgent,
  useAgentsLoaded,
  useAgentWarning,
} from "@/shared/BackgroundAgentChoice"
import { backgroundAgentMessages } from "@/shared/messages-background-agent"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Select } from "@/ui/Select"
import { type BookText, bookMessages } from "./messages-book"
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
    warning.ask(agent, () => void save({ ...specOf(item, title, remembered), agent, model: null }, false))
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

/** memo's refusals of a save in plain words, or null for the rest. */
export const refusalOf = (message: string, m: BookText["form"]) =>
  message === "digest.agent-unchosen" ? m.agentUnchosen : message === "agent.cost-unknown" ? m.costUnknown : null

/** The owner's choice: a new digest is written by Claude Code where it may run. */
const PREFERRED = "claude"

/** A digest may run in an agent memo starts and limits; one that needs a warning is not offered for digests yet. */
const runs = (a: BackgroundAgent) => a.state === "ready" && !a.needsAck

/** The agent a new digest starts with: Claude Code, else the agent for background jobs, else the only one that runs. */
export function firstAgent(agents: BackgroundAgents | null): string | null {
  const offered = agents?.agents.filter(runs) ?? []
  const pick = (id: string | null) => offered.find((a) => a.id === id)?.id
  return pick(PREFERRED) ?? pick(agents?.effective ?? null) ?? (offered.length === 1 ? offered[0]?.id : null) ?? null
}

/** The agent a draft runs in: its own, else the one a new digest starts with, as Rust picks it. */
export const draftAgent = (spec: DigestSpec, agents: BackgroundAgents | null) =>
  spec.agent ?? agents?.effective ?? PREFERRED

const input =
  "h-8 w-[14rem] rounded-[0.3rem] border border-line-strong bg-app px-2 text-[0.9rem] text-ink focus-visible:outline-2 focus-visible:outline-brand"

/**
 * The agent that writes the digest and its model, for a memo that takes them. The agents are the ones found for
 * background jobs: one that cannot run a job is greyed with the reason, as in Settings.
 */
export function AgentFields({
  spec,
  set,
  creating,
  saved,
  field,
}: {
  spec: DigestSpec
  set: (part: Partial<DigestSpec>) => void
  creating: boolean
  /** memo holds a model for this digest now, so an emptied field must say so. */
  saved: boolean
  field: (props: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) => ReactNode
}) {
  const m = useMessages(bookMessages).form
  const a = useMessages(backgroundAgentMessages)
  const agents = useAgentsLoaded()
  const ids = { agent: useId(), model: useId() }
  const first = firstAgent(agents)
  useEffect(() => {
    if (creating && spec.agent === null && first) set({ agent: first, model: null })
  }, [creating, spec.agent, first, set])
  const listed = agents?.agents ?? null
  const other = spec.agent !== null && listed !== null && !listed.some((x) => x.id === spec.agent)
  const none = listed !== null && !listed.some(runs)

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-[1.1rem]">
      {field({
        label: m.agent,
        hint: m.agentHint,
        ...(none ? {} : { htmlFor: ids.agent }),
        children: none ? (
          <p className="text-ink-dim">{m.agentNone}</p>
        ) : (
          <>
            <Select
              id={ids.agent}
              className="w-[14rem]"
              size="sm"
              value={other ? "" : (spec.agent ?? "")}
              placeholder={other ? m.agentOther : m.agentPick}
              disabled={listed === null}
              options={(listed ?? []).map((x) => ({
                value: x.id,
                label: runs(x) ? x.name : `${x.name} · ${agentState(a, x)}`,
                disabled: !runs(x),
              }))}
              // memo gives another agent its own default model, not the old agent's.
              onChange={(agent) => agent !== spec.agent && set({ agent, model: null })}
            />
            {other && <p className="max-w-[28rem] text-[0.85rem] text-ink-dim">{m.agentOtherHint}</p>}
          </>
        ),
      })}
      {field({
        label: m.model,
        hint: m.modelHint,
        htmlFor: ids.model,
        children: (
          <input
            id={ids.model}
            value={spec.model ?? ""}
            placeholder={m.modelPlaceholder}
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            // Emptied after memo had one: `--model=` says the agent's own default; never set: memo's default stays.
            onChange={(e) => set({ model: e.target.value === "" && !saved ? null : e.target.value })}
            className={input}
          />
        ),
      })}
    </div>
  )
}
