import { CheckCircle2 } from "lucide-react"
import { useId, useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FixButton, FixPanel } from "../fix/AgentFix"
import { agentsMessages } from "./messages"
import { usePathFix } from "./path-fix"

export function PathFixButton({ tools, label }: { tools: readonly string[]; label?: string }) {
  const m = useMessages(agentsMessages).pathFix
  const fixing = usePathFix((s) => s.status.state === "fixing")
  return (
    <Button size="sm" disabled={fixing} onClick={() => usePathFix.getState().fix(tools)}>
      {fixing ? m.fixing : (label ?? m.fix)}
    </Button>
  )
}

/** What the last Fix changed, and the one thing left for the owner: a restart, or a line to add by hand. */
export function PathFixResult({ agent, manual }: { agent: string; manual: string | null }) {
  const m = useMessages(agentsMessages)
  const status = usePathFix((s) => s.status)
  const shown = status.state === "done" || status.state === "failed"
  const [fixOpen, setFixOpen] = useState(false)
  const fixId = useId()
  const line = status.state === "done" ? status.fix.manual : status.state === "failed" ? manual : null
  return (
    <Collapse open={shown}>
      <div className="flex flex-col gap-2 pt-2">
        {status.state === "done" && status.fix.manual === null && (
          <p className="flex items-start gap-2 text-[0.9rem] text-ink">
            <CheckCircle2 aria-hidden className="mt-[0.15rem] size-4 shrink-0 text-ok" />
            <span aria-live="polite">
              {status.fix.added.length > 0
                ? m.pathFix.added(status.fix.added.join(", "), status.fix.file, agent)
                : m.pathFix.already(agent)}
            </span>
          </p>
        )}
        {status.state === "failed" && (
          <>
            <ErrorNotice
              inline
              detail={status.error}
              action={<FixButton open={fixOpen} controls={fixId} onClick={() => setFixOpen((o) => !o)} />}
            >
              {m.pathFix.failed}
            </ErrorNotice>
            <FixPanel
              id={fixId}
              open={fixOpen}
              problem={{
                what: "Adding the folders of WireCat tools to the user's PATH",
                error: status.error,
                hint: manual ? `Add this line to the shell's startup file: ${manual}` : null,
              }}
            />
          </>
        )}
        {line && (
          <>
            <p className="max-w-[70ch] text-[0.9rem] text-ink-soft">{m.pathFix.manual}</p>
            <CopyField value={line} label={m.copyCommand} />
          </>
        )}
      </div>
    </Collapse>
  )
}
