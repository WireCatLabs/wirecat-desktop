import { GripVertical } from "lucide-react"
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useRef, useState } from "react"
import { anchorOf, closed, fromMessages, STATES, type State } from "@/domain/tasks"
import { useMessages } from "@/i18n"
import type { Task } from "@/platform/task-schemas"
import { Board, BoardColumn, cardClass, DragCopy, DropLine, useBoardDrag, useSlide } from "@/ui/Board"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Select } from "@/ui/Select"
import { taskMessages } from "./messages"
import { StaleLine } from "./Note"
import {
  DueText,
  Markers,
  PriorityMark,
  personName,
  priorityLabel,
  SourceMark,
  StateLamp,
  TaskError,
  taskTitle,
} from "./parts"
import { ofSource, useSource } from "./source"
import { moveSlot, useTasks } from "./store"

/** Cards a column shows before "Show more"; each click shows as many again. */
export const COLUMN_PAGE = 20

/** A column's first `limit` cards, and a card held by the keyboard wherever it now stands, so it never moves out of view. */
export function pageOf(keys: readonly string[], limit: number, keep?: string): string[] {
  const at = keep ? keys.indexOf(keep) : -1
  return keys.slice(0, Math.max(limit, at + 1))
}

export function TaskBoard() {
  const m = useMessages(taskMessages)
  const tasks = useTasks((s) => s.tasks)
  const order = useTasks((s) => s.order)
  const query = useTasks((s) => s.query)
  const source = useSource((s) => s.source)
  const byKey = new Map(tasks.filter((t) => ofSource(t, source)).map((t) => [t.key, t]))
  const column = (s: State) => order.filter((k) => byKey.get(k)?.state === s)
  const board = useRef<HTMLDivElement>(null)
  // What a column's paging was opened under: a new search or source starts every column at its first page again.
  const scope = `${source}|${query}`
  const [paged, setPaged] = useState<{ scope: string; limits: Partial<Record<State, number>> }>({ scope, limits: {} })
  const limits = paged.scope === scope ? paged.limits : {}
  const limitOf = (s: State) => limits[s] ?? COLUMN_PAGE
  const showUpTo = (s: State, n: number) => setPaged({ scope, limits: { ...limits, [s]: Math.max(limitOf(s), n) } })
  const { drag, held, said, shown, onPointerDown, onClick, onKeyDown } = useBoardDrag<State>({
    columns: STATES,
    cardsIn: column,
    columnOf: (key) => byKey.get(key)?.state,
    // memo only closes a found task, and keeps no order among them: a drop anywhere else says why.
    canDrop: (key, to) => {
      const t = byKey.get(key)
      if (!t || !fromMessages(t)) return true
      if (to === t.state) return false
      if (closed(t.state)) return m.foundClosed
      return closed(to) ? true : m.foundDrop(m.states[to])
    },
    onRefuse: (key, _to, reason) => {
      if (reason) useTasks.setState({ note: { key, label: null, column: null, text: reason } })
    },
    onDrop: ({ key, to, before }) => {
      const keys = column(to).filter((k) => k !== key)
      // Dropped below the last card shown, it lands there, not after the cards "Show more" still hides.
      const index = before ? keys.indexOf(before) : Math.min(keys.length, limitOf(to))
      showUpTo(to, (index < 0 ? keys.length : index) + 1)
      const at = index < 0 ? keys.length : index
      void useTasks.getState().move(key, to, anchorOf(keys, key, at), before ?? keys[at] ?? null)
    },
    onOpen: (key) => void useTasks.getState().openTask(key),
    words: {
      picked: m.picked,
      place: (s, at, of) => m.place(m.states[s], at, of),
      dropped: (key, s) => m.dropped(key, m.states[s]),
      putBack: m.putBack,
    },
  })

  // Each keyboard step is a change of layout, or the drop would replay every step from before the card was picked up.
  useSlide(board, `${order.join()}|${tasks.map((t) => t.state).join()}|${held?.to}:${held?.index}`)

  const dragged = drag ? byKey.get(drag.key) : undefined
  const showsClosedDefault = !/(^|[\s(-])(state|closed):/.test(query)
  return (
    <>
      <p className="sr-only" id="tasks-drag-hint">
        {m.dragHint}
      </p>
      <Board columns={STATES.length} template={`repeat(${STATES.length}, minmax(15.5rem, 1fr))`} boardRef={board} fill>
        {STATES.map((s) => {
          const keys = column(s)
          const cards = shown(s)
          const visible = pageOf(cards, limitOf(s), held?.to === s ? held.key : undefined)
          const left = cards.length - visible.length
          return (
            <BoardColumn
              key={s}
              id={s}
              label={m.column(m.states[s], keys.length)}
              lamp={<StateLamp state={s} />}
              name={m.states[s]}
              count={keys.length}
              target={drag?.to === s}
              empty={keys.length === 0 && !drag && !(held && held.to === s) ? m.emptyColumn : undefined}
              footer={closed(s) && showsClosedDefault ? m.last14 : undefined}
              tiles
            >
              {visible.map((k) => {
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
                      onKeyDown={(e) => onKeyDown(e, k)}
                      onOpen={() => onClick(k)}
                    />
                  </li>
                )
              })}
              {drag && drag.to === s && drag.before === null && (
                <li aria-hidden className="contents">
                  <DropLine />
                </li>
              )}
              {left > 0 && (
                <li className="px-[0.6rem] pb-[0.6rem]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => showUpTo(s, visible.length + COLUMN_PAGE)}
                  >
                    {m.showMore(left)}
                  </Button>
                </li>
              )}
            </BoardColumn>
          )
        })}
      </Board>
      {drag && dragged && (
        <DragCopy drag={drag}>
          <CardBody task={dragged} />
        </DragCopy>
      )}
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
    </>
  )
}

