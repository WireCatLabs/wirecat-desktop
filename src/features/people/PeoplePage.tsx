import { useEffect } from "react"
import { gapFromRead } from "@/domain/needs"
import { ToolNeeded } from "@/features/tools"
import { type Lang, useLang, useMessages } from "@/i18n"
import { Page, PageHeader } from "@/shared/Page"
import { ReportThis } from "@/shared/ReportThis"
import { Crossfade } from "@/ui/Crossfade"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { RefreshButton } from "@/ui/RefreshButton"
import { Skeleton } from "@/ui/Skeleton"
import { LinkDoubts } from "./LinkDoubts"
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
  const { load, visit } = s
  useEffect(() => {
    visit()
  }, [visit])

  return (
    <Page>
      <PageHeader
        title={m.title}
        section="people"
        intro={m.intro}
        guide={{ label: m.guide, href: guide(lang) }}
        actions={
          s.read !== "missing" && (
            <RefreshButton busy={s.reading} onClick={() => void load()} label={m.readAgain} busyLabel={m.reading} />
          )
        }
      />

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
              <LinkDoubts />
              <PeopleTable />
            </div>
          )}
        </Crossfade>
      )}
      <PersonDialog />
      <MatchDialog />
      <SplitDialog />
      <UndoMergeDialog />
    </Page>
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
