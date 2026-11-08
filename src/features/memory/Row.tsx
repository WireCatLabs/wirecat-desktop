import {
  Brain,
  Building2,
  FolderKanban,
  Link2,
  ListChecks,
  LoaderCircle,
  MessageSquareQuote,
  Pencil,
  User,
  UserRound,
} from "lucide-react"
import { type MouseEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useId, useRef } from "react"
import { approveMode, can, type Subject, stateOf, tickedCount, toneOf, undoMenuKey, undoOf } from "@/domain/memory"
import { standingOf } from "@/domain/relationships"
import { useLang, useMessages } from "@/i18n"
import type { MemoryEntry } from "@/platform/memory-schemas"
import { StandingPill } from "@/shared/StandingPill"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { Lamp } from "@/ui/Lamp"
import { focusInPlace, holdInPlace } from "@/ui/motion"
import { Pill } from "@/ui/Pill"
import { SplitButton } from "@/ui/SplitButton"
import { TextButton } from "@/ui/TextButton"
import { dayLabel, kindOf, textOf, timeOf } from "./labels"
import { memoryMessages } from "./messages"
import { InlineCorrect } from "./RowCorrect"
import { Details } from "./RowDetails"
import { canRevoke, ownerRoles, useMemory } from "./store"

const ICONS = { memory: Brain, fact: MessageSquareQuote, action: ListChecks, relationship: Link2 }
const SUBJECT_ICONS = { project: FolderKanban, person: User, you: UserRound, organization: Building2, other: User }

export function SubjectLabel({ subject, className }: { subject: Subject; className?: string }) {
  const m = useMessages(memoryMessages)
  const Icon = SUBJECT_ICONS[subject.kind]
  return (
    <span className={cx("inline-flex min-w-0 items-center gap-[0.35rem] font-medium text-ink", className)}>
      <Icon className="size-[0.95rem] shrink-0 text-ink-soft" strokeWidth={1.8} aria-hidden />
      {subject.kind === "you" ? (
        m.you
      ) : subject.name ? (
        <span className="truncate">{subject.name}</span>
      ) : (
        <span className="truncate font-mono text-[0.85rem]">{subject.key}</span>
      )}
    </span>
  )
}

/**
 * One record under its subject's heading. Collapsed: its kind, when, one line of text and its actions. Opened: the
 * text whole, the place to correct it, its sources or findings, and everything Memo says about it.
 */
