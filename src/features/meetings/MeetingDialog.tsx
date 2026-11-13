import { useState } from "react"
import { openDocument } from "@/features/documents"
import { openTarget } from "@/features/links"
import { openPerson } from "@/features/people"
import { useLang, useMessages } from "@/i18n"
import type { MeetingDetails, MeetingRow } from "@/platform/bindings"
import { errorText } from "@/shared/errors"
import { useMeetingOpen } from "@/shared/meeting-open"
import { OpenLink } from "@/shared/OpenLink"
import { SourceIcon, sourceOf } from "@/shared/SourceIcon"
import { Button } from "@/ui/Button"
import { CopyRef } from "@/ui/CopyRef"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { LinkButton } from "@/ui/LinkButton"
import { Skeleton } from "@/ui/Skeleton"
import { LineTab, TabList, TabPanel, Tabs } from "@/ui/Tabs"
import { useMeeting } from "./api"
import { meetingMessages } from "./messages"
import { TranscriptView } from "./TranscriptView"

const close = () => useMeetingOpen.setState({ ref: null })

/** One meeting: when and where, its join links, findings waiting, summary, people, documents and transcript. */
export function MeetingDialog() {
  const ref = useMeetingOpen((s) => s.ref)
  const title = useMeetingOpen((s) => s.title)
  const read = useMeeting(ref)
  const first = read.data?.pages[0]
  const m = useMessages(meetingMessages)
  return (
    <Dialog
      open={ref !== null}
      title={first?.meeting.title ?? (title || m.columns.title)}
      titleAside={<CopyRef value={ref} />}
      onClose={close}
      wide="xl"
      scroll
      tall
    >
      {ref && <Details key={ref} read={read} />}
    </Dialog>
  )
}

type Read = ReturnType<typeof useMeeting>

function Details({ read }: { read: Read }) {
  const m = useMessages(meetingMessages)
  const box = "pb-[1.2rem]"
  if (read.error && !read.data)
    return (
      <div className={box}>
        <ErrorNotice
          raw={errorText(read.error)}
          action={
            <Button size="sm" busy={read.isFetching} onClick={() => void read.refetch()}>
              {m.tryAgain}
            </Button>
          }
        >
          {m.detailsFailed}
        </ErrorNotice>
      </div>
    )
  const pages = read.data?.pages
  const first = pages?.[0]
  if (!pages || !first)
    return (
      <div className={`${box} flex flex-col gap-[0.8rem]`}>
        <Skeleton className="h-[1.2rem] w-[55%]" label={m.reading} />
        <Skeleton className="h-[12rem] w-full rounded-control" />
      </div>
    )
  const lines = pages.flatMap((p) => p.transcript?.lines ?? [])
  return (
    <div className={`${box} reveal flex flex-col gap-[1rem]`}>
      <Head details={first} />
      <Body details={first}>
        {first.transcript && (
          <TranscriptView
            lines={lines}
            total={first.transcript.total}
            more={read.hasNextPage}
            loadingMore={read.isFetchingNextPage}
            onMore={() => void read.fetchNextPage()}
          />
        )}
      </Body>
    </div>
  )
}

/** The date and time in the computer's zone, the meeting's own zone when it differs, and where it came from. */
function Head({ details }: { details: MeetingDetails }) {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const meeting = details.meeting
  const start = meeting.startedAt ? new Date(meeting.startedAt) : null
  const end = meeting.endedAt ? new Date(meeting.endedAt) : null
  const time = (d: Date, zone?: string) =>
    d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit", ...(zone ? { timeZone: zone } : {}) })
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zone = meeting.timezone && meeting.timezone !== here ? meeting.timezone : null
  const minutes = start && end ? Math.round((end.getTime() - start.getTime()) / 60_000) : null
  let when = ""
  if (start) {
    const day = start.toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "long", year: "numeric" })
    when = meeting.allDay ? `${day}, ${m.allDay}` : `${day}, ${time(start)}${end ? ` – ${time(end)}` : ""}`
    if (minutes !== null && !meeting.allDay) when += ` (${m.duration(minutes)})`
    if (zone && end && !meeting.allDay) {
      try {
        when += `, ${time(start, zone)} – ${time(end, zone)} ${zone.split("/").pop()?.replaceAll("_", " ")}`
      } catch {
        // A zone the computer does not know is left out rather than guessed.
      }
    }
  }
  const services = [...new Map(meeting.sources.map((s) => [s.provider, s])).values()]
  return (
    <div className="flex flex-col gap-[0.6rem]">
      <p className="flex flex-wrap items-center gap-x-[0.9rem] gap-y-1 text-[0.95rem] text-ink-soft">
        {when && <span className="font-mono text-[0.9rem] tabular-nums">{when}</span>}
        {services.map((s) => (
          <span key={s.provider} className="inline-flex items-center gap-[0.35rem]">
            <SourceIcon provider={s.provider} />
            {sourceOf(s.provider).name}
          </span>
        ))}
      </p>
      {meeting.links.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {meeting.links.map((l) => (
            <OpenLink key={l.url} url={l.url}>
              {m.openIn(sourceOf(l.source).name)}
            </OpenLink>
          ))}
        </div>
      )}
    </div>
  )
}

