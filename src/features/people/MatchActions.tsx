import { Check, LoaderCircle } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { type PeopleReason, reasonOf } from "@/domain/people"
import { formatList, useLang, useMessages } from "@/i18n"
import type { MatchAnswer } from "@/platform/people-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import type { MatchGroup } from "./groups"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { Refusal } from "./Refusal"
import { usePeople } from "./store"

/**
 * Same person and Not the same for a match or a group, on its card and in its dialog. "Not the same" asks why, as memo
 * requires. Decided, it stays where it is and says what happened (rule 9); `chosen` are the people to join of a group.
 */
export function MatchActions({
  group,
  from,
  chosen,
  confirmLabel,
  lead,
  hint,
  pickId,
}: {
  group: MatchGroup
  from?: string | undefined
  chosen: readonly string[]
  confirmLabel: string
  /** Before the two answers, such as the card's Details. */
  lead?: ReactNode
  /** Beside the answers, when the owner must do something first. */
  hint?: ReactNode
  /** The list where the people of a group are ticked; an answer with too few ticked puts focus there. */
  pickId?: string | undefined
}) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const name = usePersonName()
  const decided = usePeople((s) => s.decided)
  const busyOf = usePeople((s) => s.busy)
  const failedOf = usePeople((s) => s.failed)
  const joined = usePeople((s) => s.joinedGroup[group.key])
  const { decide, joinGroup, rejectGroup } = usePeople.getState()
  const open = group.matches.filter((x) => !decided[x.id])
  const first = open[0] ?? group.matches[0]
  const people = group.people
  const picking = open.length > 0 && people.length > 2
  const [last, setLast] = useState<MatchAnswer | null>(null)
  // Names as they were when the owner answered: a join re-reads the people, and the one merged away loses its name.
  const asked = useRef(new Map<string, string>())
  const [asking, setAsking] = useState(false)
  const [why, setWhy] = useState("")
  const field = useId()
  const hintId = useId()
  const reason = useFieldError(field)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (asking) input.current?.focus({ preventScroll: true })
  }, [asking])
  const tooFew = picking && chosen.length < 2
  const few = useFieldError(pickId ?? `${field}-pick`, {
    live: { problem: tooFew ? (l) => peopleMessages[l].pickTwo : null },
  })
  if (!first) return null

  const ids = group.matches.map((x) => x.id)
  const busy = busyOf[group.key] ?? ids.map((id) => busyOf[id]).find(Boolean)
  const failed = failedOf[group.key] ?? ids.map((id) => failedOf[id]).find(Boolean)
  const done = open.length === 0
  const among = open.filter((x) => x.persons.every((p) => chosen.includes(p)))
  const said = (ref: string) => asked.current.get(ref) ?? name(ref)
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />

  const confirm = () => {
    for (const p of people) asked.current.set(p, name(p))
    setLast(picking ? null : "confirm")
    if (picking) void joinGroup(group.key, [...chosen], ids)
    else void decide(from ?? first.persons[0] ?? "", first.id, "confirm")
  }
  // Chosen people only: leaving one out says "the others are not one; this one I have not decided".
  const reject = (reason: string) => {
    setLast("reject")
    if (picking) void rejectGroup(group.key, among, reason)
    else void decide(from ?? first.persons[0] ?? "", first.id, "reject", reason)
  }

  return (
    <>
      {joined && (
        <p role="status" className="reveal flex flex-wrap items-center gap-2 text-[0.95rem] text-ink-soft">
          <Check className="size-4 shrink-0 text-ok" aria-hidden />
          {m.joinedSome(formatList(joined.joined.map(said), lang))}
          {joined.stopped && <span className="text-bad">{m.stoppedAt(stoppedWords(joined.stopped, m.reasons))}</span>}
        </p>
      )}
      <AutoHeight swap={done ? "done" : String(asking)}>
        {done ? (
          joined && !last ? null : (
            <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
              <Check className="size-4 shrink-0 text-ok" aria-hidden />
              {m.decided[last ?? decided[first.id] ?? "confirm"]}
            </p>
          )
        ) : asking ? (
          <form
            className="flex flex-col gap-[0.45rem]"
            onSubmit={(e) => {
              e.preventDefault()
              if (why.trim()) reject(why.trim())
              else reason.fail((l) => peopleMessages[l].rejectWhyNeeded)
            }}
          >
            <label htmlFor={field} className="text-[0.95rem] font-medium">
              {m.rejectWhy}
            </label>
            <input
              ref={input}
              id={field}
              maxLength={500}
              value={why}
              aria-invalid={reason.field["aria-invalid"]}
              aria-describedby={cx(reason.field["aria-describedby"], hintId)}
              onChange={(e) => {
                reason.clear()
                setWhy(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return
                // Escape closes the question, not the dialog around it.
                e.preventDefault()
                e.stopPropagation()
                setAsking(false)
              }}
              className={cx(
                "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 text-[1rem]",
                invalidBorder,
              )}
            />
            {reason.hint}
            <p id={hintId} className="text-[0.9rem] text-ink-soft">
              {m.rejectHint}
            </p>
            <span className="flex gap-2">
              <Button type="submit" size="sm" disabled={!!busy} icon={busy ? spin : undefined}>
                {m.rejectNow}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
                {m.cancel}
              </Button>
            </span>
          </form>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            {lead}
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              icon={busy === "confirm" ? spin : undefined}
              onClick={() => (tooFew ? few.fail() : confirm())}
            >
              {confirmLabel}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => (tooFew ? few.fail() : setAsking(true))}>
              {m.reject}
            </Button>
            {few.error === null && hint}
          </span>
        )}
      </AutoHeight>
      {few.hint}
      {failed && <Refusal error={failed} />}
    </>
  )
}

const stoppedWords = (error: string, reasons: Record<PeopleReason, string>) => {
  const reason = reasonOf(error)
  return reason ? reasons[reason] : error
}
