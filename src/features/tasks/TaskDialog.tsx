import { ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { Details } from "./Details"
import { taskMessages } from "./messages"
import { useTasks } from "./store"

/** The keys in the order the owner sees them, whichever view and sort is on screen. */
const shownKeys = () => [...document.querySelectorAll<HTMLElement>("[data-opens]")].map((el) => el.dataset.opens ?? "")

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && Boolean(el.closest("input,textarea,select,[role=combobox],[role=listbox]"))

/** One dialog for a task, opened from a table row, a board card or a "waits for" link. */
export function TaskDialog() {
  const m = useMessages(taskMessages)
  const open = useTasks((s) => s.open)
  const task = useTasks((s) => (s.open ? (s.tasks.find((t) => t.key === s.open) ?? s.outside[s.open]) : undefined))
  const failed = useTasks((s) => (s.open ? s.failed[s.open] : undefined))
  const [dirty, setDirty] = useState(false)
  const [held, setHeld] = useState(false)
  if (held && !dirty) setHeld(false)
  const last = useRef<string | null>(null)
  if (open) last.current = open

  const order = useTasks((s) => s.order)
  const view = useTasks((s) => s.view)
  // Read from the page after it renders: the table's sort lives in the table, and the list may arrive after the dialog.
  const [keys, setKeys] = useState<string[]>([])
  // biome-ignore lint/correctness/useExhaustiveDependencies: the rows on screen change with the order and the view
  useEffect(() => setKeys(open ? shownKeys() : []), [open, order, view])
  const at = open ? keys.indexOf(open) : -1
  const step = (by: 1 | -1) => {
    const now = shownKeys()
    const i = open ? now.indexOf(open) : -1
    if (dirty) {
      setHeld(true)
      return
    }
    const next = i < 0 ? undefined : now[i + by]
    if (next) void useTasks.getState().openTask(next)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return
      if (e.key === "j" || e.key === "k") {
        e.preventDefault()
        step(e.key === "j" ? 1 : -1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const close = () => {
    if (useTasks.getState().open) {
      useTasks.getState().toggle(null)
      return
    }
    // The native dialog has finished closing: the row or card of the task last shown takes the focus back.
    if (last.current) document.querySelector<HTMLElement>(`[data-opens="${last.current}"]`)?.focus()
  }

  return (
    <Dialog
      open={Boolean(open)}
      title={open ? m.details(open) : ""}
      onClose={close}
      wide="xl"
      scroll
      actions={
        <>
          <span className="mr-auto flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={m.previous}
              title={m.previous}
              disabled={at <= 0}
              onClick={() => step(-1)}
              icon={<ChevronUp className="size-4" aria-hidden />}
            />
            <Button
              size="sm"
              variant="ghost"
              aria-label={m.next}
              title={m.next}
              disabled={at < 0 || at >= keys.length - 1}
              onClick={() => step(1)}
              icon={<ChevronDown className="size-4" aria-hidden />}
            />
            {/* The place is why ▲ or ▼ is off at either end of the list. */}
            {at >= 0 && (
              <span className="self-center px-1 font-mono text-[0.85rem] text-ink-dim tabular-nums">
                {m.position(at + 1, keys.length)}
              </span>
            )}
          </span>
          <Button size="sm" variant="ghost" onClick={close}>
            {m.close}
          </Button>
        </>
      }
      footer={
        // One line for both, so the warning takes the hint's place rather than pushing the dialog taller.
        <p
          role={held ? "alert" : undefined}
          className={held ? "text-[0.85rem] text-bad" : "text-[0.8rem] text-ink-dim"}
        >
          {held ? m.saveFirst : m.keysHint}
        </p>
      }
    >
      {task ? (
        <div key={task.key} className="reveal">
          <Details task={task} onDirty={setDirty} />
        </div>
      ) : failed ? (
        <ErrorNotice inline>{m.openFailed(open ?? "", failed)}</ErrorNotice>
      ) : (
        <div className="flex flex-col gap-[0.6rem] pb-[0.6rem]">
          <Skeleton className="h-[2.4rem] w-full" label={m.readingTask} />
          <Skeleton className="h-[6rem] w-full" />
        </div>
      )}
    </Dialog>
  )
}
