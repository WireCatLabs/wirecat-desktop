import { GripVertical } from "lucide-react"
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useRef } from "react"
import { anchorOf, closed, fromMessages, STATES, type State } from "@/domain/tasks"
import { useMessages } from "@/i18n"
import type { Task } from "@/platform/task-schemas"
import { Board, BoardColumn, cardClass, DragCopy, DropLine, useBoardDrag, useSlide } from "@/ui/Board"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Select } from "@/ui/Select"
import { taskMessages } from "./messages"
import { StaleLine } from "./Note"
import { DueText, Markers, PriorityMark, personName, priorityLabel, StateLamp } from "./parts"
import { useTasks } from "./store"

export function TaskBoard() {
  const m = useMessages(taskMessages)
  const tasks = useTasks((s) => s.tasks)
  const order = useTasks((s) => s.order)
  const query = useTasks((s) => s.query)
  const byKey = new Map(tasks.map((t) => [t.key, t]))
  const column = (s: State) => order.filter((k) => byKey.get(k)?.state === s)
  const board = useRef<HTMLDivElement>(null)
  useSlide(board, `${order.join()}|${tasks.map((t) => t.state).join()}`)
  const { drag, held, said, shown, onPointerDown, onClick, onKeyDown } = useBoardDrag<State>({
    columns: STATES,
    cardsIn: column,
    columnOf: (key) => byKey.get(key)?.state,
    canDrop: (key, to) => !fromMessages(byKey.get(key) ?? {}) || byKey.get(key)?.state === to,
    onDrop: ({ key, to, before }) => {
      const keys = column(to).filter((k) => k !== key)
      const index = before ? keys.indexOf(before) : keys.length
      void useTasks.getState().move(key, to, anchorOf(keys, key, index < 0 ? keys.length : index), before)
    },
    onOpen: (key) => void useTasks.getState().openTask(key),
    words: {
      picked: m.picked,
      place: (s, at, of) => m.place(m.states[s], at, of),
      dropped: (key, s) => m.dropped(key, m.states[s]),
      putBack: m.putBack,
    },
  })

  const dragged = drag ? byKey.get(drag.key) : undefined
  const showsClosedDefault = !/(^|[\s(-])(state|closed):/.test(query)
  return (
    <>
      <p className="sr-only" id="tasks-drag-hint">
        {m.dragHint}
      </p>
      <Board columns={STATES.length} boardRef={board}>
        {STATES.map((s) => {
          const keys = column(s)
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
            >
              {shown(s).map((k) => {
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
      className={cardClass(ghost, held)}
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
