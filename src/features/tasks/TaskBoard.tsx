import { GripVertical } from "lucide-react"
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { anchorOf, closed, STATES, type State } from "@/domain/tasks"
import { useMessages } from "@/i18n"
import type { Task } from "@/platform/task-schemas"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { reducedMotion } from "@/ui/motion"
import { Select } from "@/ui/Select"
import { taskMessages } from "./messages"
import { StaleLine } from "./Note"
import { DueText, Markers, PriorityMark, personName, priorityLabel, StateLamp } from "./parts"
import { useTasks } from "./store"

type Drag = { key: string; x: number; y: number; dx: number; dy: number; w: number; to: State; before: string | null }
type Held = { key: string; to: State; index: number }

const DRAG_PX = 6
const MOVE_MS = 220

/**
 * Cards that changed place slide from where they were, so a drop or a refusal is seen, never a jump. Places are kept
 * relative to the board, so scrolling the page between two changes is not mistaken for a move.
 */
function useSlide(board: RefObject<HTMLDivElement | null>, order: readonly string[], states: string) {
  const last = useRef(new Map<string, { x: number; y: number }>())
  // biome-ignore lint/correctness/useExhaustiveDependencies: the cards are read from the page after each change of order or column
  useLayoutEffect(() => {
    const grid = board.current
    if (!grid) return
    const g = grid.getBoundingClientRect()
    const cards = grid.querySelectorAll<HTMLElement>("[data-card]")
    const next = new Map<string, { x: number; y: number }>()
    for (const el of cards) {
      const r = el.getBoundingClientRect()
      next.set(el.dataset.card ?? "", { x: r.left - g.left + grid.scrollLeft, y: r.top - g.top })
    }
    if (!reducedMotion()) {
      for (const el of cards) {
        const before = last.current.get(el.dataset.card ?? "")
        const now = next.get(el.dataset.card ?? "")
        if (!before || !now) continue
        const dx = before.x - now.x
        const dy = before.y - now.y
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: MOVE_MS,
          easing: "cubic-bezier(0.25, 1, 0.5, 1)",
        })
      }
    }
    last.current = next
  }, [order, states])
}