function Body({ details, children }: { details: MeetingDetails; children: React.ReactNode }) {
  const m = useMessages(meetingMessages)
  const [tab, setTab] = useState("overview")
  const transcript = details.transcript
  const overview = (
    <div className="grid gap-[1.4rem] lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="flex min-w-0 flex-col gap-[1.1rem]">
        <Findings details={details} />
        <Summary details={details} />
      </div>
      <Aside meeting={details.meeting} />
    </div>
  )
  if (!transcript) return overview
  return (
    <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
      <TabList aria-label={m.transcript} className="flex gap-5 border-line border-b">
        <LineTab id="overview">{m.overview}</LineTab>
        <LineTab
          id="transcript"
          extra={<span className="ml-1.5 font-mono text-[0.85rem] text-ink-dim">{transcript.total}</span>}
        >
          {m.transcript}
        </LineTab>
      </TabList>
      <TabPanel id="overview" className="pt-[1rem]">
        {overview}
      </TabPanel>
      <TabPanel id="transcript" className="pt-[1rem]">
        {children}
      </TabPanel>
    </Tabs>
  )
}

/** Findings that wait for the owner are decided on Memory, where findings already are (NEED-33 A). */
function Findings({ details }: { details: MeetingDetails }) {
  const m = useMessages(meetingMessages)
  const waiting = details.findings.filter((f) => f.pending > 0)
  const pending = waiting.reduce((n, f) => n + f.pending, 0)
  if (pending === 0) return null
  return (
    <p className="flex flex-wrap items-center gap-[0.6rem]">
      <Lamp tone="warn" size="sm" />
      <span>{m.findingsWait(pending)}</span>
      {waiting.map((f) => (
        <LinkButton
          key={f.id}
          onClick={() => {
            close()
            void openTarget({ type: "proposal", id: f.id })
          }}
        >
          {m.confirmOnMemory}
        </LinkButton>
      ))}
    </p>
  )
}

function Summary({ details }: { details: MeetingDetails }) {
  const m = useMessages(meetingMessages)
  const prose = "selectable max-w-[70ch] text-body whitespace-pre-wrap"
  return (
    <section className="flex flex-col gap-[0.6rem]">
      <h3 className="font-medium">{m.summary}</h3>
      {details.summaries.length === 0 ? (
        <p className="text-ink-soft">{m.noSummary}</p>
      ) : (
        details.summaries.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: memo lists a meeting's summaries once, in one order
          <div key={i} className="flex flex-col gap-[0.5rem]">
            {s.overview && <p className={prose}>{s.overview}</p>}
            {s.sections.map((x) => (
              <div key={x.label}>
                <p className="font-medium text-[0.95rem]">{x.label}</p>
                <p className={prose}>{x.text}</p>
              </div>
            ))}
            {s.nextSteps.length > 0 && (
              <div>
                <p className="font-medium text-[0.95rem]">{m.nextSteps}</p>
                <ul className="list-disc pl-[1.2rem] text-body">
                  {s.nextSteps.map((n) => (
                    <li key={n} className="selectable">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))
      )}
      {details.description && (
        <>
          <h3 className="font-medium">{m.description}</h3>
          <p className={`${prose} text-ink-soft`}>{details.description}</p>
        </>
      )}
    </section>
  )
}

function Aside({ meeting }: { meeting: MeetingRow }) {
  const m = useMessages(meetingMessages)
  return (
    <aside className="flex min-w-0 flex-col gap-[1.2rem]">
      <section className="flex flex-col gap-[0.4rem]">
        <h3 className="font-medium">
          {m.participants} <span className="font-mono text-[0.85rem] text-ink-dim">{meeting.participantsCount}</span>
        </h3>
        {meeting.participants.length === 0 ? (
          <p className="text-[0.95rem] text-ink-soft">{m.nobody}</p>
        ) : (
          <ul className="flex flex-col gap-[0.35rem] text-[0.95rem]">
            {meeting.participants.map((p, i) => {
              const name = p.person?.name ?? p.name
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: a participant may have neither a ref nor an address
                <li key={i} className="flex min-w-0 flex-wrap items-baseline gap-x-[0.4rem]">
                  {p.person ? (
                    <LinkButton
                      aria-label={m.openPerson(name ?? p.person.ref)}
                      onClick={() => {
                        close()
                        openPerson(p.person?.ref ?? "")
                      }}
                    >
                      {name ?? p.person.ref}
                    </LinkButton>
                  ) : name ? (
                    <span className="selectable">{name}</span>
                  ) : (
                    <span className="selectable font-mono text-[0.88rem]">{p.email}</span>
                  )}
                  {p.organizer && <span className="text-[0.85rem] text-ink-dim">{m.organizer}</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {meeting.documents.length > 0 && (
        <section className="flex flex-col gap-[0.4rem]">
          <h3 className="font-medium">{m.documents}</h3>
          <ul className="flex flex-col gap-[0.35rem] text-[0.95rem]">
            {meeting.documents.map((d) => (
              <li key={d.ref}>
                <LinkButton
                  aria-label={m.openDocument(d.title ?? d.ref)}
                  onClick={() => {
                    close()
                    openDocument(d.ref, d.title ?? "")
                  }}
                >
                  {d.title ?? d.ref}
                </LinkButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
