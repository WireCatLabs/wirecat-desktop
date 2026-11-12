import { FileText, Lock, Video } from "lucide-react"
import type { ReactNode } from "react"
import { findTool } from "@/domain/catalog"
import { linkTargetOf, toolOfProvider } from "@/domain/links"
import { nameOrNumber } from "@/domain/people"
import { taskFailure } from "@/domain/task-failure"
import {
  bareTitleKind,
  claimActive,
  closed,
  dueTone,
  fromMessages,
  type Label,
  labelOf,
  type State,
} from "@/domain/tasks"
import { useLang, useMessages } from "@/i18n"
import type { Person, Task } from "@/platform/task-schemas"
import { ToolIcon } from "@/shared/ToolIcon"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { dueDay, type TaskWords, taskMessages } from "./messages"
import { useTasks } from "./store"

const STATE_TONE: Record<State, LampTone> = {
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

/**
 * Three bars, red and amber only for critical and high; the word is in the tooltip and for a screen reader. No priority
 * shows nothing, so a card says only what was set.
 */
export function PriorityMark({ label }: { label: Label | null }) {
  const m = useMessages(taskMessages)
  if (!label) return null
  const filled = label === "critical" ? 3 : label === "high" ? 2 : label === "medium" ? 1 : 0
  const tone = label === "critical" ? "text-bad" : label === "high" ? "text-warn" : "text-ink-dim"
  return <Bars filled={filled} tone={tone} label={m.priorityIs(m.labels[label])} />
}

/** Three rising bars, `filled` of them solid; with a `label` they are an image that says it, else decoration. */
export function Bars({ filled, tone, label }: { filled: number; tone: string; label?: string }) {
  return (
    <span
      {...(label ? { role: "img", "aria-label": label, title: label } : { "aria-hidden": true })}
      className={cx("inline-flex h-[0.8rem] shrink-0 items-end gap-[2px]", tone)}
    >
      {[0, 1, 2].map((b) => (
        <span
          key={b}
          className={cx("w-[3px] rounded-[1px] bg-current", b >= filled && "opacity-25")}
          style={{ height: `${(b + 1) * 33}%` }}
        />
      ))}
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
  return nameOrNumber(p?.name) ?? m.unnamed
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

/** What a task is called on screen: a found task whose title is only its message's address reads as its kind. */
export function taskTitle(task: Task, m: TaskWords): string {
  const kind = bareTitleKind(task)
  if (kind === null) return task.title
  const named = task.kind ?? kind
  return (Object.hasOwn(m.foundTitle, named) ? m.foundTitle[named] : m.foundTitle.other) ?? task.title
}

const MAIL = new Set(["email", "mail", "gmail"])

export type Origin =
  | { kind: "chat"; provider: string }
  | { kind: "mail"; provider: string }
  | { kind: "meeting"; provider: null }
  | { kind: "document"; provider: null }

/** What a found task came from: a chat or a mailbox by its provider, or a meeting or a document by its reference. */
export function originOf(task: Pick<Task, "source" | "account">): Origin | null {
  const source = task.source ?? ""
  if (source.startsWith("meeting:")) return { kind: "meeting", provider: null }
  if (/^(document|note):/.test(source)) return { kind: "document", provider: null }
  const target = source ? linkTargetOf(source) : null
  const provider = (target?.type === "message" ? target.provider : null) ?? task.account?.split(":")[0]
  if (!provider) return null
  return MAIL.has(provider) ? { kind: "mail", provider } : { kind: "chat", provider }
}

/** The origin's name and the app's own mark for it: the messenger's logo, mail, a meeting or a document. */
export function OriginMark({ origin, className }: { origin: Origin; className?: string }) {
  const size = cx("size-[0.95rem] shrink-0", className)
  if (origin.kind === "meeting") return <Video className={size} aria-hidden />
  if (origin.kind === "document") return <FileText className={size} aria-hidden />
  if (origin.kind === "mail") return <ToolIcon id="email" className={size} />
  return <ToolIcon id={toolOfProvider(origin.provider)} className={size} />
}

export function useOriginName() {
  const m = useMessages(taskMessages)
  return (origin: Origin) =>
    origin.kind === "chat" ? (findTool(toolOfProvider(origin.provider))?.name ?? origin.provider) : m[origin.kind]
}

/**
 * Where a found task came from, as an icon and the app. Plain text, not a tip: on a card a tip opened past the
 * column's edge, and the card is itself the button that opens the task.
 */
export function SourceMark({ task }: { task: Task }) {
  const m = useMessages(taskMessages)
  const nameOf = useOriginName()
  const origin = fromMessages(task) ? originOf(task) : null
  if (!origin) return null
  return (
    <span title={m.fromMessages} className="inline-flex min-w-0 items-center gap-[0.3rem] text-[0.85rem] text-ink-soft">
      <OriginMark origin={origin} className="size-[0.85rem]" />
      <span className="truncate">{m.foundIn(nameOf(origin))}</span>
    </span>
  )
}

/** A refused write in one line of plain words with what to do; memo's own words, already masked, behind a click. */
export function TaskError({
  lead,
  raw,
  action,
  reading = false,
}: {
  lead: string
  raw: string
  action?: ReactNode
  /** A read that failed: nothing was refused, so the words for a refused change do not fit. */
  reading?: boolean
}) {
  const m = useMessages(taskMessages)
  const kind = taskFailure(raw)
  return (
    <ErrorNotice
      inline
      action={action}
      detail={
        // On a card, pointer down starts a drag, a click opens the task and Space picks it up: the details only fold.
        // biome-ignore lint/a11y/noStaticElementInteractions: it only keeps the card's own handlers out
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Disclosure summary={m.failureDetails}>
            <p className="font-mono text-[0.8rem] [overflow-wrap:anywhere] text-ink-soft">{raw}</p>
          </Disclosure>
        </div>
      }
    >
      {lead} {reading && kind === "other" ? m.readWhy : m.failure[kind]}
    </ErrorNotice>
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
      data-task-link
      onClick={(e) => {
        e.stopPropagation()
        void useTasks.getState().openTask(taskKey)
      }}
      className="cursor-pointer rounded-rack font-mono underline decoration-dotted underline-offset-[3px] hover:text-brand hover:decoration-solid focus-visible:outline-2 focus-visible:outline-brand"
    >
      {taskKey}
    </button>
  )
}
