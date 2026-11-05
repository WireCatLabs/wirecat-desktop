import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { type CatalogTool, ownerId, samePackage } from "@/domain/catalog"
import { formatBytes } from "@/domain/format"
import { agentsReading } from "@/domain/skills"
import { type DataDeletion, type InstallOutcome, type InstallSession, type SkillRefresh, STEPS } from "@/domain/status"
import { FixButton, FixPanel } from "@/features/fix"
import { formatList, useMessages } from "@/i18n"
import { useAgents } from "@/shared/agents-store"
import { useNav } from "@/shared/nav"
import { ReportThis } from "@/shared/ReportThis"
import { useTools } from "@/shared/tools-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Stepper, type StepState } from "@/ui/Stepper"
import { failureWords, failureWordsEn, useFailureMessages } from "./failure-words"
import { InstallProgress } from "./InstallProgress"
import { type ToolsText, toolsMessages } from "./messages"
import { SkillOffer } from "./SkillOffer"

type Words = ToolsText["install"]

/** The tool's package as one name list, in the reader's language: "Memo and Email". */
export const packageNamesOf = (id: string) => formatList(samePackage(id).map((t) => t.name))

function stepStates(session: InstallSession, m: Words): { label: string; state: StepState }[] {
  const labels = m.steps[session.operation]
  const steps = STEPS[session.operation].map((s) => ({ step: s.step, label: labels[s.step] ?? s.step }))
  const failed = session.outcome?.event === "failed"
  if (session.step === "queued" && !session.outcome) return steps.map((s) => ({ label: s.label, state: "todo" }))
  const finished = session.outcome?.event === "done" || session.outcome?.event === "removed"
  const current = finished ? steps.length : steps.findIndex((s) => s.step === session.step)
  return steps.map((s, i) => ({
    label: s.label,
    state: i < current ? "done" : i === current ? (failed ? "failed" : session.outcome ? "done" : "active") : "todo",
  }))
}

export function InstallPanel({ tool }: { tool: CatalogTool }) {
  const session = useTools((s) => s.sessions[ownerId(tool.id)])
  const shared = samePackage(tool.id).length > 1
  const { install, uninstall, dismiss } = useTools.getState()
  const [showLog, setShowLog] = useState(false)
  const [fixOpen, setFixOpen] = useState(false)
  const fixId = useId()
  const m = useMessages(toolsMessages).install
  if (!session) return null
  const outcome = session.outcome
  const names = packageNamesOf(tool.id)
  const offersSkill =
    outcome?.event === "done" && session.operation === "install" && !outcome.skills && Boolean(tool.skill)

  return (
    <div className="border-line border-t bg-app-2/60 px-[1.3rem] pt-[2rem] pb-[1.6rem]">
      <div className="mx-auto max-w-[62rem]">
        <Stepper steps={stepStates(session, m)} />
      </div>

      <Collapse open={session.operation === "install" && session.step !== "queued" && !outcome}>
        <div className="mx-auto mt-[1.6rem] max-w-[62rem]">
          <InstallProgress session={session} />
        </div>
      </Collapse>

      {/* The result arrives in place of the progress: the height follows and each new line fades in. */}
      <AutoHeight swap={outcome?.event ?? session.step}>
        <div className="mt-[1.45rem] flex flex-wrap items-center gap-x-4 gap-y-3" aria-live="polite">
          {session.step === "queued" && !outcome && <p className="text-[0.95rem] text-ink-soft">{m.waiting}</p>}
          {outcome?.event === "done" && (
            <p className="reveal flex items-center gap-2 text-[0.95rem]">
              <CheckCircle2 className="size-5 text-ok" aria-hidden />
              <span>{m.installed(names, outcome.version, shared)}</span>
            </p>
          )}
          {outcome?.event === "removed" && (
            <p className="reveal flex items-center gap-2 text-[0.95rem]">
              <CheckCircle2 className="size-5 text-ok" aria-hidden />
              <span>
                {m.removed(names, shared)} {session.data ? <DataResult data={session.data} m={m} /> : m.dataKept}
              </span>
            </p>
          )}
          {outcome?.event === "removed" && session.data?.state === "failed" && (
            <ErrorNotice
              inline
              className="w-full"
              action={<ReportThis what={`Deleting ${tool.name}'s data`} tool={tool.id} error={session.data.message} />}
            >
              {session.data.message}
            </ErrorNotice>
          )}
          {outcome?.event === "failed" && (
            <div className="reveal flex min-w-0 items-start gap-2 text-[0.95rem]">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
              <FailureText outcome={outcome} operation={session.operation} untouched={Boolean(session.data)} m={m} />
            </div>
          )}
          {outcome?.event === "done" && outcome.skills && <SkillsResult skills={outcome.skills} m={m} />}
          {offersSkill && <SkillOffer tool={tool} />}
          {outcome?.event === "done" && outcome.shadowedBy && (
            <p className="w-full text-[0.9rem] text-warn-ink">
              {m.shadowed(<code className="font-mono">{outcome.shadowedBy}</code>)}
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            aria-expanded={showLog}
            className="inline-flex items-center gap-1 text-[1.05rem] font-medium text-brand hover:text-brand-hover"
          >
            {showLog ? m.hideLog : m.showLog}
            <ExpandChevron open={showLog} className="text-current" />
          </button>

          <div key={outcome?.event ?? "running"} className="reveal ml-auto flex gap-2">
            {outcome?.event === "failed" && outcome.reason !== "cancelled" && (
              <ReportThis
                what={`${session.operation === "install" ? "Installing" : "Uninstalling"} ${tool.name}`}
                tool={tool.id}
                error={[outcome.message, outcome.hint].filter(Boolean).join(" ")}
                log={session.log.slice(-200)}
              />
            )}
            {outcome?.event === "failed" && outcome.reason !== "cancelled" && (
              <FixButton open={fixOpen} controls={fixId} onClick={() => setFixOpen((o) => !o)} />
            )}
            {outcome?.event === "failed" && outcome.reason !== "cancelled" && (
              <Button
                size="sm"
                variant="secondary"
                icon={<RotateCcw className="size-4" aria-hidden />}
                onClick={() =>
                  session.operation === "install" ? install(tool.id) : uninstall(tool.id, session.data?.bytes)
                }
              >
                {m.tryAgain}
              </Button>
            )}
            {outcome?.event === "done" && session.operation === "install" && tool.profiles && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  dismiss(tool.id)
                  useTools.setState({ expanded: tool.id })
                }}
              >
                {m.addAccount}
              </Button>
            )}
            {outcome && (
              <Button
                size="sm"
                // The skill offer's button is the next thing to do; Done steps back beside it.
                variant={outcome.event === "failed" ? "ghost" : offersSkill ? "secondary" : "primary"}
                onClick={() => dismiss(tool.id)}
              >
                {outcome.event === "failed" ? m.close : m.done}
              </Button>
            )}
          </div>
        </div>
      </AutoHeight>

      {outcome?.event === "failed" && (
        <FixPanel
          id={fixId}
          open={fixOpen}
          problem={{
            what: `${session.operation === "install" ? "Installing" : "Uninstalling"} ${tool.name} (${tool.package})`,
            error: failureWordsEn(outcome, session.operation)[0],
            hint: failureWordsEn(outcome, session.operation)[1],
            log: session.log,
          }}
        />
      )}
      <Collapse open={showLog}>
        <Log lines={session.log} m={m} />
      </Collapse>
    </div>
  )
}

