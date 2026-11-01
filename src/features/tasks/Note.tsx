import { X } from "lucide-react"
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
  // It floats over the page's corner, so its words appearing move nothing the owner did not touch.
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-[1.6rem] bottom-[1.2rem] z-40 max-w-[28rem]">
      {text && (
        <p className="reveal pointer-events-auto flex items-center gap-3 rounded-[0.45rem] border border-line bg-app py-[0.45rem] pr-[0.4rem] pl-[0.9rem] text-[0.9rem] text-ink shadow-panel">
          <span className="min-w-0 flex-1">{text}</span>
          <button
            type="button"
            aria-label={m.close}
            title={m.close}
            onClick={() => useTasks.setState({ note: null })}
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[0.3rem] text-ink-dim hover:bg-app-3 hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </p>
      )}
    </div>
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
