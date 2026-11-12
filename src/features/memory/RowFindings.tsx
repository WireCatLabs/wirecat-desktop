import { ListChecks, LoaderCircle, Pencil } from "lucide-react"
import { useId, useState } from "react"
import { isConversation } from "@/domain/conversation"
import { linkTargetOf } from "@/domain/links"
import { batchSubjectOf, can, citedLabelOf, createdTarget, mailboxOf, tickedCount, waitingOf } from "@/domain/memory"
import { openConversation } from "@/features/conversation"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { MemoryEntry, MemorySource } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { DateField } from "@/ui/Calendar"
import { Collapse } from "@/ui/Collapse"
import { CopyRef } from "@/ui/CopyRef"
import { cx } from "@/ui/cx"
import { DecideAll, DecisionButtons } from "@/ui/DecisionButtons"
import { useFieldError } from "@/ui/FieldError"
import { fieldFocus } from "@/ui/field"
import { Lamp } from "@/ui/Lamp"
import { LinkButton } from "@/ui/LinkButton"
import { focusInPlace, PANEL_MS, reducedMotion } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { memoryMessages } from "./messages"
import { findingsMessages } from "./messages-findings"
import { CitedRef, citedText, ITEM_LIST, ITEM_PAD, SourceContextView } from "./RowSources"
import { canRevoke, useMemory } from "./store"

type Finding = NonNullable<MemoryEntry["findings"]>[number]
type FindingField = NonNullable<Finding["edits"]>[number]

/**
 * A findings batch: each fact or task the agent proposes, approved or rejected one by one, then saved at once. Save
 * creates the approved ones and rejects the others. A batch decided in part elsewhere keeps its decided findings
 * as they are and waits for the rest.
 */
