import { findTool } from "@/domain/catalog"
import { agentName, termText } from "@/domain/runs"
import { useLogs } from "@/features/logs"
import { useMessages } from "@/i18n"
import { useNav } from "@/shared/nav"
import { PageHeader } from "@/shared/Page"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { EmptyState } from "@/ui/EmptyState"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { LinkButton } from "@/ui/LinkButton"
import { RefreshButton } from "@/ui/RefreshButton"
import { Skeleton } from "@/ui/Skeleton"
import { openManage } from "./AgentDetails"
import { ClaimRow } from "./ClaimRow"
import { ConfirmCommand } from "./Confirm"
import { pairKey } from "./connect"
import { agentsMessages } from "./messages"
import { SkillPreview } from "./SkillPreview"
import type { AgentsView } from "./view"

const box = "rounded-[0.45rem] border border-line bg-app"

export function PageHead({ view }: { view: AgentsView }) {
  const m = useMessages(agentsMessages)
  return (
    <PageHeader
      title={m.title}
      intro={m.intro}
      actions={
        <RefreshButton
          busy={view.checking}
          disabled={view.anyBusy}
          onClick={view.checkAll}
          label={m.checkAgain}
          busyLabel={m.checking}
        />
      }
    />
  )
}

export function Notices({ view }: { view: AgentsView }) {
  const m = useMessages(agentsMessages)
  const noneFound = view.found !== null && view.found.length === 0
  return (
    <>
      {view.agentsError && (
        <ErrorNotice
          raw={view.agentsError}
          action={<ReportThis what="Looking for AI agents" error={view.agentsError} />}
        >
          {m.lookFailed}
        </ErrorNotice>
      )}
      {!view.agentsError && noneFound && <ErrorNotice tone="warn">{m.noAgent}</ErrorNotice>}
      {view.toolsKnown && view.rows.length === 0 && <EmptyState>{m.noTool}</EmptyState>}
    </>
  )
}

/** Things that belong to no agent on this list, last on the page. */
export function Elsewhere({ view }: { view: AgentsView }) {
  const m = useMessages(agentsMessages)
  const { pending, otherClaims, claimErrors, signedOutTasks, unknownRuns } = view.elsewhere
  if (pending) return <Skeleton className="h-[3rem] w-full max-w-[80ch]" label={m.readingElsewhere} />
  if (otherClaims.length === 0 && claimErrors.length === 0 && signedOutTasks.length === 0 && unknownRuns === 0)
    return null
  return (
    <div className="flex max-w-[80ch] flex-col gap-2 text-[0.9rem] text-ink-soft">
      {unknownRuns > 0 && <p>{m.unknownRuns(unknownRuns)}</p>}
      {signedOutTasks.map(({ tool, profiles }) => (
        <p key={`signed-out:${tool}`}>
          {m.signedOutTasks(
            findTool(tool)?.name ?? tool,
            profiles,
            <LinkButton onClick={() => openManage(tool)}>{m.signIn}</LinkButton>,
          )}
        </p>
      ))}
      {claimErrors.map(({ key, error }) => {
        const [tool, profile] = key.split("/")
        const name = findTool(tool ?? "")?.name ?? tool
        return (
          <ErrorNotice
            key={key}
            inline
            action={<ReportThis what={`Reading the tasks of ${name} (${profile})`} tool={tool ?? null} error={error} />}
          >
            {m.claimReadFailed(name ?? "", profile ?? "", error)}
          </ErrorNotice>
        )
      })}
      {otherClaims.length > 0 && (
        <Disclosure summary={m.heldByOthers(otherClaims.length)}>
          <ul className={cx(box, "divide-y divide-line")}>
            {otherClaims.map((c) => {
              const who =
                c.holder.type === "owner"
                  ? m.you
                  : c.holder.type === "agent"
                    ? agentName(c.holder.kind, m.mcpApp)
                    : c.holder.name
              return (
                <ClaimRow key={pairKey(c.tool.id, c.profile) + c.claim.id} c={{ ...c, session: null }} holder={who} />
              )
            })}
          </ul>
        </Disclosure>
      )}
    </div>
  )
}

export function Dialogs() {
  return (
    <>
      <ConfirmCommand />
      <SkillPreview />
    </>
  )
}

export function SeenLink({ kind, name }: { kind: string; name: string }) {
  const go = useNav((s) => s.go)
  const m = useMessages(agentsMessages)
  return (
    <Button
      size="sm"
      aria-label={m.showNameInLogs(name)}
      onClick={() => {
        const logs = useLogs.getState()
        logs.setQuery(termText("agent", kind))
        logs.setRange("all")
        go("logs")
      }}
    >
      {m.showInLogs}
    </Button>
  )
}
