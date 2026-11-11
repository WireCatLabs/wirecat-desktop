import { useEffect, useState } from "react"
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

/** The longest the page waits for the links check before it shows the rest. */
const HOLD_MS = 4000

const guide = (lang: Lang) => `https://wirecat.dev/${lang}/docs/memo/people`

export function PeoplePage() {
  const m = useMessages(peopleMessages)
  const lang = useLang()
  const s = usePeople()
  const view = usePeople((x) => x.view)
  // The matches and the links check stand above the table, and only their answers say whether they come. Nothing below
  // the header shows until they are in, so the table appears where it stays. A slow check stops holding the page.
  const read = usePeople((x) => x.read !== null)
  const checked = usePeople((x) => x.doubts?.state !== "loading" || x.doubts.last !== null)
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!read || checked) return
    const t = setTimeout(() => setLate(true), HOLD_MS)
    return () => clearTimeout(t)
  }, [read, checked])
  const settled = read && (checked || late)
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
        <ErrorNotice raw={s.error} action={<ReportThis what="Reading people" error={s.error} />}>
          {m.readFailed}
        </ErrorNotice>
      ) : gap ? (
        <ToolNeeded gap={gap} />
      ) : (
        <Crossfade swap={settled ? view : "waiting"}>
          {!settled ? (
            <Skeleton className="h-[1.3rem] w-[min(24rem,60%)]" label={m.reading} />
          ) : view === "matches" ? (
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
