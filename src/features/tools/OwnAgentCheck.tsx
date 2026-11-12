import { useState } from "react"
import { AgentLaunch, AgentRunNote, runAgent, useLaunchable, useStartableAgents } from "@/features/fix"
import { useMessages } from "@/i18n"
import type { AgentRun } from "@/platform/agents-schemas"
import type { OwnReview } from "@/platform/bindings"
import { Collapse } from "@/ui/Collapse"
import { CopyButton } from "@/ui/CopyButton"
import { Disclosure } from "@/ui/Disclosure"
import { type OwnReviewText, ownReviewMessages } from "./messages-own-review"

const checkPrompt = (review: OwnReview, r: OwnReviewText) =>
  r.check.prompt({
    pkg: review.package,
    version: review.version,
    tarball: review.tarball,
    integrity: review.integrity,
    repo: review.repo,
    commit: review.commit,
  })

/**
 * Offered after Add and before "Install and run": the owner's agent reads the exact package file reviewed. It opens
 * like a guide's Open in (`run_agent`), or the owner copies the prompt when no agent WireCat can start is found.
 */
export function OwnAgentCheck({ review, onRun }: { review: OwnReview; onRun(run: AgentRun | null): void }) {
  const r = useMessages(ownReviewMessages)
  const agents = useStartableAgents()
  const launchable = useLaunchable()
  const [run, setRun] = useState<{ agent: string; result: AgentRun | null } | null>(null)
  const prompt = checkPrompt(review, r)
  const open = async (id: string) => {
    setRun({ agent: id, result: null })
    const result = await runAgent(id, prompt)
    setRun({ agent: id, result })
    onRun(result)
  }
  const agent = launchable?.find((a) => a.id === run?.agent)
  return (
    <div className="flex flex-col gap-3 text-[0.95rem]">
      <p>{r.check.body}</p>
      {agents !== null && agents.length === 0 && <p className="text-ink-soft">{r.check.noAgent}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <AgentLaunch
          label={r.check.with}
          openingLabel={r.check.opening}
          opening={run && !run.result ? run.agent : null}
          onOpen={(a) => open(a.id)}
        />
        <CopyButton
          value={prompt}
          label={r.check.copyLabel}
          text={r.check.copy}
          variant={agents !== null && agents.length === 0 ? "primary" : "ghost"}
          onCopied={() => onRun(null)}
        />
      </div>
      <div aria-live="polite">
        <Collapse open={Boolean(run?.result && agent)}>
          {run?.result && agent && (
            <AgentRunNote run={run.result} name={agent.name} started={r.check.started(agent.name)} />
          )}
        </Collapse>
      </div>
      <Disclosure summary={r.check.show}>
        <pre className="selectable max-h-56 overflow-auto whitespace-pre-wrap rounded-control bg-app-2 p-3 font-mono text-[0.85rem]">
          {prompt}
        </pre>
      </Disclosure>
    </div>
  )
}
