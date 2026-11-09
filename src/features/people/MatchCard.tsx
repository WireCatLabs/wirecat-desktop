import { Check, LoaderCircle, PanelRightOpen } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { scopesOf } from "@/domain/people"
import { useMessages } from "@/i18n"
import type { Identity, Match } from "@/platform/people-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { Refusal } from "./Refusal"
import { accountName, SourceIcon, sourceOf } from "./sources"
import { usePeople } from "./store"

/** A side shows this many accounts; Details shows them all. */
const ACCOUNTS_SHOWN = 4

/**
 * Two people WireCat thinks may be one, side by side, with the account that ties them marked on each side. Same person
 * joins them; Not the same asks the owner's reason. Decided, the card stays where it is and says what happened (rule 9).
 */
export function MatchCard({ match, from }: { match: Match; from: string }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const decided = usePeople((s) => s.decided[match.id])
  const busy = usePeople((s) => s.busy[match.id])
  const failed = usePeople((s) => s.failed[match.id])
  const [a = "", b = ""] = match.persons
  const moved = usePeople((s) => {
    const d = s.details[a]
    return d?.state === "ready" ? d.person.identities.find((i) => i.identity === match.identity) : undefined
  })
  const { decide, openMatch } = usePeople.getState()
  const [asking, setAsking] = useState(false)
  const [why, setWhy] = useState("")
  const field = useId()
  const hint = useId()
  const head = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (asking) input.current?.focus({ preventScroll: true })
  }, [asking])
  const moving = match.joins === "identity" && match.identity
  const by = match.proposer
  const proposed = !by ? null : by.kind === "rule" ? m.foundBy : by.name ? m.suggestedBy(by.name) : m.suggestedByPerson
  const movedWords = moved
    ? [sourceOf(moved.provider).name, accountName(moved)].filter(Boolean).join(" ")
    : m.anAccount(sourceOf(match.identity?.split(":")[0] ?? "").name)
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />

  return (
    <article
      aria-labelledby={head}
      className="flex min-w-0 flex-col gap-[0.8rem] rounded-[0.45rem] border border-line bg-app px-[1.1rem] py-[0.95rem]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={head} className="font-medium">
            {moving ? m.moveHeading(movedWords, name(b)) : m.joinHeading(name(a), name(b))}
          </h3>
          <p className="mt-[0.15rem] text-[0.9rem] text-ink-soft">
            {[
              match.signal ? m.signals[match.signal] : null,
              match.candidates.length > 2 ? m.candidates(match.candidates.length) : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
        </div>
        <Button
          size="sm"
          aria-haspopup="dialog"
          icon={<PanelRightOpen className="size-4" aria-hidden />}
          onClick={() => openMatch(match.id)}
        >
          {m.details}
        </Button>
      </div>
      <div className="grid gap-[0.6rem] md:grid-cols-2">
        <Side reference={a} tie={match.identity} decided={!!decided} />
        <Side reference={b} tie={match.with} decided={!!decided} />
      </div>
      {moving && <p className="text-[0.9rem] text-ink-soft">{m.moveHelp}</p>}
      {match.reason && <p className="selectable text-[0.95rem]">{match.reason}</p>}
      {match.evidence.length > 0 && (
        <p className="text-[0.9rem] text-ink-soft">
          {m.evidence}{" "}
          <mark className="selectable rounded-[0.2rem] bg-brand-soft px-[0.3rem] font-mono text-ink">
            {match.evidence.join(", ")}
          </mark>
        </p>
      )}
      {proposed && <p className="text-[0.85rem] text-ink-dim">{proposed}</p>}
      <AutoHeight swap={decided ? "done" : String(asking)}>
        {decided ? (
          <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
            <Check className="size-4 shrink-0 text-ok" aria-hidden />
            {m.decided[decided]}
          </p>
        ) : asking ? (
          <form
            className="flex flex-col gap-[0.45rem]"
            onSubmit={(e) => {
              e.preventDefault()
              if (why.trim()) void decide(from, match.id, "reject", why.trim())
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
              aria-describedby={hint}
              onChange={(e) => setWhy(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
              className="selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 text-[1rem]"
            />
            <p id={hint} className="text-[0.9rem] text-ink-soft">
              {m.rejectHint}
            </p>
            <span className="flex gap-2">
              <Button type="submit" size="sm" disabled={!why.trim() || !!busy} icon={busy ? spin : undefined}>
                {m.rejectNow}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
                {m.cancel}
              </Button>
            </span>
          </form>
        ) : (
          <span className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy}
              icon={busy === "confirm" ? spin : undefined}
              onClick={() => void decide(from, match.id, "confirm")}
            >
              {m.confirm}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => setAsking(true)}>
              {m.reject}
            </Button>
          </span>
        )}
      </AutoHeight>
      {failed && <Refusal error={failed} />}
    </article>
  )
}

/**
 * One of the two people: name, tasks, and their accounts by source, the one the match names marked. Once decided, the
 * people may be one now, so their accounts are not read again.
 */
function Side({ reference, tie, decided }: { reference: string; tie: string | null; decided: boolean }) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const detail = usePeople((s) => s.details[reference])
  const tasks = usePeople((s) => s.people.find((p) => p.ref === reference)?.tasks ?? 0)
  useEffect(() => {
    if (!detail && !decided) usePeople.getState().need(reference)
  }, [detail, decided, reference])
  const identities = detail?.state === "ready" ? detail.person.identities : []
  // The tie first: it is what the owner compares.
  const ordered = [...identities.filter((i) => i.identity === tie), ...identities.filter((i) => i.identity !== tie)]
  const rest = ordered.length - ACCOUNTS_SHOWN
  return (
    <section
      aria-label={name(reference)}
      className="flex min-w-0 flex-col gap-[0.5rem] rounded-[0.35rem] bg-app-2 px-[0.85rem] py-[0.7rem]"
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="min-w-0 truncate font-semibold text-ink">{name(reference)}</span>
        {tasks > 0 && <span className="text-[0.85rem] text-ink-dim tabular-nums">{m.tasksOf(tasks)}</span>}
      </p>
      {decided && detail?.state !== "ready" ? null : !detail || detail.state === "loading" ? (
        <div className="flex flex-col gap-[0.4rem]">
          <Skeleton className="h-[1.6rem] w-full" label={m.loadingPerson} />
          <Skeleton className="h-[1.6rem] w-[70%]" />
        </div>
      ) : detail.state === "failed" ? (
        <ErrorNotice inline>
          {m.personFailed} {detail.error}
        </ErrorNotice>
      ) : (
        <ul className="flex flex-col gap-[0.3rem]">
          {ordered.slice(0, ACCOUNTS_SHOWN).map((i) => (
            <Account key={i.identity} identity={i} tie={i.identity === tie} />
          ))}
          {rest > 0 && <li className="text-[0.85rem] text-ink-dim">{m.moreAccounts(rest)}</li>}
        </ul>
      )}
    </section>
  )
}

function Account({ identity: i, tie }: { identity: Identity; tie: boolean }) {
  const m = useMessages(peopleMessages)
  const words = accountName(i)
  return (
    <li
      className={cx(
        "flex min-w-0 flex-wrap items-center gap-x-[0.5rem] gap-y-[0.2rem] rounded-[0.3rem] px-[0.45rem] py-[0.25rem] text-[0.92rem]",
        tie && "bg-brand-soft text-ink ring-1 ring-brand/40",
      )}
    >
      <SourceIcon provider={i.provider} className={tie ? "text-brand" : "text-ink-soft"} />
      <span className="font-medium">{sourceOf(i.provider).name}</span>
      {words && <span className="min-w-0 truncate text-ink-soft">{words}</span>}
      {scopesOf(i.seenIn).map((s) => (
        <Pill key={s}>{m.scopes[s] ?? s}</Pill>
      ))}
      {tie && <span className="ml-auto text-[0.8rem] font-medium text-brand">{m.tie}</span>}
    </li>
  )
}
