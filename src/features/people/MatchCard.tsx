import { Check, LoaderCircle, PanelRightOpen } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { scopesOf } from "@/domain/people"
import { formatList, useLang, useMessages } from "@/i18n"
import type { Identity, Match } from "@/platform/people-schemas"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { InfoTip } from "@/ui/InfoTip"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import type { MatchGroup } from "./groups"
import { usePersonName } from "./labels"
import { peopleMessages } from "./messages"
import { Refusal } from "./Refusal"
import { accountName, SourceIcon, sourceOf } from "./sources"
import { usePeople } from "./store"

/** A side shows this many accounts; Details shows them all. */
const ACCOUNTS_SHOWN = 4

/** The account a match names on this person: its own on the first side, the one it would join on the second. */
const tieOf = (matches: readonly Match[], ref: string) => {
  for (const m of matches) {
    if (m.persons[0] === ref && m.identity) return m.identity
    if (m.persons[1] === ref && m.with) return m.with
  }
  return null
}

/**
 * People WireCat thinks may be one, side by side, with the account that ties them marked on each. Two people are one
 * match; three or more who share one phone or address are one group, and the owner ticks which of them are one person.
 * Decided, the card stays where it is and says what happened (rule 9).
 */
export function MatchCard({ group, from }: { group: MatchGroup; from?: string }) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const name = usePersonName()
  const decided = usePeople((s) => s.decided)
  const busyOf = usePeople((s) => s.busy)
  const failedOf = usePeople((s) => s.failed)
  const joined = usePeople((s) => s.joinedGroup[group.key])
  const { decide, joinGroup, rejectGroup, openMatch } = usePeople.getState()
  const open = group.matches.filter((x) => !decided[x.id])
  const first = open[0] ?? group.matches[0]
  const people = group.people
  const picking = open.length > 0 && people.length > 2
  const [picked, setPicked] = useState<string[]>(people)
  const peopleKey = people.join(" ")
  // biome-ignore lint/correctness/useExhaustiveDependencies: after a join the people are new, and all are ticked again
  useEffect(() => setPicked(people), [peopleKey])
  const asked = useRef(new Map<string, string>())
  const [asking, setAsking] = useState(false)
  const [why, setWhy] = useState("")
  const field = useId()
  const hint = useId()
  const head = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (asking) input.current?.focus({ preventScroll: true })
  }, [asking])
  if (!first) return null

  const ids = group.matches.map((x) => x.id)
  const busy = busyOf[group.key] ?? ids.map((id) => busyOf[id]).find(Boolean)
  const failed = failedOf[group.key] ?? ids.map((id) => failedOf[id]).find(Boolean)
  const done = open.length === 0
  const moving = first.joins === "identity" && first.identity
  const chosen = people.filter((p) => picked.includes(p))
  const all = chosen.length === people.length
  const said = (ref: string) => asked.current.get(ref) ?? name(ref)
  const spin = <LoaderCircle className="size-4 animate-spin" aria-hidden />

  const confirm = () => {
    for (const p of people) asked.current.set(p, name(p))
    if (picking) void joinGroup(group.key, chosen, ids)
    else void decide(from ?? first.persons[0] ?? "", first.id, "confirm").then((ok) => ok && forgetJoined(group.key))
  }
  const reject = (reason: string) => {
    if (picking) void rejectGroup(open, reason)
    else void decide(from ?? first.persons[0] ?? "", first.id, "reject", reason)
  }

  return (
    <article
      aria-labelledby={head}
      className="flex min-w-0 flex-col gap-[0.75rem] rounded-[0.45rem] border border-line bg-app px-[1.1rem] py-[0.95rem]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={head} className="min-w-0 font-medium">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => openMatch(group.key)}
            className="rounded-[0.2rem] text-left text-ink underline decoration-line-strong underline-offset-[0.2em] hover:decoration-brand"
          >
            {people.map((p) => name(p)).join(" · ")}
          </button>
        </h3>
        <Proposer match={first} />
      </div>
      <Signal group={group} match={first} names={people.map((p) => name(p))} />
      {moving && (
        <p className="text-[0.9rem] text-ink-soft">
          {m.moveHeading(moveWords(first, m.anAccount), name(first.persons[1] ?? ""))} {m.moveHelp}
        </p>
      )}
      {first.reason && <p className="selectable text-[0.95rem]">{first.reason}</p>}
      {picking && <p className="text-[0.9rem] text-ink-soft">{m.pickHelp}</p>}
      <div className={cx("grid gap-[0.6rem] md:grid-cols-2", people.length > 2 && "xl:grid-cols-3")}>
        {people.map((ref) => (
          <Side
            key={ref}
            reference={ref}
            tie={tieOf(open.length ? open : group.matches, ref)}
            decided={done}
            pick={
              picking
                ? {
                    on: picked.includes(ref),
                    set: (on) => setPicked((p) => (on ? [...p, ref] : p.filter((x) => x !== ref))),
                  }
                : null
            }
          />
        ))}
      </div>
      {joined && (
        <p role="status" className="reveal flex flex-wrap items-center gap-2 text-[0.95rem] text-ink-soft">
          <Check className="size-4 shrink-0 text-ok" aria-hidden />
          {m.joinedSome(formatList(joined.joined.map(said), lang))}
          {joined.stopped && <span className="text-bad">{m.stoppedAt(joined.stopped)}</span>}
        </p>
      )}
      <AutoHeight swap={done ? "done" : String(asking)}>
        {done ? (
          joined ? null : (
            <p role="status" className="reveal flex items-center gap-2 text-[0.95rem] text-ink-soft">
              <Check className="size-4 shrink-0 text-ok" aria-hidden />
              {m.decided[decided[first.id] ?? "confirm"]}
            </p>
          )
        ) : asking ? (
          <form
            className="flex flex-col gap-[0.45rem]"
            onSubmit={(e) => {
              e.preventDefault()
              if (why.trim()) reject(why.trim())
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
          <span className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              aria-haspopup="dialog"
              icon={<PanelRightOpen className="size-4" aria-hidden />}
              onClick={() => openMatch(group.key)}
            >
              {m.details}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!!busy || (picking && chosen.length < 2)}
              icon={busy === "confirm" ? spin : undefined}
              onClick={confirm}
            >
              {picking && !all ? m.joinPicked(chosen.length) : m.confirm}
            </Button>
            <Button size="sm" disabled={!!busy} onClick={() => setAsking(true)}>
              {m.reject}
            </Button>
            {picking && chosen.length < 2 && <span className="text-[0.85rem] text-ink-dim">{m.pickTwo}</span>}
          </span>
        )}
      </AutoHeight>
      {failed && <Refusal error={failed} />}
    </article>
  )
}