export function Row({ entry }: { entry: MemoryEntry }) {
  const m = useMessages(memoryMessages)
  const lang = useLang()
  const open = useMemory((s) => s.open === entry.ref)
  const editing = useMemory((s) => s.correcting === entry.ref)
  const busy = useMemory((s) => s.busy[entry.ref])
  const failed = useMemory((s) => s.failed[entry.ref])
  const skipped = useMemory((s) => s.skipped[entry.ref])
  const { toggle, confirm, discard, startCorrect, askForget, openTask } = useMemory.getState()
  const panel = useId()
  const row = useRef<HTMLDivElement>(null)
  const state = stateOf(entry.status)
  const Icon = ICONS[entry.type]
  const revoke = useMemory(canRevoke)
  const roles = useMemory(ownerRoles)
  const standing = standingOf(entry.standing)
  const allowed = can(entry, revoke)
  const undo = undoOf(entry, revoke)
  const editable = open && allowed.correct
  const ticked = tickedCount(entry.findings, skipped)

  const flip = () => {
    if (row.current) holdInPlace(row.current)
    toggle(entry.ref)
  }

  // Approve, Reject or Undo approval disables the button that ran it and then swaps it for another set, so focus
  // would fall to the page; it stays on this row, on its actions when any are left.
  const actions = useRef<HTMLSpanElement>(null)
  const actionsHeldFocus = useRef(false)
  useEffect(() => {
    const box = actions.current
    if (!box) return
    const hold = () => {
      actionsHeldFocus.current = true
    }
    // A button removed or disabled under focus blurs with nowhere to go; only a move elsewhere or a click lets go.
    const leave = (e: FocusEvent) => {
      if (e.relatedTarget && !box.contains(e.relatedTarget as Node)) actionsHeldFocus.current = false
    }
    const click = (e: PointerEvent) => {
      if (!box.contains(e.target as Node)) actionsHeldFocus.current = false
    }
    box.addEventListener("focusin", hold)
    box.addEventListener("focusout", leave)
    document.addEventListener("pointerdown", click, true)
    return () => {
      box.removeEventListener("focusin", hold)
      box.removeEventListener("focusout", leave)
      document.removeEventListener("pointerdown", click, true)
    }
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the action ends or the record changes state
  useEffect(() => {
    if (!actionsHeldFocus.current) return
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const next =
      actions.current?.querySelector<HTMLButtonElement>("button:not(:disabled)") ??
      row.current?.querySelector<HTMLElement>(`[aria-controls="${panel}"]`)
    next?.focus({ preventScroll: true })
  }, [busy, entry.status])
  // Opened, a click on the text corrects it; a drag over it only selects (TextButton).
  const onHead = (e: MouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement>) => {
    if (editable && e.type === "click" && (e.target as Element).closest("[data-text]")) startCorrect(entry.ref)
    else flip()
  }
  const stopEditing = () => {
    startCorrect(null)
    requestAnimationFrame(() =>
      focusInPlace(row.current?.querySelector<HTMLElement>(`[aria-controls="${panel}"]`) ?? null),
    )
  }

  const label = (
    <span className="flex min-w-0 flex-wrap items-center gap-x-[0.5rem] gap-y-[0.1rem] text-[0.9rem] text-ink-soft">
      <span>{kindOf(entry.kind, m)}</span>
      <span aria-hidden>·</span>
      <span className="font-mono text-[0.85rem] tabular-nums">
        {dayLabel(entry.createdAt, m, lang)} {timeOf(entry.createdAt, lang)}
      </span>
      {entry.scope === "personal" && <Pill>{m.personal}</Pill>}
      {standing && <StandingPill standing={standing} />}
    </span>
  )

  const openAnd = (then: () => void) => {
    if (!open) flip()
    then()
  }
  const correctItem = allowed.correct && { label: m.correct, onSelect: () => openAnd(() => startCorrect(entry.ref)) }
  const undoKey = undoMenuKey(undo)
  const undoLabel = undoKey ? m.undo[undoKey] : null
  const rejectItem = allowed.discard && undoLabel && { label: undoLabel, onSelect: () => discard(entry.ref) }
  const eraseItem = allowed.forget && { label: m.forget, danger: true, onSelect: () => askForget(entry.ref) }
  // A findings batch is approved from its opened row, so what Approve creates is on screen; closed, it opens.
  const mode = approveMode(!!entry.findings, open)
  const approve =
    mode === "approve"
      ? { label: m.approve, onClick: () => confirm(entry.ref) }
      : mode === "review"
        ? { label: m.reviewFindings(entry.findings?.length ?? 0), onClick: flip }
        : {
            label: m.approveFindings(ticked),
            onClick: () =>
              ticked > 0
                ? confirm(entry.ref)
                : row.current?.querySelector<HTMLElement>("[data-findings] input")?.focus(),
          }
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />
  // A record in use leads with what the owner most likely wants: the task it became, what it created, or an edit.
  const settled =
    undo === "task" && entry.task
      ? {
          label: m.openTask,
          icon: busy === "open" ? spin : <ListChecks className="size-4" aria-hidden />,
          onClick: () => entry.task && openTask(entry.ref, entry.task),
        }
      : undo === "created"
        ? { label: m.whatItMade, expanded: open, onClick: flip }
        : correctItem
          ? { label: m.correct, icon: <Pencil className="size-4" aria-hidden />, onClick: correctItem.onSelect }
          : undefined
  const editLeads = !!correctItem && undo !== "task" && undo !== "created"

  return (
    <div ref={row} data-row data-ref={entry.ref} className="border-line border-t">
      <div className="grid min-h-[4.5rem] grid-cols-[auto_auto_minmax(0,1fr)_auto] items-start gap-[0.9rem] px-[1.3rem] py-[0.95rem] xl:gap-[1.2rem]">
        <span className="mt-[0.55rem]">
          <Lamp tone={toneOf(entry.status)} label={m.states[state]} />
        </span>
        <Icon
          className="mt-[0.45rem] size-[1.6rem] text-ink-soft"
          strokeWidth={1.6}
          aria-label={m.record[entry.type]}
        />
        <AutoHeight swap={`${open}${editing}`} className="min-w-0">
          {editing ? (
            <div className="flex flex-col gap-[0.35rem]">
              {label}
              <InlineCorrect entry={entry} onDone={stopEditing} />
            </div>
          ) : (
            <div className="flex min-w-0 items-start gap-[0.4rem]">
              <TextButton
                as="div"
                onClick={onHead}
                aria-expanded={open}
                aria-controls={panel}
                className="group flex min-w-0 flex-1 cursor-pointer items-start gap-[0.6rem] rounded-[0.3rem] text-left"
              >
                <span className="block min-w-0 flex-1">
                  <span className="flex items-center gap-[0.4rem]">{label}</span>
                  <span
                    data-text
                    title={editable ? m.clickToCorrect : undefined}
                    className={cx(
                      "selectable mt-[0.25rem] text-[1rem] leading-snug font-medium",
                      open ? "block whitespace-pre-line" : "line-clamp-1 group-hover:text-brand",
                      editable &&
                        "-mx-[0.3rem] cursor-text rounded-[0.3rem] px-[0.3rem] transition-colors duration-(--motion-fast) hover:bg-app-3",
                    )}
                  >
                    {textOf(entry, m, roles)}
                  </span>
                </span>
                <ExpandChevron open={open} className="mt-[0.2rem] group-hover:text-ink" />
              </TextButton>
              {editable && (
                <button
                  type="button"
                  aria-label={m.correct}
                  title={m.correct}
                  disabled={!!busy}
                  onClick={() => startCorrect(entry.ref)}
                  className="reveal mt-[1.55rem] grid size-8 shrink-0 cursor-pointer place-items-center rounded-[0.35rem] text-ink-dim transition-colors duration-(--motion-fast) hover:bg-app-3 hover:text-ink disabled:opacity-45"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              )}
            </div>
          )}
        </AutoHeight>
        <span
          ref={actions}
          data-tour="memory-actions"
          className="flex min-w-[11.5rem] items-center justify-end gap-[0.4rem]"
        >
          {allowed.confirm ? (
            <>
              <Button
                variant="ghost"
                disabled={!!busy}
                onClick={() => discard(entry.ref)}
                icon={busy === "discard" ? spin : undefined}
              >
                {m.discard}
              </Button>
              <SplitButton
                disabled={!!busy}
                main={{ ...approve, ...(busy === "confirm" ? { icon: spin } : {}) }}
                items={[correctItem, eraseItem].filter((i) => !!i)}
                menuLabel={m.moreActions}
                moreLabel={m.moreButton}
              />
            </>
          ) : (
            <>
              <span className={cx("text-[0.9rem]", toneOf(entry.status) === "ok" ? "text-ink-soft" : "text-ink-dim")}>
                {m.states[state]}
              </span>
              <SplitButton
                disabled={!!busy}
                {...(settled ? { main: settled } : {})}
                items={[editLeads ? null : correctItem, rejectItem, eraseItem].filter((i) => !!i)}
                menuLabel={m.moreActions}
                moreLabel={m.moreButton}
              />
            </>
          )}
        </span>
      </div>
      {failed && !open && (
        <ErrorNotice inline className="-mt-[0.4rem] pr-[1.3rem] pb-[0.8rem] pl-[6.1rem] xl:pl-[6.7rem]">
          {m.writeFailed} {failed}
        </ErrorNotice>
      )}
      <Collapse open={open} id={panel}>
        <Details entry={entry} />
      </Collapse>
    </div>
  )
}
