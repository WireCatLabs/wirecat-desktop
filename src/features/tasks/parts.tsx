import { Lock } from "lucide-react"
import { claimActive, closed, dueTone, type Label, labelOf, type State } from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import type { Person, Task } from "@/platform/task-schemas"
import { cx } from "@/ui/cx"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { dueDay, type TaskWords, taskMessages } from "./messages"
import { useTasks } from "./store"

export const STATE_TONE: Record<State, LampTone> = {
  open: "idle",
  todo: "warn",
  in_progress: "doing",
  done: "ok",
  dismissed: "off",
}

export function StateLamp({ state }: { state: State }) {
  return <Lamp tone={STATE_TONE[state]} size="sm" />
}

export function StateText({ state }: { state: State }) {
  const m = useMessages(taskMessages)
  return (
    <span className="flex min-w-0 items-center gap-[0.5rem] text-[0.9rem]">
      <StateLamp state={state} />
      <span className="truncate">{m.states[state]}</span>
    </span>
  )
}

/** Three bars and the word; red and amber only for critical and high. */
export function PriorityMark({ label }: { label: Label | null }) {
  const m = useMessages(taskMessages)
  const filled = label === "critical" ? 3 : label === "high" ? 2 : label === "medium" ? 1 : 0
  return (
    <span className="inline-flex min-w-0 items-center gap-[0.4rem] text-[0.9rem] text-ink-soft">
      <span
        aria-hidden
        className={cx(
          "inline-flex h-[0.8rem] shrink-0 items-end gap-[2px]",
          label === "critical" ? "text-bad" : label === "high" ? "text-warn" : "text-ink-dim",
        )}
      >
        {[0, 1, 2].map((b) => (
          <span
            key={b}
            className={cx("w-[3px] rounded-[1px] bg-current", b >= filled && "opacity-25")}
            style={{ height: `${(b + 1) * 33}%` }}
          />
        ))}
      </span>
      <span className="truncate">{m.labels[label ?? "none"]}</span>
    </span>
  )
}

export const priorityLabel = (t: Task): Label | null => t.priorityLabel ?? labelOf(t.priority)

export function DueText({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const lang = useLang()
  if (!task.dueAt) return <span className="text-ink-dim">—</span>
  const tone = dueTone(task.dueAt, task.state)
  // A long "late" word (ru "просрочено") moves under the date instead of being cut.
  return (
    <span
      className={cx(
        "inline-flex min-w-0 flex-wrap items-baseline gap-x-[0.35rem] leading-[1.15]",
        tone === "late" ? "text-bad" : tone === "soon" ? "text-warn-ink" : "text-ink-soft",
      )}
    >
      <span className="font-mono text-[0.9rem] tabular-nums">{dueDay(task.dueAt, lang)}</span>
      {tone === "late" && <span className="text-[0.85rem]">{m.late}</span>}
    </span>
  )
}

export function personName(ref: string, people: readonly Person[], m: TaskWords): string {
  const p = people.find((x) => x.ref === ref)
  if (p?.owner) return m.you
  return p?.name ?? m.unnamed
}

/** "waits for HRB-14" while a blocker is open; "hermes is on it" while an agent's claim holds. */
export function Markers({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const waiting = task.blockedBy.filter((b) => !closed(b.state as State)).map((b) => b.key)
  const claim = task.claimedBy && claimActive(task.claimedUntil) ? task.claimedBy : null
  const agent = !claim && task.agent ? task.agent : null
  if (waiting.length === 0 && !claim && !agent) return null
  return (
    <span className="flex flex-wrap gap-x-[0.9rem] gap-y-[0.15rem]">
      {waiting.length > 0 && (
        <span className="inline-flex items-center gap-[0.3rem] text-[0.85rem] text-warn-ink">
          <Lock className="size-[0.85rem] shrink-0" aria-hidden />
          <span>
            {/* The sentence is the language's own; only the keys inside it become links. */}
            {m
              .waitsFor(waiting.map((k) => `\u0000${k}\u0000`))
              .split("\u0000")
              .map((part, i) =>
                i % 2 === 1 ? (
                  <TaskLink key={part} taskKey={part} />
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the words between keys have no identity of their own
                  <span key={`w${i}`}>{part}</span>
                ),
              )}
          </span>
        </span>
      )}
      {claim && (
        <span className="inline-flex items-center gap-[0.35rem] text-[0.85rem] text-ink-soft">
          <Lamp tone="busy" size="sm" />
          {m.onIt(claim)}
        </span>
      )}
      {agent && (
        <span className="inline-flex items-center gap-[0.35rem] text-[0.85rem] text-ink-soft">{m.forAgent(agent)}</span>
      )}
    </span>
  )
}

/** A task's key that opens that task in the dialog, wherever it is mentioned. */
export function TaskLink({ taskKey }: { taskKey: string }) {
  const m = useMessages(taskMessages)
  return (
    <button
      type="button"
      aria-label={m.open(taskKey)}
      aria-haspopup="dialog"
      onClick={(e) => {
        e.stopPropagation()
        void useTasks.getState().openTask(taskKey)
      }}
      className="cursor-pointer rounded-[0.2rem] font-mono underline decoration-dotted underline-offset-[3px] hover:text-brand hover:decoration-solid focus-visible:outline-2 focus-visible:outline-brand"
    >
      {taskKey}
    </button>
  )
}