/** The last pair of a group decided on its own: the card then says that decision, not the earlier join. */
function forgetJoined(key: string) {
  usePeople.setState((s) => ({
    joinedGroup: Object.fromEntries(Object.entries(s.joinedGroup).filter(([k]) => k !== key)),
  }))
}

function moveWords(match: Match, anAccount: (source: string) => string) {
  const moved = usePeople.getState().details[match.persons[0] ?? ""]
  const i = moved?.state === "ready" ? moved.person.identities.find((x) => x.identity === match.identity) : undefined
  return i
    ? [sourceOf(i.provider).name, accountName(i)].filter(Boolean).join(" ")
    : anAccount(sourceOf(match.identity?.split(":")[0] ?? "").name)
}

/** Who found it, as a small label: WireCat's own matching, an agent by name, or a person. Why is in its tooltip. */
function Proposer({ match }: { match: Match }) {
  const m = useMessages(peopleMessages)
  const by = match.proposer
  if (!by) return null
  const [label, tip] =
    by.kind === "rule"
      ? [m.wirecat, m.wirecatTip]
      : by.name
        ? [by.name, by.kind === "agent" ? m.agentTip(by.name) : m.personTip]
        : [m.personTip, m.personTip]
  return (
    <InfoTip label={tip} align="end" trigger={<Pill tone={by.kind === "rule" ? "brand" : "neutral"}>{label}</Pill>}>
      {tip}
    </InfoTip>
  )
}

