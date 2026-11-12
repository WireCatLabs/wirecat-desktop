import { Check } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { Identity, PersonDetail, Split } from "@/platform/people-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { invalidBorder, useFieldError } from "@/ui/FieldError"
import { Skeleton } from "@/ui/Skeleton"
import { usePersonName } from "./labels"
import { Account, Proposer } from "./MatchCard"
import { peopleMessages } from "./messages"
import { Refusal } from "./Refusal"
import { accountName, sourceOf } from "./sources"
import { usePeople } from "./store"

/** A ref memo gave, in words: the account's source and name from the person's own read, never the id itself. */
function useAccountWords() {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  return (ref: string, person: PersonDetail | null): string => {
    const merge = person?.merges.find((x) => x.id === ref)
    if (ref.startsWith("merge:"))
      return merge?.at ? m.joinOf(formatDate(merge.at, { dateStyle: "medium" }, lang)) : m.aJoin
    const held = person?.identities.find((i) => i.identity === ref)
    const source = sourceOf(ref.split(":")[0] ?? "").name
    const name = held ? accountName(held) : null
    return name ? `${source} ${name}` : m.anAccount(source)
  }
}

/**
 * An agent says some accounts of one person are someone else's. The owner sees whose they are, the agent's reason and
 * what it rests on, and splits or keeps them together; keeping them asks why, with a default the owner can edit.
 * Decided, the card stays where it is and says what happened (rule 9).
 */
export function SplitCard({ split }: { split: Split }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const words = useAccountWords()
  const detail = usePeople((s) => s.details[split.person])
  const decided = usePeople((s) => s.splitDecided[split.id])
  const busy = usePeople((s) => s.busy[split.id])
  const failed = usePeople((s) => s.failed[split.id])
  const { decideSplit, need, reveal } = usePeople.getState()
  const head = useId()
  const field = useId()
  const [asking, setAsking] = useState(false)
  const [why, setWhy] = useState(m.keepDefault)
  const reason = useFieldError(field)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!detail && !decided) need(split.person)
  }, [detail, decided, need, split.person])
  useEffect(() => {
    if (asking) input.current?.select()
  }, [asking])

  const person = detail?.state === "ready" ? detail.person : null
  // Split, the person no longer holds these accounts: the card keeps naming them as it did before.
  const held = useRef<Record<string, Identity>>({})
  for (const i of person?.identities ?? []) if (split.identities.includes(i.identity)) held.current[i.identity] = i
  const leaving: (Identity | string)[] = split.identities.map((ref) => held.current[ref] ?? ref)
  const from = split.merge ? person?.merges.find((x) => x.id === split.merge)?.from : null
  const evidence = split.evidence.filter((e) => !split.identities.includes(e) && e !== split.merge)

  return (
    <article
      aria-labelledby={head}
      className="flex min-w-0 flex-col gap-[0.75rem] rounded-inset border border-line bg-app px-[1.1rem] py-[0.95rem]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={head} className="min-w-0 font-medium">
          {split.op === "unmerge" ? m.unmergeHeading : m.splitHeading}{" "}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => reveal(split.person)}
            className="rounded-rack text-left text-ink underline decoration-line-strong underline-offset-[0.2em] hover:decoration-brand"
          >
            {name(split.person)}
          </button>
        </h3>
        <Proposer by={split.proposer} />
      </div>
      <section className="flex flex-col gap-[0.4rem] rounded-control border border-line px-[0.85rem] py-[0.7rem]">
        <p className="text-[0.9rem] text-ink-soft">
          {split.op !== "unmerge" ? m.becomeNew : from && name(from) !== m.noName ? m.goBackTo(name(from)) : m.goBack}
        </p>
        {!detail || detail.state === "loading" ? (
          <Skeleton className="h-[1.6rem] w-[70%]" label={m.loadingPerson} />
        ) : (
          <ul className="flex flex-col gap-[0.3rem]">
            {leaving.map((i) =>
              typeof i === "string" ? (
                <li key={i} className="text-[0.92rem]">
                  {words(i, person)}
                </li>
              ) : (
                <Account key={i.identity} identity={i} />
              ),
            )}
          </ul>
        )}
      </section>
      {split.reason && (
        <p className="selectable text-[0.95rem]">
          <span className="text-ink-soft">{m.agentSays} </span>
          {split.reason}
        </p>
      )}
      {evidence.length > 0 && (
        <p className="text-[0.9rem] text-ink-soft">
          {m.restsOn} {evidence.map((e) => words(e, person)).join(" · ")}
        </p>
      )}
      <AutoHeight swap={decided ? "done" : String(asking)}>
        {decided ? (
          <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
            <Check className="size-4 shrink-0 text-ok" aria-hidden />
            {m.splitDecided[decided]}
          </p>
        ) : asking ? (
          <form
            className="flex flex-col gap-[0.45rem]"
            onSubmit={(e) => {
              e.preventDefault()
              if (why.trim()) void decideSplit(split.id, "reject", why.trim())
              else reason.fail((l) => peopleMessages[l].keepWhyNeeded)
            }}
          >
            <label htmlFor={field} className="text-[0.95rem] font-medium">
              {m.keepWhy}
            </label>
            <input
              ref={input}
              id={field}
              maxLength={500}
              value={why}
              aria-invalid={reason.field["aria-invalid"]}
              aria-describedby={reason.field["aria-describedby"]}
              onChange={(e) => {
                reason.clear()
                setWhy(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return
                e.preventDefault()
                setAsking(false)
              }}
              className={cx(
                "selectable h-10 w-full rounded-control border border-line-strong bg-app px-3 text-[1rem]",
                invalidBorder,
              )}
            />
            {reason.hint}
            <span className="flex gap-2">
              <Button type="submit" size="sm" disabled={!!busy} busy={!!busy}>
                {m.keepNow}
              </Button>
              <Button size="sm" onClick={() => setAsking(false)}>
                {m.cancel}
              </Button>
            </span>
          </form>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              busy={busy === "confirm"}
              onClick={() => void decideSplit(split.id, "confirm")}
            >
              {split.op === "unmerge" ? m.undo : m.splitNow}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => setAsking(true)}>
              {m.keepTogether}
            </Button>
          </span>
        )}
      </AutoHeight>
      {failed && <Refusal error={failed} />}
    </article>
  )
}
