import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { gapFromRead } from "@/domain/needs"
import { ToolNeeded } from "@/features/tools"
import { type Lang, useLang, useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { ReportThis } from "@/shared/ReportThis"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { MatchDialog } from "./MatchDialog"
import { Matches, MatchesWaiting } from "./Matches"
import { peopleMessages } from "./messages"
import { PeopleTable } from "./PeopleTable"
import { PersonDialog } from "./PersonDialog"
import { SplitDialog } from "./SplitDialog"
import { usePeople } from "./store"
import { UndoMergeDialog } from "./UndoMergeDialog"

const guide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/memo/people`

export function PeoplePage() {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const s = usePeople()
  const view = usePeople((x) => x.view)
  const gap = gapFromRead(s.read === "missing" || s.read === "old" ? { kind: s.read, ...s.oldVersion } : null)
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
      ) : gap ? (
        <ToolNeeded gap={gap} />
      ) : s.read === null ? (
        <ListSkeleton />
      ) : (
        <Crossfade swap={view}>
          {view === "matches" ? (
            <Matches />
          ) : (
            <div className="flex flex-col gap-[1.2rem]">
              <MatchesWaiting />
              <PeopleTable />
            </div>
          )}
        </Crossfade>
      )}
      <PersonDialog />
      <MatchDialog />
      <SplitDialog />
      <UndoMergeDialog />
    </div>
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
