import { ExternalLink, LoaderCircle, RefreshCw, Search } from "lucide-react"
import { useEffect, useId } from "react"
import { matchesFilter } from "@/domain/people"
import { ToolNeeded } from "@/features/tools"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { MatchCard } from "./MatchCard"
import { peopleMessages } from "./messages"
import { PersonRow } from "./PersonRow"
import { SplitDialog } from "./SplitDialog"
import { usePeople } from "./store"
import { UndoMergeDialog } from "./UndoMergeDialog"

const guide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/memo/people`
/** A store can know thousands of people; the rest are a search away, and the page stays quick. */
const SHOWN = 200

export function PeoplePage() {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const s = usePeople()
  const { load } = s
  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex flex-col gap-[1.5rem] px-[2.1rem] pt-[1.6rem] pb-[2.2rem]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-extrabold leading-none tracking-[-0.035em]">{m.title}</h1>
          <p className="mt-3 max-w-[72ch] text-[0.95rem] text-ink-soft">
            {m.intro}{" "}
            <a
              href={guide(lang)}
              onClick={(e) => {
                e.preventDefault()
                platform.openUrl(guide(lang))
              }}
              className="inline-flex items-baseline gap-[0.2rem] font-medium text-brand hover:text-brand-hover"
            >
              {m.guide}
              <ExternalLink className="size-[0.8rem] self-center" aria-hidden />
            </a>
          </p>
        </div>
        {s.read !== "missing" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={s.reading}
            onClick={() => void load()}
            icon={
              s.reading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="size-4" aria-hidden />
              )
            }
          >
            {s.reading && s.read ? m.reading : m.readAgain}
          </Button>
        )}
      </div>

      {s.error ? (
        <ErrorNotice action={<ReportThis what="Reading people" error={s.error} />}>
          {m.readFailed} {s.error}
        </ErrorNotice>
      ) : s.read === "missing" ? (
        <ToolNeeded id="memo" update={false} label={m.goTools}>
          {m.missing}
        </ToolNeeded>
      ) : s.read === "old" ? (
        <ToolNeeded id="memo" update label={m.update}>
          {m.old(s.oldVersion?.version ?? null, s.oldVersion?.need ?? "")}
        </ToolNeeded>
      ) : s.read === null ? (
        <ListSkeleton />
      ) : (
        <>
          <Waiting />
          <Everyone />
        </>
      )}
      <SplitDialog />
      <UndoMergeDialog />
    </div>
  )
}

function Waiting() {
  const m = useMessages(peopleMessages)
  const matches = usePeople((s) => s.matches)
  const head = useId()
  if (matches.length === 0) return null
  return (
    <section aria-labelledby={head} className="flex flex-col gap-[0.7rem]">
      <div>
        <h2 id={head} className="flex items-center gap-2 text-[1.1rem] font-semibold">
          <Lamp tone="warn" size="sm" />
          {m.waiting(matches.length)}
        </h2>
        <p className="mt-1 text-[0.95rem] text-ink-soft">{m.waitingHelp}</p>
      </div>
      <div className="grid gap-[0.8rem] lg:grid-cols-2">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} from={match.persons[0] ?? ""} />
        ))}
      </div>
    </section>
  )
}

function Everyone() {
  const m = useMessages(peopleMessages)
  const people = usePeople((s) => s.people)
  const query = usePeople((s) => s.query)
  const search = useId()
  const found = people.filter((p) => matchesFilter(p, query))
  const shown = found.slice(0, SHOWN)
  if (people.length === 0)
    return (
      <div className="rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.4rem] text-[0.95rem] text-ink-soft">
        <p className="font-medium text-ink">{m.emptyTitle}</p>
        <p className="mt-1">{m.emptyBody}</p>
      </div>
    )
  return (
    <section aria-label={m.rows} className="flex flex-col gap-[0.8rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={search} className="relative block w-full max-w-[28rem]">
          <span className="sr-only">{m.search}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-dim"
            aria-hidden
          />
          <input
            id={search}
            type="search"
            placeholder={m.search}
            value={query}
            onChange={(e) => usePeople.getState().setQuery(e.target.value)}
            className="selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app pr-3 pl-9 text-[1rem]"
          />
        </label>
        <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{m.everyone(found.length)}</span>
      </div>
      {found.length === 0 ? (
        <p className="text-[0.95rem] text-ink-soft">{m.noMatch}</p>
      ) : (
        <div className="rounded-[0.2rem] border border-line-strong bg-app">
          {shown.map((p) => (
            <PersonRow key={p.ref} person={p} />
          ))}
        </div>
      )}
      {found.length > SHOWN && <p className="text-[0.9rem] text-ink-dim">{m.shownOf(SHOWN, found.length)}</p>}
    </section>
  )
}

function ListSkeleton() {
  return (
    <div className="rounded-[0.2rem] border border-line-strong bg-app">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-[3.6rem] items-center gap-[0.8rem] border-line px-[1.3rem] not-first:border-t">
          <Skeleton className="size-[1.2rem] rounded-full" />
          <Skeleton className="h-[1rem] w-[40%]" />
        </div>
      ))}
    </div>
  )
}