/** "Phone [same] [3]": what ties them, and how many people have it, with the details in each badge's tooltip. */
function Signal({ group, match, names }: { group: MatchGroup; match: Match; names: string[] }) {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const signal = match.signal ?? ""
  const sameTip = m.sameTip[signal]
  return (
    <p className="flex flex-wrap items-center gap-[0.4rem] text-[0.92rem]">
      <span className="font-medium text-ink-soft">{m.signalNames[signal] ?? signal}</span>
      {sameTip && (
        <InfoTip label={sameTip} trigger={<Pill>{m.same}</Pill>}>
          {sameTip}
          {match.evidence.length > 0 && (
            <>
              {" "}
              {m.evidence} <span className="selectable font-mono text-ink">{match.evidence.join(", ")}</span>
            </>
          )}
        </InfoTip>
      )}
      {sameTip && (
        <InfoTip
          label={m.sharedTip(group.sharing, formatList(names, lang))}
          trigger={<Pill>{group.sharing.toLocaleString(lang)}</Pill>}
        >
          {m.sharedTip(group.sharing, formatList(names, lang))}
        </InfoTip>
      )}
    </p>
  )
}

/**
 * One of the people: name, tasks, and their accounts by source, the one the match names marked. Once decided, the
 * people may be one now, so their accounts are not read again.
 */
function Side({
  reference,
  tie,
  decided,
  pick,
}: {
  reference: string
  tie: string | null
  decided: boolean
  pick: { on: boolean; set: (on: boolean) => void } | null
}) {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  const detail = usePeople((s) => s.details[reference])
  const tasks = usePeople((s) => s.people.find((p) => p.ref === reference)?.tasks ?? 0)
  const box = useId()
  useEffect(() => {
    if (!detail && !decided) usePeople.getState().need(reference)
  }, [detail, decided, reference])
  const identities = detail?.state === "ready" ? detail.person.identities : []
  // The tie first: it is what the owner compares.
  const ordered = [...identities.filter((i) => i.identity === tie), ...identities.filter((i) => i.identity !== tie)]
  const rest = ordered.length - ACCOUNTS_SHOWN
  const facts = [identities.length ? m.accountsN(identities.length) : null, tasks > 0 ? m.tasksOf(tasks) : null]
  return (
    <section
      aria-label={name(reference)}
      className={cx(
        "flex min-w-0 flex-col gap-[0.5rem] rounded-[0.35rem] bg-app-2 px-[0.85rem] py-[0.7rem] transition-opacity duration-(--motion-fast)",
        pick && !pick.on && "opacity-60",
      )}
    >
      <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-[0.5rem]">
          {pick && <Checkbox id={box} checked={pick.on} onChange={pick.set} aria-label={m.pick(name(reference))} />}
          <span className="min-w-0 truncate font-semibold text-ink">{name(reference)}</span>
        </span>
        <span className="text-[0.85rem] text-ink-dim tabular-nums">{facts.filter(Boolean).join(" · ")}</span>
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

/** A source, the account's name and its handle when it has both, and where it was seen. */
function Account({ identity: i, tie }: { identity: Identity; tie: boolean }) {
  const m = useMessages(peopleMessages)
  const handle = accountName(i)
  const named = i.name?.trim()
  return (
    <li
      className={cx(
        "flex min-w-0 flex-wrap items-center gap-x-[0.5rem] gap-y-[0.2rem] rounded-[0.3rem] px-[0.45rem] py-[0.25rem] text-[0.92rem]",
        tie && "bg-brand-soft text-ink ring-1 ring-brand/40",
      )}
    >
      <SourceIcon provider={i.provider} className={tie ? "text-brand" : "text-ink-soft"} />
      <span className="font-medium">{sourceOf(i.provider).name}</span>
      {named && <span className="min-w-0 truncate">{named}</span>}
      {handle && handle !== named && <span className="min-w-0 truncate text-ink-soft">{handle}</span>}
      {scopesOf(i.seenIn).map((s) => (
        <Pill key={s}>{m.scopes[s] ?? s}</Pill>
      ))}
      {tie && <span className="ml-auto text-[0.8rem] font-medium text-brand">{m.tie}</span>}
    </li>
  )
}
