import { LoaderCircle } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useMessages } from "@/i18n"
import type { BackgroundAgent, BackgroundAgents } from "@/platform/background-agent-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { useBackgroundAgents } from "./background-agent-store"
import { openTool } from "./go-tool"
import { type BackgroundAgentText, backgroundAgentMessages } from "./messages-background-agent"

/** The agent's own name from the list, or its id for one the list no longer has. */
export const agentName = (agents: BackgroundAgents | null, id: string) =>
  agents?.agents.find((a) => a.id === id)?.name ?? id

/** Only an agent that reports what a run costs can be held to a cap; one the list does not know, only claude. */
export const costed = (agents: BackgroundAgents | null, id: string) =>
  agents?.agents.find((a) => a.id === id)?.reportsCost ?? id === "claude"

/**
 * The agent to offer when `failing` refused a run: the one chosen for background jobs, or the only other one ready.
 * `undefined` with several others ready: the owner picks, nothing is picked for him.
 */
export function otherAgent(agents: BackgroundAgents | null, failing: string | null) {
  const others = (agents?.agents ?? []).filter((a) => a.state === "ready" && a.id !== failing).map((a) => a.id)
  const effective = agents?.effective ?? null
  const instead = effective !== null && effective !== failing ? effective : others.length === 1 ? others[0] : undefined
  return { instead, pick: instead === undefined && others.length > 1 }
}

/** Loads the agents once per page that shows them; Settings, the mail agent and the digests share the answer. */
export function useAgentsLoaded(): BackgroundAgents | null {
  const agents = useBackgroundAgents((s) => s.agents)
  useEffect(() => {
    void useBackgroundAgents.getState().load()
  }, [])
  return agents
}

const stateOf = (m: BackgroundAgentText, a: BackgroundAgent) =>
  a.state === "ready" && a.signedIn === false ? m.notSignedIn : m.states[a.state]

/**
 * The owner's pick among the agents found. Every one is listed: those that cannot run a job are greyed with the
 * reason, never left out. "Not chosen" stays until he picks; with one ready, the line under the list says it runs.
 */
export function BackgroundAgentChoice({ describedBy }: { describedBy?: string }) {
  const m = useMessages(backgroundAgentMessages)
  const agents = useAgentsLoaded()
  const error = useBackgroundAgents((s) => s.error)
  const chooseError = useBackgroundAgents((s) => s.chooseError)
  const busy = useBackgroundAgents((s) => s.busy)
  const name = useId()
  const [picked, setPicked] = useState<string | null>(null)
  const need = useFieldError(`${name}-agent`)

  if (error)
    return (
      <ErrorNotice raw={error} inline>
        {m.failed}
      </ErrorNotice>
    )
  if (!agents)
    return (
      <div className="flex max-w-[40rem] flex-col gap-3">
        <Skeleton className="h-[2.4rem] w-full" label={m.looking} />
        <Skeleton className="h-8 w-32" />
      </div>
    )
  const ready = agents.agents.filter((a) => a.state === "ready")
  const marked = picked ?? agents.chosen
  const shown = agents.agents.find((a) => a.id === marked)
  const only = agents.chosen === null && ready.length === 1 ? ready[0] : undefined
  const greyed = agents.agents.some((a) => a.state !== "ready")
  const runs = shown?.state === "ready" ? shown : only
  return (
    <div className="flex max-w-[40rem] flex-col gap-3">
      {ready.length === 0 && <p className="text-[0.95rem] text-warn-ink">{m.none}</p>}
      <Select
        id={`${name}-agent`}
        className="w-full"
        aria-label={m.heading}
        placeholder={m.pick}
        value={marked ?? ""}
        busy={busy}
        aria-invalid={need.field["aria-invalid"]}
        aria-describedby={need.error ? `${name}-agent-error ${describedBy ?? ""}` : describedBy}
        onChange={(id) => {
          setPicked(id)
          need.clear()
        }}
        options={agents.agents.map((a) => ({
          value: a.id,
          label: `${a.name} · ${stateOf(m, a)}`,
          disabled: a.state !== "ready",
        }))}
      />
      {need.hint}
      {only && marked === null && <p className="text-[0.9rem] text-ink-soft">{m.onlyOne(only.name)}</p>}
      {runs && !runs.reportsCost && <p className="text-[0.9rem] text-ink-soft">{m.noCost(runs.name)}</p>}
      {agents.agents
        .filter((a) => a.state === "unrestricted" && a.reason)
        .map((a) => (
          <p key={a.id} className="text-[0.9rem] text-ink-soft">
            {a.name}: {a.reason}
          </p>
        ))}
      {greyed && <p className="text-[0.9rem] text-ink-soft">{m.greyed}</p>}
      {!agents.listed && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.9rem] text-ink-soft">{m.oldMemo}</p>
          <Button size="sm" variant="secondary" onClick={() => openTool("memo")}>
            {m.openMemo}
          </Button>
        </div>
      )}
      <span>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            if (marked === null) return need.fail(m.need)
            if (shown?.state !== "ready") return need.fail(m.notReady)
            if (marked === agents.chosen) return need.fail(m.same)
            void useBackgroundAgents.getState().choose(marked)
          }}
          icon={busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : undefined}
        >
          {m.use}
        </Button>
      </span>
      <Collapse open={chooseError !== null}>
        <ErrorNotice raw={chooseError} inline>
          {m.chooseFailed}
        </ErrorNotice>
      </Collapse>
    </div>
  )
}
