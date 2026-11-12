import { Building2, Check, LoaderCircle } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { reasonOf } from "@/domain/people"
import { formatList, useLang, useMessages } from "@/i18n"
import type { MatchAnswer } from "@/platform/people-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import { CompanyAddress, CompanyButton, CompanyFollowUp } from "./Company"
import type { MatchGroup } from "./groups"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { sortMessages } from "./messages-sort"
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
  addresses = [],
}: {
  group: MatchGroup
  from?: string | undefined
  chosen: readonly string[]
  confirmLabel: string
  /** Before the two answers, such as the card's Details. */
  lead?: ReactNode
  /** Beside the answers, when the owner must do something first. */
  hint?: ReactNode
  /** The list where the people of a group are ticked; an answer with too few ticked puts focus there. Without it
   * (the details dialog, which has no ticks) the error is said and focus stays. */
  pickId?: string | undefined
  /** The two people's mail addresses, for "Company address" on a match by name. */
  addresses?: readonly string[]
}) {
  const m = useMessages(peopleMessages)
  const sm = useMessages(sortMessages)
  const lang = useLang()
  const name = usePersonName()
  const decided = usePeople((s) => s.decided)
  const busyOf = usePeople((s) => s.busy)
  const failedOf = usePeople((s) => s.failed)
  const joined = usePeople((s) => s.joinedGroup[group.key])
  const company = usePeople((s) => s.company[group.key])
  const offersAddress = usePeople((s) => s.companyMailbox)
  const offersCompany = usePeople((s) => s.oneCompany)
  const [addressing, setAddressing] = useState(false)
  const { decide, joinGroup, rejectGroup, resolveCompany } = usePeople.getState()
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
    reason.clear()
    if (asking) input.current?.focus({ preventScroll: true })
  }, [asking, reason.clear])
  const tooFew = picking && chosen.length < 2
  const few = useFieldError(pickId ?? `${field}-pick`, {
    live: { problem: tooFew ? (l) => peopleMessages[l].pickTwo : null },
  })
  if (!first) return null
  // A match by name alone may be two contacts of one company: one of their addresses may be the company's.
  const companyAddress = offersAddress && !group.mailbox && first.signal === "name" && addresses.length > 0

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
        </p>
      )}
      {joined?.stopped && <Stopped error={joined.stopped} />}
      <AutoHeight swap={done ? "done" : String(asking)}>
        {done ? (
          (joined && !last) || (company && !company.refused) ? null : (
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
              if (tooFew) few.fail()
              else if (why.trim()) reject(why.trim())
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
              <Button size="sm" onClick={() => setAsking(false)}>
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
            {offersCompany && (
              <Button
                size="sm"
                disabled={!!busy}
                icon={busy === "reject" ? spin : <Building2 className="size-4" aria-hidden />}
                onClick={() =>
                  tooFew
                    ? few.fail()
                    : void resolveCompany(
                        group.key,
                        (picking ? among : open).map((x) => x.id),
                        {},
                      )
                }
              >
                {sm.oneCompany}
              </Button>
            )}
            {group.mailbox && <CompanyButton group={group} />}
            {companyAddress && (
              <Button
                size="sm"
                disabled={!!busy}
                aria-expanded={addressing}
                icon={<Building2 className="size-4" aria-hidden />}
                onClick={() => setAddressing((v) => !v)}
              >
                {m.companyAddress}
              </Button>
            )}
            {few.error === null && hint}
          </span>
        )}
      </AutoHeight>
      {few.hint}
      {failed && <Refusal error={failed} />}
      {companyAddress && addressing && !done && (
        <CompanyAddress group={group} addresses={addresses} onCancel={() => setAddressing(false)} />
      )}
      {(group.mailbox || company) && <CompanyFollowUp group={group} />}
    </>
  )
}

/** Why a join stopped part way: memo's known reasons in words, anything else under Details. */
function Stopped({ error }: { error: string }) {
  const m = useMessages(peopleMessages)
  const reason = reasonOf(error)
  return (
    <ErrorNotice inline raw={reason ? null : error}>
      {reason ? m.stoppedAt(m.reasons[reason]) : m.stopped}
    </ErrorNotice>
  )
}
