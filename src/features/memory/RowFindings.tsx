import { Check, ListChecks, LoaderCircle, Pencil, X } from "lucide-react"
import { useState } from "react"
import { isConversation } from "@/domain/conversation"
import { linkTargetOf } from "@/domain/links"
import { batchSubjectOf, can, citedLabelOf, createdTarget, mailboxOf, tickedCount } from "@/domain/memory"
import { openConversation } from "@/features/conversation"
import { useMessages } from "@/i18n"
import type { MemoryEntry, MemorySource } from "@/platform/memory-schemas"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Lamp } from "@/ui/Lamp"
import { LinkButton } from "@/ui/LinkButton"
import { focusInPlace, PANEL_MS, reducedMotion } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { Segmented } from "@/ui/Segmented"
import { memoryMessages } from "./messages"
import { findingsMessages } from "./messages-findings"
import { CitedRef, citedText, ITEM_LIST, ITEM_PAD, SourceContextView } from "./RowSources"
import { canRevoke, useMemory } from "./store"

type Finding = NonNullable<MemoryEntry["findings"]>[number]

/**
 * A findings batch: each fact or task the agent proposes, approved or rejected one by one, then saved at once. memo
 * decides a batch in one call (the findings it names are created, the rest rejected), so the choices wait for Save.
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
  const keep = tickedCount(findings, skipped)
  const drop = findings.length - keep
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
        {open && findings.length > 1 && (
          <span className="flex shrink-0 items-center gap-[0.6rem] text-[0.9rem] text-ink-soft">
            {f.markAll}
            <LinkButton disabled={!!busy} onClick={() => skipAll(entry.ref, false)}>
              {f.keepAll}
            </LinkButton>
            <LinkButton disabled={!!busy} onClick={() => skipAll(entry.ref, true)}>
              {f.dropAll}
            </LinkButton>
          </span>
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
  const open = entry.status === "proposed"
  const kept = useMemory((s) => !s.skipped[entry.ref]?.includes(x.id))
  const busy = useMemory((s) => !!s.busy[entry.ref])
  const [shown, setShown] = useState<string | null>(null)
  const { skip } = useMemory.getState()
  const decided = !open && x.outcome

  return (
    <li
      className={cx(
        "grid grid-cols-[minmax(0,1fr)] gap-x-[1.2rem] gap-y-[0.6rem] border-line not-first:border-t md:grid-cols-[minmax(0,1fr)_auto]",
        ITEM_PAD,
      )}
    >
      <div
        className={cx(
          "min-w-0 transition-opacity duration-(--motion-fast)",
          ((open && !kept) || x.outcome === "rejected") && "opacity-55",
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

      <div className="flex items-start md:justify-end">
        {open ? (
          <Segmented<"keep" | "drop">
            size="md"
            label={f.decision(x.text)}
            value={kept ? "keep" : "drop"}
            disabled={busy}
            onChange={(v) => skip(entry.ref, x.id, v === "drop")}
            options={[
              { value: "keep", label: f.keep, icon: <Check className="size-4" aria-hidden /> },
              { value: "drop", label: f.drop, icon: <X className="size-4" aria-hidden /> },
            ]}
          />
        ) : (
          decided && <Outcome entry={entry} finding={x} />
        )}
      </div>

      {x.evidence.map((ref) => (
        <Collapse key={ref} open={shown === ref} frameClassName="md:col-span-2">
          <div className="overflow-hidden rounded-[0.35rem] border border-line">
            <SourceContextView reference={ref} withRef />
          </div>
        </Collapse>
      ))}
    </li>
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