function Card(props: {
  task: Task
  ghost: boolean
  held: boolean
  onPointerDown: ((e: ReactPointerEvent<HTMLElement>) => void) | undefined
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
}) {
  const { task, ghost, held } = props
  const m = useMessages(taskMessages)
  const failed = useTasks((s) => s.failed[moveSlot(task.key)])
  const movable = !closed(task.state) || !fromMessages(task)
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card holds a picker, so it cannot be a button itself
    <div
      role="button"
      tabIndex={0}
      data-card={task.key}
      data-opens={task.key}
      aria-haspopup="dialog"
      aria-roledescription={movable ? m.draggable : undefined}
      aria-describedby={movable ? "tasks-drag-hint" : undefined}
      aria-pressed={held || undefined}
      aria-label={`${task.key} ${taskTitle(task, m)}`}
      onPointerDown={props.onPointerDown}
      onKeyDown={props.onKeyDown}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,[role=combobox],[role=listbox]")) return
        props.onOpen()
      }}
      className={cardClass(ghost, held, movable, true)}
    >
      <CardBody task={task} />
      {failed && (
        <div className="px-[0.9rem] pb-[0.6rem]">
          <TaskError lead={m.notMoved} raw={failed} />
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
  const found = fromMessages(task)
  return (
    <div className="flex flex-col gap-[0.45rem] px-[0.9rem] py-[0.7rem]">
      {!(found && closed(task.state)) && (
        <GripVertical
          className="absolute top-[0.85rem] left-[0.05rem] size-[0.85rem] text-ink-dim opacity-0 group-hover:opacity-100"
          aria-hidden
        />
      )}
      <p
        title={taskTitle(task, m)}
        className={cx(
          "line-clamp-2 text-[0.95rem] leading-snug font-medium [overflow-wrap:anywhere]",
          closed(task.state) && "font-normal text-ink-soft",
        )}
      >
        {taskTitle(task, m)}
      </p>
      <Markers task={task} />
      <div className="flex min-w-0 items-center gap-[0.45rem] text-[0.85rem] text-ink-soft">
        <span className="shrink-0 font-mono text-[0.8rem] whitespace-nowrap tabular-nums text-ink-dim">{task.key}</span>
        <PriorityMark label={priorityLabel(task)} />
        {task.dueAt && (
          <span className="shrink-0">
            <DueText task={task} />
          </span>
        )}
        <span className="ml-auto flex min-w-[1.6rem] justify-end">
          {found ? (
            <SourceMark task={task} />
          ) : (
            assignee && <span className="min-w-0 truncate">{personName(assignee, people, m)}</span>
          )}
        </span>
        {!found && (
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
            className="-mr-[0.3rem] w-8 shrink-0 border-transparent! bg-transparent! px-1! hover:bg-app-3! [&>span]:hidden [&>svg]:block"
          />
        )}
      </div>
    </div>
  )
}
