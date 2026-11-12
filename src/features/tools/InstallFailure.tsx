import type { CatalogTool } from "@/domain/catalog"
import type { Problem } from "@/domain/fix-prompt"
import type { InstallOutcome, InstallSession } from "@/domain/status"
import { FixButton } from "@/features/fix"
import { ReportThis } from "@/shared/ReportThis"
import { failureWordsEn } from "./failure-words"

type Failed = Extract<InstallOutcome, { event: "failed" }>
type Fix = { open: boolean; id: string; toggle(): void }

const doing = (session: InstallSession) => (session.operation === "install" ? "Installing" : "Uninstalling")

/** Report and Fix beside a failed install or uninstall; a cancelled one has nothing to report. */
export function InstallFailure({ tool, session, fix }: { tool: CatalogTool; session: InstallSession; fix: Fix }) {
  const outcome = session.outcome
  if (outcome?.event !== "failed" || outcome.reason === "cancelled") return null
  return (
    <>
      <ReportThis
        what={`${doing(session)} ${tool.name}`}
        tool={tool.id}
        error={[outcome.message, outcome.hint].filter(Boolean).join(" ")}
        log={session.log.slice(-200)}
      />
      <FixButton open={fix.open} controls={fix.id} onClick={fix.toggle} />
    </>
  )
}

/** What the Fix panel under a failed install or uninstall hands the agent, in English. */
export function installProblem(tool: CatalogTool, session: InstallSession, outcome: Failed): Problem {
  const [error, hint] = failureWordsEn(outcome, session.operation)
  return { what: `${doing(session)} ${tool.name} (${tool.package})`, error, hint, log: session.log }
}
