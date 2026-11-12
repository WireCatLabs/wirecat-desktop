import type { ReactNode } from "react"
import { byOwner, dayKey, stateLineOf, subjectOf, toneOf, undoOf } from "@/domain/memory"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { Lamp } from "@/ui/Lamp"
import { aboutOf, actionLine, authorOf, kindOf, type M, savedAt } from "./labels"
import { memoryMessages } from "./messages"
import { findingsMessages } from "./messages-findings"
import { DocumentFacts, EditButton, Outcome, RelationSource } from "./RowExplain"
import { RowFailed } from "./RowFailed"
import { Findings } from "./RowFindings"
import { ReviewAnswered, ReviewPanel } from "./RowReview"
import { Sources } from "./RowSources"
import { canRevoke, useMemory } from "./store"

function ActionFacts({ entry, m }: { entry: MemoryEntry; m: M }) {
  const what = entry.verb || entry.summary ? actionLine(entry, m, false) : null
  if (!entry.reason && !entry.text && !what) return <p className="text-[0.95rem] text-ink-soft">{m.noContent}</p>
  return (
    <div className="flex min-w-0 flex-col gap-[0.6rem]">
      {what && (
        <>
          <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.wouldDo}</h3>
          <p className="selectable text-[0.95rem]">{what}</p>
        </>
      )}
      {entry.text && (
        <>
          <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.wouldSend}</h3>
          <p className="selectable rounded-inset border border-line bg-app px-[0.9rem] py-[0.7rem] text-[0.95rem] whitespace-pre-wrap">
            {entry.text}
          </p>
        </>
      )}
      {entry.reason && (
        <>
          <h3 className="text-[0.9rem] font-medium text-ink-dim">{m.why}</h3>
          <p className="selectable text-[0.95rem] text-ink-soft">{entry.reason}</p>
        </>
      )}
    </div>
  )
}

const STATE_WORDS = {
  review: "stateReview",
  reviewFindings: "stateReviewFindings",
  reviewAction: "stateReviewAction",
  reviewed: "stateReviewed",
  approved: "stateApproved",
  approvedOld: "stateApprovedOld",
} as const

function stateLine(entry: MemoryEntry, m: M) {
  const line = stateLineOf(entry)
  return typeof line === "string" ? m[STATE_WORDS[line]] : m.states[line.state]
}

/** A value in the details that, clicked, narrows the page to records that share it. */
function FilterLink({ label, onClick, mono }: { label: string; onClick: () => void; mono?: boolean }) {
  const m = useMessages(memoryMessages)
  return (
    <button
      type="button"
      onClick={onClick}
      title={m.filterBy(label)}
      aria-label={m.filterBy(label)}
      className={cx(
        "cursor-pointer rounded-rack text-left text-ink underline decoration-ink-dim/50 decoration-dotted underline-offset-[0.2em] transition-colors duration-(--motion-fast) hover:text-brand hover:decoration-brand",
        mono && "font-mono text-[0.9rem]",
      )}
    >
      {label}
    </button>
  )
}

