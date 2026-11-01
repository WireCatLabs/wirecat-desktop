import { LABELS, type Label } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { stamp, taskMessages } from "./messages"
import { useTasks } from "./store"

/** What a move did beyond what the owner saw: "HRB-3 moved to Progress. HRB-3 is now High." */
export function Note() {
  const m = useMessages(taskMessages)
  const note = useTasks((s) => s.note)
  const label = note?.label && (LABELS as readonly string[]).includes(note.label) ? m.labels[note.label as Label] : null
  const text = note
    ? [note.column ? m.movedTo(note.key, m.states[note.column]) : "", label ? m.nowLabel(note.key, label) : ""]
        .filter(Boolean)
        .join(" ")
    : ""
  return (
    <p aria-live="polite" className="ml-auto min-w-0 truncate text-[0.9rem] text-ink-soft">
      {text}
    </p>
  )
}

/** Under the row or card whose write Memo refused: who changed the task first, and the way to read it again. */
export function StaleLine({ taskKey }: { taskKey: string }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  const stale = useTasks((s) => (s.stale?.key === taskKey ? s.stale : null))
  if (!stale) return null
  const last = stale.last
  const who = last?.by ? (last.by.owner ? m.you : (last.by.name ?? m.someone)) : null
  const change = last?.changes[0]
  const text =
    last && who && change
      ? m.changed(stale.key, who, m.fields[change.field] ?? change.field, stamp(last.at, lang))
      : m.changedUnknown(stale.key)
  return (
    <ErrorNotice
      inline
      action={
        <>
          <Button size="sm" onClick={() => void useTasks.getState().load()}>
            {m.readAgain}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => useTasks.getState().dismissStale()}>
            {m.close}
          </Button>
        </>
      }
    >
      {text}
    </ErrorNotice>
  )
}