export function Findings({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const f = useMessages(findingsMessages)
  const skipped = useMemory((s) => s.skipped[entry.ref]) ?? []
  const busy = useMemory((s) => s.busy[entry.ref])
  const sources = useMemory((s) => s.sources[entry.ref])
  const { confirm, discard, skipAll } = useMemory.getState()
  const findings = entry.findings ?? []
  const open = entry.status === "proposed"
  const project = batchSubjectOf(entry, m.project)
  const mailbox = mailboxOf(entry)
  const waiting = waitingOf(findings)
  const keep = tickedCount(findings, skipped)
  const drop = waiting.length - keep
  const known = sources?.state === "ready" ? sources.sources : undefined
  // Save leaves with the bar it sits in: focus goes to what the batch made, or to the batch's title.
  const save = async () => {
    await (keep === 0 ? discard(entry.ref) : confirm(entry.ref))
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-ref="${CSS.escape(entry.ref)}"]`)
      focusInPlace(
        row?.querySelector<HTMLElement>("[data-edit]") ?? row?.querySelector<HTMLElement>("[aria-controls]") ?? null,
      )
    })
  }
  const kinds = new Set(findings.map((x) => (x.kind === "fact" || x.kind === "task" ? x.kind : "other")))

  return (
    <div className="flex min-w-0 flex-col gap-[0.7rem]">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-[0.4rem]">
        <div className="min-w-0">
          <h3 className="font-medium">{mailbox !== null ? m.mailFor(mailbox) : m.findingsFor(project)}</h3>
          <p className="text-[0.9rem] text-ink-soft">
            {(["fact", "task", "other"] as const)
              .filter((k) => kinds.has(k))
              .map((k) => f.kindHint[k])
              .join(" ")}
          </p>
        </div>
        {open && waiting.length > 1 && (
          <DecideAll
            label={f.markAll}
            keepAll={f.keepAll}
            dropAll={f.dropAll}
            disabled={!!busy}
            onChange={(v) => skipAll(entry.ref, v === "drop")}
          />
        )}
      </div>

      <ul data-findings className={ITEM_LIST}>
        {findings.map((x) => (
          <FindingItem key={x.id} entry={entry} finding={x} sources={known} />
        ))}
      </ul>

      {open && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-[0.6rem] pt-[0.2rem]">
          <div className="flex min-w-0 max-w-[62ch] flex-col gap-[0.2rem] text-[0.9rem] text-ink-soft">
            <p>{f.saveNote(mailbox !== null, project)}</p>
            <p className="text-ink-dim">{f.editLater}</p>
          </div>
          <Button
            disabled={!!busy}
            icon={
              busy === "confirm" || busy === "discard" ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : undefined
            }
            onClick={() => void save()}
          >
            {f.save(keep, drop)}
          </Button>
        </div>
      )}
    </div>
  )
}

/** One finding as one card: its label and text, why, what it cites, and its own decision or result. */
function FindingItem({
  entry,
  finding: x,
  sources,
}: {
  entry: MemoryEntry
  finding: Finding
  sources: readonly MemorySource[] | undefined
}) {
  const m = useMessages(memoryMessages)
  const f = useMessages(findingsMessages)
  const waiting = entry.status === "proposed" && !x.outcome
  const kept = useMemory((s) => !s.skipped[entry.ref]?.includes(x.id))
  const busy = useMemory((s) => !!s.busy[entry.ref])
  const editable = useMemory((s) => s.read?.kind === "ready" && s.read.findingsEdit)
  const [shown, setShown] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const { skip } = useMemory.getState()
  const canEdit = waiting && editable && !!entry.fingerprint && (x.edits?.length ?? 0) > 0

  return (
    <li
      className={cx(
        "grid grid-cols-[minmax(0,1fr)] gap-x-[1.2rem] gap-y-[0.6rem] border-line not-first:border-t md:grid-cols-[minmax(0,1fr)_auto]",
        ITEM_PAD,
      )}
    >
      {editing ? (
        <FindingEdit entry={entry} finding={x} onClose={() => setEditing(false)} />
      ) : (
        <div
          className={cx(
            "min-w-0 transition-opacity duration-(--motion-fast)",
            ((waiting && !kept) || x.outcome === "rejected") && "opacity-55",
          )}
        >
          <p className="flex min-w-0 items-baseline gap-x-[0.55rem]">
            <Pill tone={x.kind === "task" ? "brand" : "neutral"}>{m.findingKinds[x.kind] ?? x.kind}</Pill>
            <span className="selectable min-w-0 font-medium text-ink [overflow-wrap:anywhere]">{x.text}</span>
          </p>
          {x.reason && (
            <p className="selectable mt-[0.25rem] text-[0.95rem] text-ink-soft [overflow-wrap:anywhere]">{x.reason}</p>
          )}
          {x.evidence.length > 0 && (
            <ul className="mt-[0.45rem] flex min-w-0 flex-col gap-[0.25rem] text-[0.9rem]">
              {x.evidence.map((ref) => (
                <Cited
                  key={ref}
                  reference={ref}
                  label={citedText(ref, sources, f.kinds)}
                  shown={shown === ref}
                  onToggle={() => {
                    if (shown !== ref) useMemory.getState().loadContext(ref)
                    setShown(shown === ref ? null : ref)
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-start md:justify-end">
        {waiting ? (
          <span className="flex flex-col items-start gap-[0.4rem] md:items-end">
            <DecisionButtons
              label={f.decision(x.text)}
              value={kept ? "keep" : "drop"}
              disabled={busy}
              onChange={(v) => skip(entry.ref, x.id, v === "drop")}
              keepLabel={f.keep}
              dropLabel={f.drop}
            />
            {canEdit && !editing && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={f.editOf(x.text)}
                disabled={busy}
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setEditing(true)}
              >
                {f.edit}
              </Button>
            )}
          </span>
        ) : (
          x.outcome && <Outcome entry={entry} finding={x} />
        )}
      </div>

      {x.evidence.map((ref) => (
        <Collapse key={ref} open={shown === ref && !editing} frameClassName="md:col-span-2">
          <div className="overflow-hidden rounded-control border border-line">
            <SourceContextView reference={ref} withRef />
          </div>
        </Collapse>
      ))}
    </li>
  )
}

/** The words a field shows: a due date as its day, every other field as it is. */
const shownValue = (e: FindingField) => (e.name === "dueAt" ? (e.value ?? "").slice(0, 10) : (e.value ?? ""))

/** A title, a statement, a memory's body or a contact's name is never empty; memo clears only the other fields. */
const REQUIRED = ["title", "statement", "body", "name"]

/**
 * The finding's own fields in place of its text, saved through memo at the batch's fingerprint. A due date keeps its
 * time of day: only the day changes here.
 */
function FindingEdit({ entry, finding: x, onClose }: { entry: MemoryEntry; finding: Finding; onClose: () => void }) {
  const m = useMessages(memoryMessages)
  const f = useMessages(findingsMessages)
  const lang = useLang()
  const busy = useMemory((s) => s.busy[entry.ref])
  const edits = x.edits ?? []
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(edits.map((e) => [e.name, shownValue(e)])),
  )
  const base = useId()
  const first = `${base}-${edits[0]?.name ?? ""}`
  const [empty, setEmpty] = useState<string | null>(null)
  const need = useFieldError(empty ? `${base}-${empty}` : first)
  const note = `${base}-note`

  const save = async () => {
    const missing = edits.find((e) => REQUIRED.includes(e.name) && !(values[e.name] ?? "").trim())
    if (missing) {
      setEmpty(missing.name)
      return need.fail((l) => findingsMessages[l].required(findingsMessages[l].fields[missing.name] ?? missing.name))
    }
    const changes = edits.flatMap((e): { name: string; value: string | null }[] => {
      const now = (values[e.name] ?? "").trim()
      if (now === shownValue(e).trim()) return []
      if (!now) return [{ name: e.name, value: null }]
      return [{ name: e.name, value: e.name === "dueAt" ? `${now}${(e.value ?? "").slice(10)}` : now }]
    })
    if (changes.length === 0) return onClose()
    const saved = await useMemory.getState().editFinding(entry.ref, x.id, changes)
    // A stale batch was read again: this finding may be another now, so the form closes on it too.
    if (saved || useMemory.getState().failed[entry.ref] === findingsMessages[lang].stale) onClose()
  }

  return (
    <form
      className="flex min-w-0 flex-col gap-[0.6rem]"
      aria-describedby={note}
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
    >
      <p className="flex min-w-0 items-baseline gap-x-[0.55rem]">
        <Pill tone={x.kind === "task" ? "brand" : "neutral"}>{m.findingKinds[x.kind] ?? x.kind}</Pill>
        <span id={note} className="text-[0.9rem] text-ink-soft">
          {f.editNote}
        </span>
      </p>
      {edits.map((e, i) => {
        const id = `${base}-${e.name}`
        const label = f.fields[e.name] ?? e.name
        const optional = !REQUIRED.includes(e.name)
        const invalid = empty === e.name && need.error !== null
        const set = (v: string) => {
          if (empty === e.name) need.clear()
          setValues((now) => ({ ...now, [e.name]: v }))
        }
        return (
          <div key={e.name} className="flex min-w-0 flex-col gap-[0.25rem]">
            <label htmlFor={id} className="text-[0.9rem] font-medium">
              {label}
            </label>
            {e.name === "dueAt" ? (
              <span className="flex flex-wrap items-center gap-2">
                <DateField
                  aria-label={label}
                  value={values[e.name] ?? ""}
                  onChange={set}
                  format={(day) =>
                    formatDate(`${day}T00:00:00`, { day: "numeric", month: "long", year: "numeric" }, lang)
                  }
                  className="w-[11rem]"
                />
                <span id={id} className="text-[0.85rem] text-ink-dim">
                  {f.emptyClears}
                </span>
              </span>
            ) : (
              <textarea
                id={id}
                // biome-ignore lint/a11y/noAutofocus: the owner just pressed Edit; the first field is what they change
                autoFocus={i === 0}
                rows={e.name === "body" || e.name === "reason" ? 3 : 2}
                maxLength={2000}
                value={values[e.name] ?? ""}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? need.field["aria-describedby"] : optional ? `${id}-hint` : undefined}
                onChange={(ev) => set(e.name === "body" ? ev.target.value : ev.target.value.replace(/\n/g, " "))}
                className={cx(
                  "selectable w-full min-w-0 resize-y rounded-control border border-line-strong bg-app px-2.5 py-[0.35rem] text-[0.95rem] leading-snug text-ink aria-[invalid=true]:border-bad",
                  fieldFocus,
                )}
              />
            )}
            {invalid && need.hint}
            {optional && e.name !== "dueAt" && (
              <span id={`${id}-hint`} className="text-[0.85rem] text-ink-dim">
                {f.emptyClears}
              </span>
            )}
          </div>
        )
      })}
      <span className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!!busy} busy={busy === "edit"}>
          {f.saveEdit}
        </Button>
        <Button size="sm" disabled={!!busy} onClick={onClose}>
          {f.cancel}
        </Button>
      </span>
    </form>
  )
}

/** A cited source on its own line: readable, folding open in place, and opened where it lives when the app can. */
function Cited(props: { reference: string; label: string; shown: boolean; onToggle: () => void }) {
  const f = useMessages(findingsMessages)
  const target = linkTargetOf(props.reference)
  const kind = citedLabelOf(props.reference).kind
  return (
    <li className="flex min-w-0 items-center gap-x-[0.8rem]">
      <CitedRef {...props} />
      <CopyRef value={props.reference} className="-my-1 -ml-[0.5rem]" />
      {target && isConversation(target) && f.open[kind] && (
        <LinkButton className="shrink-0" onClick={() => openConversation(target)}>
          {f.open[kind]}
        </LinkButton>
      )}
    </li>
  )
}

/** What became of a decided finding; a fact or task it became can be edited from here. */
function Outcome({ entry, finding: x }: { entry: MemoryEntry; finding: Finding }) {
  const m = useMessages(memoryMessages)
  const f = useMessages(findingsMessages)
  const opening = useMemory((s) => s.busy[entry.ref] === "open")
  const revoke = useMemory(canRevoke)
  const [gone, setGone] = useState(false)
  const made = createdTarget(x.created)
  const accepted = x.outcome === "accepted"

  const edit = () => {
    const { reveal, openTask, startCorrect, entries } = useMemory.getState()
    const created = x.created
    if (!created) return
    if (made === "task") return void openTask(entry.ref, created)
    if (!reveal(created, entry.ref)) return setGone(true)
    const fact = entries.find((e) => e.ref === created)
    if (fact && can(fact, revoke).correct) startCorrect(created)
    // The batch folds shut, taking the pressed button with it: focus goes to the fact once the rows stop moving.
    setTimeout(
      () =>
        focusInPlace(
          document.querySelector<HTMLElement>(
            `[data-ref="${CSS.escape(created)}"] [aria-controls], [data-ref="${CSS.escape(created)}"] textarea`,
          ),
          "center",
        ),
      reducedMotion() ? 0 : PANEL_MS,
    )
  }

  return (
    <span className="flex flex-col items-start gap-[0.4rem] md:items-end">
      <span className="inline-flex items-center gap-[0.45rem] text-[0.9rem] text-ink-soft">
        <Lamp tone={accepted ? "ok" : "off"} size="sm" />
        {m.outcomes[x.outcome ?? ""] ?? x.outcome}
        {accepted && <CopyRef value={x.created} className="-my-1 -ml-[0.2rem]" />}
      </span>
      {accepted && made && (
        <Button
          data-edit
          size="sm"
          variant="secondary"
          icon={
            opening ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : made === "task" ? (
              <ListChecks className="size-4" aria-hidden />
            ) : (
              <Pencil className="size-4" aria-hidden />
            )
          }
          onClick={edit}
        >
          {made === "task" ? f.editTask : f.editFact}
        </Button>
      )}
      {gone && <span className="max-w-[22rem] text-[0.9rem] text-ink-dim">{m.createdGone}</span>}
    </span>
  )
}
