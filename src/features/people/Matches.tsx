import { ArrowLeft, ArrowRight } from "lucide-react"
import { useEffect, useId } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Lamp } from "@/ui/Lamp"
import { Pager } from "@/ui/Pager"
import { MatchCard } from "./MatchCard"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/** Each card reads both of its people, so a page stays short. */
const PAGE = 10

/** On the people list: how many matches wait, and the way to them. */
export function MatchesWaiting() {
  const m = useMessages(peopleMessages)
  const waiting = usePeople((s) => s.matches.filter((x) => !s.decided[x.id]).length)
  const head = useId()
  if (waiting === 0) return null
  return (
    <section
      aria-labelledby={head}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[0.45rem] border border-warn/35 bg-warn/[0.07] px-[1.1rem] py-[0.85rem]"
    >
      <div className="min-w-0">
        <h2 id={head} className="flex items-center gap-2 font-semibold">
          <Lamp tone="warn" size="sm" />
          {m.waiting(waiting)}
        </h2>
        <p className="mt-[0.15rem] text-[0.9rem] text-ink-soft">{m.waitingHelp}</p>
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

/** The matches screen: a page of cards; a decided card keeps its place until the next read. */
export function Matches() {
  const m = useMessages(peopleMessages)
  const matches = usePeople((s) => s.matches)
  const more = usePeople((s) => s.matchesMore)
  const page = usePeople((s) => s.matchPage)
  const { setView, setMatchPage, want } = usePeople.getState()
  const head = useId()
  const pages = Math.max(1, Math.ceil(matches.length / PAGE))
  const at = Math.min(page, pages)
  const shown = matches.slice((at - 1) * PAGE, at * PAGE)
  const onScreen = [...new Set(shown.flatMap((x) => x.persons))].join(" ")
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
        <p className="mt-1 max-w-[72ch] text-[0.95rem] text-ink-soft">{m.waitingHelp}</p>
      </div>
      {matches.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.noMatches}</p>
      ) : (
        <div className="flex flex-col gap-[0.8rem]">
          {shown.map((match) => (
            <MatchCard key={match.id} match={match} from={match.persons[0] ?? ""} />
          ))}
        </div>
      )}
      {pages > 1 && <Pager page={at} hasMore={at < pages} onPage={setMatchPage} />}
      {more && <p className="text-[0.9rem] text-ink-dim">{m.matchesMore}</p>}
    </section>
  )
}