export function TaskBoard() {
  const m = useMessages(taskMessages)
  const tasks = useTasks((s) => s.tasks)
  const order = useTasks((s) => s.order)
  const query = useTasks((s) => s.query)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [held, setHeld] = useState<Held | null>(null)
  const [said, setSaid] = useState("")
  const press = useRef<{ key: string; x: number; y: number; el: HTMLElement } | null>(null)
  // A drop back where the card started ends on the card itself, so the browser follows it with a click.
  const dropped = useRef(false)
  const byKey = new Map(tasks.map((t) => [t.key, t]))
  const column = (s: State) => order.filter((k) => byKey.get(k)?.state === s)
  const board = useRef<HTMLDivElement>(null)
  useSlide(board, order, tasks.map((t) => t.state).join())

  useEffect(() => {
    if (held) document.querySelector<HTMLElement>(`[data-card="${held.key}"]`)?.focus({ preventScroll: true })
  }, [held])

  const drop = (key: string, to: State, before: string | null) => {
    const keys = column(to).filter((k) => k !== key)
    const index = before ? keys.indexOf(before) : keys.length
    const t = byKey.get(key)
    if (!t) return
    const current = column(t.state)
    const unchanged = t.state === to && current.filter((k) => k !== key)[current.indexOf(key)] === (before ?? undefined)
    if (unchanged) return
    void useTasks.getState().move(key, to, anchorOf(keys, key, index < 0 ? keys.length : index), before)
  }

  const target = (x: number, y: number, key: string): Pick<Drag, "to" | "before"> | null => {
    const col = document
      .elementsFromPoint(x, y)
      .find((el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.dataset.column))
    if (!col) return null
    const cards = [...col.querySelectorAll<HTMLElement>("[data-card]")].filter((c) => c.dataset.card !== key)
    const next = cards.find((c) => {
      const r = c.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return { to: col.dataset.column as State, before: next?.dataset.card ?? null }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, key: string) => {
    if (e.button !== 0 || held || (e.target as HTMLElement).closest("button,a,input,[role=combobox]")) return
    dropped.current = false
    press.current = { key, x: e.clientX, y: e.clientY, el: e.currentTarget }
  }

  const onCardClick = (key: string) => {
    if (dropped.current) {
      dropped.current = false
      return
    }
    void useTasks.getState().openTask(key)
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = press.current
      if (!p) return
      // A short movement is a click or a text selection, not a drag.
      if (!drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_PX) return
      const r = p.el.getBoundingClientRect()
      const t = target(e.clientX, e.clientY, p.key)
      window.getSelection()?.removeAllRanges()
      setDrag((d) => ({
        key: p.key,
        x: e.clientX,
        y: e.clientY,
        dx: d?.dx ?? p.x - r.left,
        dy: d?.dy ?? p.y - r.top,
        w: d?.w ?? r.width,
        to: t?.to ?? d?.to ?? (byKey.get(p.key)?.state as State),
        before: t ? t.before : (d?.before ?? null),
      }))
    }
    const onUp = () => {
      if (drag) {
        dropped.current = true
        drop(drag.key, drag.to, drag.before)
        setSaid(m.dropped(drag.key, m.states[drag.to]))
      }
      press.current = null
      setDrag(null)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && drag) {
        press.current = null
        dropped.current = true
        setDrag(null)
        setSaid(m.putBack(drag.key))
      }
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("keydown", onKey)
    }
  })

  const onCardKey = (e: KeyboardEvent<HTMLElement>, t: Task) => {
    if (e.target !== e.currentTarget) return
    if (!held) {
      if (e.key === " ") {
        e.preventDefault()
        setHeld({ key: t.key, to: t.state, index: column(t.state).indexOf(t.key) })
        setSaid(m.picked(t.key))
      } else if (e.key === "Enter") {
        e.preventDefault()
        void useTasks.getState().openTask(t.key)
      }
      return
    }
    if (held.key !== t.key) return
    e.preventDefault()
    const others = (s: State) => column(s).filter((k) => k !== t.key)
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const i = STATES.indexOf(held.to) + (e.key === "ArrowRight" ? 1 : -1)
      const to = STATES[Math.max(0, Math.min(STATES.length - 1, i))] ?? held.to
      const index = Math.min(held.index, others(to).length)
      setHeld({ ...held, to, index })
      setSaid(m.place(m.states[to], index + 1, others(to).length + 1))
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const index = Math.max(0, Math.min(others(held.to).length, held.index + (e.key === "ArrowDown" ? 1 : -1)))
      setHeld({ ...held, index })
      setSaid(m.place(m.states[held.to], index + 1, others(held.to).length + 1))
    } else if (e.key === " " || e.key === "Enter") {
      drop(t.key, held.to, others(held.to)[held.index] ?? null)
      setHeld(null)
      setSaid(m.dropped(t.key, m.states[held.to]))
    } else if (e.key === "Escape") {
      setHeld(null)
      setSaid(m.putBack(t.key))
    }
  }

  const dragged = drag ? byKey.get(drag.key) : undefined
  const showsClosedDefault = !/(^|[\s(-])(state|closed):/.test(query)
  return (
    <>
      <p className="sr-only" id="tasks-drag-hint">
        {m.dragHint}
      </p>
      <div
        ref={board}
        className="grid grid-cols-[repeat(5,minmax(12rem,1fr))] gap-[0.75rem] overflow-x-auto pb-[0.4rem] xl:gap-[1rem]"
      >
        {STATES.map((s) => {
          const keys = column(s)
          const shown =
            held && held.to === s
              ? [
                  ...keys.filter((k) => k !== held.key).slice(0, held.index),
                  held.key,
                  ...keys.filter((k) => k !== held.key).slice(held.index),
                ]
              : keys.filter((k) => k !== held?.key)
          return (
            <section
              key={s}
              data-column={s}
              aria-label={m.column(m.states[s], keys.length)}
              className={cx(
                "flex min-h-[22rem] min-w-0 flex-col rounded-[0.2rem] border bg-app transition-colors duration-150",
                drag?.to === s ? "border-brand/60" : "border-line-strong",
              )}
            >
              <h2 className="flex h-[3rem] items-center gap-[0.55rem] border-line border-b px-[0.9rem]">
                <StateLamp state={s} />
                <span className="truncate text-[1rem] font-semibold">{m.states[s]}</span>
                <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{keys.length}</span>
              </h2>
              <ul className="flex flex-1 flex-col">
                {shown.map((k) => {
                  const t = byKey.get(k)
                  if (!t) return null
                  return (
                    <li key={k} className="contents">
                      {drag && drag.to === s && drag.before === k && <DropLine />}
                      <Card
                        task={t}
                        ghost={drag?.key === k}
                        held={held?.key === k}
                        onPointerDown={(e) => onPointerDown(e, k)}
                        onKeyDown={(e) => onCardKey(e, t)}
                        onOpen={() => onCardClick(k)}
                      />
                    </li>
                  )
                })}
                {drag && drag.to === s && drag.before === null && (
                  <li aria-hidden className="contents">
                    <DropLine />
                  </li>
                )}
                {keys.length === 0 && !drag && !(held && held.to === s) && (
                  <li className="px-[0.9rem] py-[1rem] text-[0.9rem] text-ink-dim">{m.emptyColumn}</li>
                )}
              </ul>
              {closed(s) && showsClosedDefault && (
                <p className="border-line border-t px-[0.9rem] py-[0.5rem] text-[0.85rem] text-ink-dim">{m.last14}</p>
              )}
            </section>
          )
        })}
      </div>
      {drag && dragged && (
        <div
          aria-hidden
          className={cx(
            "pointer-events-none fixed z-50 rounded-[0.35rem] border border-brand/50 bg-app shadow-panel",
            !reducedMotion() && "rotate-[1.2deg]",
          )}
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w }}
        >
          <CardBody task={dragged} />
        </div>
      )}
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
    </>
  )
}

