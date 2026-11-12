import { type ReactNode, useState } from "react"
import { AgentLaunch, AgentRunNote, runAgent, useLaunchable } from "@/features/fix"
import { useMessages } from "@/i18n"
import type { AgentRun } from "@/platform/agents-schemas"
import { Collapse } from "@/ui/Collapse"
import { CopyTextButton } from "@/ui/CopyTextButton"
import { sortMessages } from "./messages-sort"

/**
 * The owner's agent sorts the matches: memo lets only the owner decide them, so the agent ends with the commands the
 * owner runs. The prompt is copied, or the agent opens with it in a terminal; `children` follow the two buttons.
 */
export function SortWithAgent({ children }: { children?: ReactNode }) {
  const m = useMessages(sortMessages)
  const agents = useLaunchable()
  const [run, setRun] = useState<{ agent: string; result: AgentRun | null } | null>(null)
  const open = async (id: string) => {
    setRun({ agent: id, result: null })
    setRun({ agent: id, result: await runAgent(id, m.prompt) })
  }
  const name = agents?.find((a) => a.id === run?.agent)?.name ?? run?.agent ?? ""
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <CopyTextButton text={m.prompt} label={m.copyPrompt} />
        <AgentLaunch
          label={() => m.runInTerminal}
          openingLabel={m.opening}
          opening={run && !run.result ? run.agent : null}
          onOpen={(a) => open(a.id)}
        />
        {children}
      </span>
      {/* The banner's row gap would leave space under it while closed: the note brings its own. */}
      <div aria-live="polite" className="-mt-3 basis-full">
        <Collapse open={Boolean(run?.result)}>
          {run?.result && (
            <div className="pt-3">
              <AgentRunNote run={run.result} name={name} started={m.started(name)} />
            </div>
          )}
        </Collapse>
      </div>
    </>
  )
}