function SkillsResult({ skills, m }: { skills: SkillRefresh; m: Words }) {
  const agents = useAgents((s) => s.agents)
  if (skills.failed)
    return (
      <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.9rem]">
        <p className="flex min-w-0 flex-1 basis-[16rem] items-start gap-2 text-warn-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="selectable">
            {m.skillsFailed} {skills.failed}
          </span>
        </p>
        <Button size="sm" variant="secondary" onClick={() => useNav.getState().go("agents")}>
          {m.openAgents}
        </Button>
      </div>
    )
  if (skills.refreshed.length === 0) return null
  return (
    <p className="w-full text-[0.95rem] text-ink-soft">
      {m.skillsRefreshed(formatList(agentsReading(skills.refreshed, agents, m.otherAgents)))}
    </p>
  )
}

function DataResult({ data, m }: { data: DataDeletion; m: Words }) {
  if (data.state === "deleted") return <>{m.dataDeleted(formatBytes(data.bytes))}</>
  if (data.state === "failed") return <>{m.dataFailed}</>
  return <>{m.dataDeleting}</>
}

type Failed = Extract<InstallOutcome, { event: "failed" }>

/** Rust's reasons with one fixed sentence are told in the reader's language; the rest name the program or path. */
function FailureText(props: { outcome: Failed; operation: InstallSession["operation"]; untouched: boolean; m: Words }) {
  const { outcome, operation, untouched, m } = props
  const [message, hint] = failureWords(outcome, operation, useFailureMessages())
  return (
    <p>
      <span className="font-medium text-ink">{message}</span>
      {hint && <span className="text-ink-soft"> {hint}</span>}
      {untouched && <span className="text-ink-soft"> {m.dataUntouched}</span>}
    </p>
  )
}

function Log({ lines, m }: { lines: string[]; m: Words }) {
  const ref = useRef<HTMLPreElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the bottom whenever a line arrives
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [lines.length])
  return (
    <pre
      ref={ref}
      role="log"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard (WCAG 2.1.1)
      tabIndex={0}
      aria-label={m.log}
      className="selectable mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-[0.4rem] [overflow-wrap:anywhere] border border-line bg-app p-3 font-mono text-[0.85rem] leading-relaxed text-ink-soft"
    >
      {lines.length ? lines.join("\n") : m.waitingOutput}
    </pre>
  )
}
