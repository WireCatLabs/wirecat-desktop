import { ArrowLeft, ArrowRight } from "lucide-react"
import { useEffect, useId } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Lamp } from "@/ui/Lamp"
import { Pager } from "@/ui/Pager"
import { groupMatches } from "./groups"
import { MatchCard } from "./MatchCard"
import { peopleMessages } from "./messages"
import { SplitCard } from "./SplitCard"
import { usePeople } from "./store"

/** Each card reads both of its people, so a page stays short. */
const PAGE = 10

/** On the people list: how many matches wait, and the way to them. */
export function MatchesWaiting() {
  const m = useMessages(peopleMessages)
  const waiting = usePeople(
    (s) => groupMatches(s.matches, s.decided).filter((g) => g.matches.some((x) => !s.decided[x.id])).length,
  )
  const splits = usePeople((s) => s.splits.filter((x) => !s.splitDecided[x.id]).length)
  const head = useId()
  if (waiting + splits === 0) return null
  return (
    <section
      aria-labelledby={head}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[0.45rem] border border-warn/35 bg-warn/[0.07] px-[1.1rem] py-[0.85rem]"
    >
      <div className="min-w-0">
        <h2 id={head} className="flex items-center gap-2 font-semibold">
          <Lamp tone="warn" size="sm" />
          {waiting > 0 ? m.waiting(waiting) : m.splitsWaiting(splits)}
        </h2>
        <p className="mt-[0.15rem] text-[0.9rem] text-ink-soft">
          {waiting > 0 ? m.waitingHelp : m.splitsHelp}
          {waiting > 0 && splits > 0 && ` ${m.splitsToo(splits)}`}
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => usePeople.getState().setView("matches")}
        icon={<ArrowRight className="size-4" aria-hidden />}
      >
        {m.reviewMatches}
      </Button>
    </section>
  )
}

/** The matches screen: an agent's splits, then the matches, a page of cards; a decided card keeps its place until the next read. */
export function Matches() {
  const m = useMessages(peopleMessages)
  const matches = usePeople((s) => s.matches)
  const splits = usePeople((s) => s.splits)
  const decided = usePeople((s) => s.decided)
  const more = usePeople((s) => s.matchesMore)
  const page = usePeople((s) => s.matchPage)
  const { setView, setMatchPage, want } = usePeople.getState()
  const head = useId()
  const groups = groupMatches(matches, decided)
  const cards = [
    ...splits.map((split) => ({ key: `split:${split.id}`, split, group: null })),
    ...groups.map((group) => ({ key: group.key, split: null, group })),
  ]
  const pages = Math.max(1, Math.ceil(cards.length / PAGE))
  const at = Math.min(page, pages)
  const shown = cards.slice((at - 1) * PAGE, at * PAGE)
  const onScreen = [...new Set(shown.flatMap((c) => (c.group ? c.group.people : [c.split.person])))].join(" ")
  // biome-ignore lint/correctness/useExhaustiveDependencies: a read drops the details, and `matches` is new after it
  useEffect(() => want(onScreen ? onScreen.split(" ") : []), [onScreen, matches, want])

  return (
    <section aria-labelledby={head} className="flex flex-col gap-[0.9rem]">
      <Button
        size="sm"
        variant="ghost"
        className="-ml-3 self-start"
        onClick={() => setView("people")}
        icon={<ArrowLeft className="size-4" aria-hidden />}
      >
        {m.backToPeople}
      </Button>
      <div>
        <h2 id={head} className="text-[1.25rem] font-semibold">
          {m.matchesTitle}
        </h2>
        <p className="mt-1 max-w-[72ch] text-[0.95rem] text-ink-soft">{m.matchesIntro}</p>
      </div>
      {cards.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.noMatches}</p>
      ) : (
        <div className="flex flex-col gap-[0.8rem]">
          {shown.map((c) =>
            c.group ? <MatchCard key={c.key} group={c.group} /> : <SplitCard key={c.key} split={c.split} />,
          )}
        </div>
      )}
      {pages > 1 && <Pager page={at} onPage={setMatchPage} total={cards.length} totalMore={more} size={PAGE} />}
      {more && <p className="text-[0.9rem] text-ink-dim">{m.matchesMore}</p>}
    </section>
  )
}
