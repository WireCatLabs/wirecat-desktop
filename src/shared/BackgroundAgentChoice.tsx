import { LoaderCircle } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useMessages } from "@/i18n"
import type { BackgroundAgents } from "@/platform/background-agent-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { useBackgroundAgents } from "./background-agent-store"
import { backgroundAgentMessages } from "./messages-background-agent"

export const agentName = (names: Record<string, string>, id: string) => names[id] ?? id

/** Loads the agents once per page that shows them; Settings and the mail agent share the answer. */
export function useAgentsLoaded(): BackgroundAgents | null {
  const agents = useBackgroundAgents((s) => s.agents)
  useEffect(() => {
    void useBackgroundAgents.getState().load()
  }, [])
  return agents
}

/**
 * The owner's pick of Claude Code or Codex. "Not chosen" stays until he picks, even with one agent listed first; with
 * only one installed, the line under the list says that one runs the jobs.
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
  const installed = agents.agents.filter((a) => a.installed)
  if (installed.length === 0) return <p className="text-[0.95rem] text-ink-soft">{m.none}</p>
  const marked = picked ?? agents.chosen
  const shown = agents.agents.find((a) => a.id === marked)
  const only = agents.chosen === null && installed.length === 1 ? installed[0] : undefined
  const state = (a: (typeof agents.agents)[number]) =>
    !a.installed ? m.notInstalled : a.signedIn === false ? m.notSignedIn : m.installed
  return (
    <div className="flex max-w-[40rem] flex-col gap-3">
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
        options={agents.agents.map((a) => ({ value: a.id, label: `${agentName(m.names, a.id)} · ${state(a)}` }))}
      />
      {need.hint}
      {only && marked === null && (
        <p className="text-[0.9rem] text-ink-soft">{m.onlyOne(agentName(m.names, only.id))}</p>
      )}
      {shown?.id === "codex" && <p className="text-[0.9rem] text-ink-soft">{m.codexNoCap}</p>}
      <span>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            if (marked === null) return need.fail(m.need)
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