function DropLine() {
  return <div aria-hidden className="mx-[0.6rem] my-[-1px] h-[2px] rounded-full bg-brand" />
}

function Card(props: {
  task: Task
  ghost: boolean
  held: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
}) {
  const { task, ghost, held } = props
  const m = useMessages(taskMessages)
  const failed = useTasks((s) => s.failed[task.key])
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card holds a picker, so it cannot be a button itself
    <div
      role="button"
      tabIndex={0}
      data-card={task.key}
      data-opens={task.key}
      aria-haspopup="dialog"
      aria-roledescription={m.draggable}
      aria-describedby="tasks-drag-hint"
      aria-pressed={held || undefined}
      aria-label={`${task.key} ${task.title}`}
      onPointerDown={props.onPointerDown}
      onKeyDown={props.onKeyDown}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,[role=combobox],[role=listbox]")) return
        props.onOpen()
      }}
      className={cx(
        "group relative cursor-grab touch-none border-line border-b select-none [-webkit-user-select:none] transition-[background-color,box-shadow] duration-150 last:border-b-0 hover:bg-app-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
        ghost && "bg-app-3 outline-1 outline-line-strong outline-dashed -outline-offset-4 [&>*]:invisible",
        held && "z-10 bg-app shadow-panel outline-2 outline-brand",
      )}
    >
      <CardBody task={task} />
      {failed && (
        <div className="px-[0.9rem] pb-[0.6rem]">
          <ErrorNotice inline>{m.notMoved(failed)}</ErrorNotice>
        </div>
      )}
      <div className="px-[0.9rem] empty:hidden [&:has(>*)]:pb-[0.6rem]">
        <StaleLine taskKey={task.key} />
      </div>
    </div>
  )
}

function CardBody({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const people = useTasks((s) => s.people)
  const busy = useTasks((s) => Boolean(s.busy[task.key]))
  const assignee = task.assignees[0]
  return (
    <div className="flex flex-col gap-[0.4rem] px-[0.9rem] py-[0.7rem]">
      <div className="flex items-center gap-[0.5rem]">
        <GripVertical
          className="absolute top-[0.85rem] left-[0.05rem] size-[0.85rem] text-ink-dim opacity-0 group-hover:opacity-100"
          aria-hidden
        />
        <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{task.key}</span>
        <span className="ml-auto min-w-0">
          <PriorityMark label={priorityLabel(task)} />
        </span>
      </div>
      <p
        className={cx(
          "line-clamp-3 text-[0.95rem] leading-snug font-medium",
          closed(task.state) && "font-normal text-ink-soft",
        )}
      >
        {task.title}
      </p>
      <Markers task={task} />
      <div className="flex min-w-0 items-center gap-[0.5rem] text-[0.9rem] text-ink-soft">
        <span className="min-w-0 truncate">{assignee ? personName(assignee, people, m) : m.nobody}</span>
        <span className="ml-auto shrink-0">{task.dueAt && <DueText task={task} />}</span>
        <Select<State>
          size="sm"
          aria-label={m.moveTo(task.key)}
          value={task.state}
          disabled={busy}
          onChange={(to) => {
            const first = useTasks.getState().order.find((k) => {
              const x = useTasks.getState().tasks.find((y) => y.key === k)
              return x?.state === to && k !== task.key
            })
            void useTasks.getState().move(task.key, to, first ? { before: first } : {}, first ?? null)
          }}
          options={STATES.map((s) => ({ value: s, label: m.states[s], icon: <StateLamp state={s} /> }))}
          className="w-8 shrink-0 border-transparent! bg-transparent! px-1! hover:bg-app-3! [&>span]:hidden [&>svg]:block"
        />
      </div>
    </div>
  )
}