export function Details({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const f = useMessages(findingsMessages)
  const lang = useLang()
  const revoke = useMemory(canRevoke)
  const failed = useMemory((s) => s.failed[entry.ref])
  const editing = useMemory((s) => s.correcting === entry.ref)
  const { filterBy } = useMemory.getState()
  const owner = byOwner(entry)
  const subject = subjectOf(entry)
  const projectName = entry.projectName ?? (subject?.kind === "project" ? subject.name : null)
  const person = subject && subject.kind !== "project" && entry.type !== "relationship" ? aboutOf(entry, m) : null
  // Outcome above says what the state means; only an action or a findings batch still needs the line here.
  const explained = entry.type !== "action" && !entry.findings
  const row = (dt: string, dd: ReactNode) => (
    <>
      <dt className="text-ink-dim">{dt}</dt>
      <dd className="min-w-0">{dd}</dd>
    </>
  )

  const panel = "border-line border-t bg-app-2/60 px-[1.3rem] py-[1.4rem]"
  const meta = (
    <div className="flex min-w-0 flex-col gap-[1.1rem]">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[0.45rem] text-[0.95rem]">
        {projectName &&
          row(m.project, <FilterLink label={projectName} onClick={() => filterBy("project", projectName)} />)}
        {person &&
          row(
            m.about,
            <FilterLink
              label={person}
              onClick={() => filterBy("subject", entry.subjectIsOwner ? "me" : (entry.subject ?? person))}
            />,
          )}
        {entry.type !== "relationship" &&
          row(m.kind, <FilterLink label={kindOf(entry.kind, m)} onClick={() => filterBy("kind", entry.kind)} />)}
        {entry.scope && row(m.scope, m.scopes[entry.scope] ?? entry.scope)}
        {(entry.type !== "relationship" || entry.author) &&
          row(
            m.writtenBy,
            <>
              <FilterLink
                label={authorOf(entry, m)}
                mono={!owner}
                onClick={() => filterBy("by", owner ? "me" : authorOf(entry, m))}
              />
              {!owner && <span className="text-ink-soft"> ({m.agentNote})</span>}
            </>,
          )}
        {entry.model && row(m.model, <span className="selectable font-mono text-[0.9rem]">{entry.model}</span>)}
        {entry.confidence !== null &&
          row(
            m.confidence,
            <span className="font-mono text-[0.9rem] tabular-nums">{entry.confidence.toFixed(2)}</span>,
          )}
        {row(
          m.saved,
          <FilterLink
            label={savedAt(entry.createdAt, lang)}
            mono
            onClick={() => filterBy("when", dayKey(entry.createdAt))}
          />,
        )}
        {entry.updatedAt &&
          entry.updatedAt !== entry.createdAt &&
          row(
            m.updated,
            <span className="font-mono text-[0.9rem] tabular-nums">{savedAt(entry.updatedAt, lang)}</span>,
          )}
        {entry.type !== "action" &&
          entry.type !== "relationship" &&
          row(m.sourcesCount, <span className="font-mono text-[0.9rem] tabular-nums">{entry.links}</span>)}
        {entry.target &&
          !entry.findings &&
          entry.type !== "relationship" &&
          row(m.actsOn, <span className="selectable font-mono text-[0.9rem] break-all">{entry.target}</span>)}
        {entry.account &&
          entry.type !== "relationship" &&
          entry.kind !== "mail_findings" &&
          row(m.wouldAct, <span className="selectable font-mono text-[0.9rem] break-all">{entry.account}</span>)}
        {entry.supersedes &&
          row(m.corrects, <span className="selectable font-mono text-[0.9rem]">{entry.supersedes}</span>)}
        {entry.type === "relationship" &&
          entry.account &&
          row(m.reportedBy, <span className="font-mono text-[0.9rem]">{entry.account}</span>)}
        {!explained &&
          row(
            m.state,
            <span className="flex items-start gap-2">
              <Lamp tone={toneOf(entry.status)} size="sm" />
              <span className="-mt-[0.2rem]">{stateLine(entry, m)}</span>
            </span>,
          )}
      </dl>
      {undoOf(entry, revoke) === "none" && (
        <p className="text-[0.9rem] text-ink-soft">
          {!revoke ? m.noUndoFact : byOwner(entry) ? m.noUndoOwnFact : m.noUndoCorrection}
        </p>
      )}
    </div>
  )

  // A batch's list takes the whole width; who wrote it and when fold under More details.
  if (entry.findings)
    return (
      <div className={cx(panel, "flex flex-col gap-[1.1rem]")}>
        <Findings entry={entry} />
        {failed && <RowFailed failed={failed} />}
        <Disclosure summary={f.details}>
          <div className="grid gap-[1.6rem] pt-[0.4rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {meta}
            {/* memo reads sources back for an evidence batch only; a mail finding's cited emails open in its card. */}
            {entry.kind !== "mail_findings" && <Sources entry={entry} />}
          </div>
        </Disclosure>
      </div>
    )

  return (
    <div className={cx(panel, "grid gap-[1.6rem] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]")}>
      {entry.type === "action" ? (
        <ActionFacts entry={entry} m={m} />
      ) : entry.type === "relationship" ? (
        <div className="flex min-w-0 flex-col gap-[1.2rem]">
          <Outcome entry={entry} />
          <EditButton entry={entry} />
          <DocumentFacts entry={entry} />
          <RelationSource entry={entry} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-[1.2rem]">
          {!entry.sourceReview && <Outcome entry={entry} />}
          {!editing && <EditButton entry={entry} />}
          <ReviewPanel entry={entry} />
          <ReviewAnswered entry={entry} />
          <Sources entry={entry} />
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-[1.1rem]">
        {meta}
        {failed && !editing && <RowFailed failed={failed} />}
      </div>
    </div>
  )
}
