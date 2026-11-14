import { Fragment, useMemo, useState } from "react"
import { instantOf } from "@/domain/meeting-layout"
import { openDocument } from "@/features/documents"
import { openTarget } from "@/features/links"
import { openPerson } from "@/features/people"
import { useLang, useMessages } from "@/i18n"
import type { MeetingDetails } from "@/platform/bindings"
import { ExtLink } from "@/shared/ExtLink"
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
import { Pill } from "@/ui/Pill"
import { SectionTitle } from "@/ui/SectionTitle"
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
      tall={!!first?.transcript}
    >
      {ref && <Details key={ref} read={read} />}
    </Dialog>
  )
}

type Read = ReturnType<typeof useMeeting>

function Details({ read }: { read: Read }) {
  const m = useMessages(meetingMessages)
  const pages = read.data?.pages
  const lines = useMemo(() => pages?.flatMap((p) => p.transcript?.lines ?? []) ?? [], [pages])
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
  const first = pages?.[0]
  if (!pages || !first)
    return (
      <div className={`${box} flex flex-col gap-[0.8rem]`}>
        <Skeleton className="h-[1.2rem] w-[55%]" label={m.reading} />
        <Skeleton className="h-[12rem] w-full rounded-control" />
      </div>
    )
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

/** Join links by their service, from the address: memo names a link by the account that gave it, not the app. */
const JOIN_SERVICES: [RegExp, string][] = [
  [/(^|\.)meet\.google\.com$/, "Google Meet"],
  [/(^|\.)zoom\.(us|com)$/, "Zoom"],
  [/(^|\.)teams\.(microsoft|live)\.com$/, "Microsoft Teams"],
  [/(^|\.)telemost\.yandex\.(ru|com)$/, "Telemost"],
]
const serviceOfUrl = (url: string) => {
  let host = url
  try {
    host = new URL(url).hostname
  } catch {
    // Rust passes https links only; an unreadable one keeps its own text.
  }
  return JOIN_SERVICES.find(([re]) => re.test(host))?.[1] ?? host.replace(/^www\./, "")
}

/** A calendar's page by its product name, which no language translates; another calendar by its tool's name. */
const PAGE_SERVICES: Record<string, string> = { "google-calendar": "Google Calendar" }

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

/** An `RRULE:` line in words; a rule with parts this does not read is shown as calendars write it. */
function repeatText(rule: string, lang: string, m: (typeof meetingMessages)["en"]) {
  const parts = new Map(
    rule
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((p) => p.split("=") as [string, string]),
  )
  const n = Number(parts.get("INTERVAL") ?? 1)
  if (!Number.isInteger(n) || n < 1) return rule
  const byDay = (parts.get("BYDAY") ?? "").split(",").filter(Boolean)
  // 1 January 2024 was a Monday.
  const day = (code: string) =>
    new Date(2024, 0, 1 + WEEKDAYS.indexOf(code)).toLocaleDateString(lang, { weekday: "short" })
  switch (parts.get("FREQ")) {
    case "DAILY":
      return m.every.day(n)
    case "WEEKLY":
      return byDay.every((d) => WEEKDAYS.includes(d)) ? m.every.week(n, byDay.map(day).join(", ")) : rule
    case "MONTHLY":
      return m.every.month(n)
    case "YEARLY":
      return m.every.year(n)
    default:
      return rule.replace(/^RRULE:/i, "")
  }
}

/** The date and time in the computer's zone, the meeting's own zone when it differs, where it came from, and its links. */
function Head({ details }: { details: MeetingDetails }) {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const meeting = details.meeting
  const start = meeting.startedAt ? instantOf(meeting.startedAt) : null
  const end = meeting.endedAt ? instantOf(meeting.endedAt) : null
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
  const pages = meeting.sources.filter((s) => s.pageUrl)
  const pageName = (s: (typeof pages)[number]) => {
    const name = PAGE_SERVICES[s.provider] ?? sourceOf(s.provider).name
    return pages.filter((o) => o.provider === s.provider).length > 1 ? `${name} · ${s.account}` : name
  }
  const status = meeting.status ? m.status[meeting.status] : undefined
  return (
    <div className="flex flex-col gap-[0.7rem]">
      <p className="flex flex-wrap items-center gap-x-[0.9rem] gap-y-1 text-[0.95rem] text-ink-soft">
        {when && <span className="font-mono text-[0.9rem] tabular-nums">{when}</span>}
        {services.map((s) => (
          <span key={s.provider} className="inline-flex items-center gap-[0.35rem]">
            <SourceIcon provider={s.provider} />
            {sourceOf(s.provider).name}
          </span>
        ))}
        {status && <Pill tone={meeting.status === "cancelled" ? "bad" : "warn"}>{status}</Pill>}
      </p>
      {meeting.links.length + pages.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {meeting.links.map((l, i) => (
            <OpenLink key={l.url} url={l.url} variant={i === 0 ? "primary" : "secondary"}>
              {m.joinOn(serviceOfUrl(l.url))}
            </OpenLink>
          ))}
          {pages.map((s) => (
            <OpenLink key={s.pageUrl} url={s.pageUrl ?? ""} variant="secondary">
              {m.openIn(pageName(s))}
            </OpenLink>
          ))}
        </div>
      )}
    </div>
  )
}

const hasMain = (d: MeetingDetails) =>
  d.findings.some((f) => f.pending > 0) || d.summaries.length > 0 || d.description !== null

function Body({ details, children }: { details: MeetingDetails; children: React.ReactNode }) {
  const m = useMessages(meetingMessages)
  const [tab, setTab] = useState("overview")
  const transcript = details.transcript
  const main = hasMain(details)
  const aside = <Aside details={details} />
  const overview = !main ? (
    aside
  ) : (
    <div className="grid gap-[1.6rem] lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-[1.2rem]">
        <Findings details={details} />
        <Summary details={details} />
      </div>
      {aside}
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
          {waiting.length > 1 ? `${m.confirmOnMemory} · #${f.id}` : m.confirmOnMemory}
        </LinkButton>
      ))}
    </p>
  )
}

function Summary({ details }: { details: MeetingDetails }) {
  const m = useMessages(meetingMessages)
  const prose = "selectable max-w-[70ch] text-body whitespace-pre-wrap"
  return (
    <>
      {details.summaries.length > 0 && (
        <section className="flex flex-col gap-[0.6rem]">
          <SectionTitle as="h3">{m.summary}</SectionTitle>
          {details.summaries.map((s, i) => (
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
              {s.url && (
                <div>
                  <OpenLink url={s.url}>{m.openNotes}</OpenLink>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
      {details.description && (
        <section className="flex flex-col gap-[0.6rem]">
          <SectionTitle as="h3">{m.description}</SectionTitle>
          <p className={`${prose} text-ink-soft`}>{details.description}</p>
        </section>
      )}
    </>
  )
}

/** Where, which calendar, the recording, who took part and the documents: each only when memo knows it. */
function Aside({ details }: { details: MeetingDetails }) {
  const m = useMessages(meetingMessages)
  const lang = useLang()
  const meeting = details.meeting
  const calendars = [...new Set(meeting.sources.flatMap((s) => (s.calendar ? [`${s.calendar} · ${s.account}`] : [])))]
  const location = details.location
  const conferences = [...new Set(meeting.sources.flatMap((s) => (s.conference ? [s.conference] : [])))]
  const answered = meeting.sources.filter((s) => s.ownResponse)
  // Each calendar keeps its own answer; with two, each is named, never one chosen for both.
  const answers = answered.map((s) => {
    const word = m.ownResponses[s.ownResponse ?? ""] ?? s.ownResponse
    return answered.length > 1 ? `${word} (${s.calendar ?? s.account})` : word
  })
  const known = new Set(meeting.documents.map((d) => d.ref))
  const files = details.attachments.filter((a) => !a.document || !known.has(a.document))
  const facts = [
    location && {
      term: m.where,
      value: location.startsWith("https://") ? (
        <ExtLink href={location}>{location}</ExtLink>
      ) : (
        <span className="selectable whitespace-pre-wrap">{location}</span>
      ),
    },
    calendars.length > 0 && { term: m.calendar, value: <span className="selectable">{calendars.join(", ")}</span> },
    meeting.recurrence && { term: m.repeats, value: repeatText(meeting.recurrence, lang, m) },
    conferences.length > 0 && { term: m.conference, value: conferences.join(", ") },
    answers.length > 0 && { term: m.yourAnswer, value: answers.join(", ") },
    meeting.hasRecording && { term: m.recording, value: m.recordingKept },
  ].filter((f) => !!f)
  const people = meeting.participants
  const empty = facts.length === 0 && people.length === 0 && meeting.documents.length === 0 && files.length === 0
  if (empty && !hasMain(details)) return <p className="text-[0.95rem] text-ink-soft">{m.onlyTime}</p>
  if (empty) return null
  return (
    <aside className="flex min-w-0 flex-col gap-[1.3rem]">
      {facts.length > 0 && (
        <section className="flex flex-col gap-[0.5rem]">
          <SectionTitle as="h3">{m.facts}</SectionTitle>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-[0.4rem] text-[0.95rem]">
            {facts.map((f) => (
              <Fragment key={f.term}>
                <dt className="text-ink-soft">{f.term}</dt>
                <dd className="min-w-0 break-words">{f.value}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      )}
      {people.length > 0 && (
        <section className="flex flex-col gap-[0.5rem]">
          <SectionTitle as="h3">
            {m.participants}{" "}
            <span className="font-mono font-normal text-[0.85rem] text-ink-dim">
              {Math.max(meeting.participantsCount, people.length)}
            </span>
          </SectionTitle>
          <ul className="flex flex-col gap-[0.35rem] text-[0.95rem]">
            {people.map((p, i) => {
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
                  {p.response && (
                    <span className={`text-[0.85rem] ${p.response === "declined" ? "text-bad" : "text-ink-dim"}`}>
                      {m.responses[p.response] ?? p.response}
                    </span>
                  )}
                  {name && p.email && !p.person && (
                    <span className="selectable min-w-0 truncate font-mono text-[0.85rem] text-ink-dim">{p.email}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {meeting.documents.length + files.length > 0 && (
        <section className="flex flex-col gap-[0.5rem]">
          <SectionTitle as="h3">{m.documents}</SectionTitle>
          <ul className="flex flex-col gap-[0.35rem] text-[0.95rem]">
            {[
              ...meeting.documents.map((d) => ({ key: d.ref, ref: d.ref, title: d.title ?? d.ref })),
              ...files.map((a) => ({ key: a.fileId, ref: a.document, title: a.title ?? a.fileId })),
            ].map((d) => (
              <li key={d.key} className="flex min-w-0 flex-wrap items-baseline gap-x-[0.4rem]">
                {d.ref ? (
                  <LinkButton
                    aria-label={m.openDocument(d.title)}
                    onClick={() => {
                      close()
                      openDocument(d.ref ?? "", d.title)
                    }}
                  >
                    {d.title}
                  </LinkButton>
                ) : (
                  <>
                    <span className="selectable">{d.title}</span>
                    <span className="text-[0.85rem] text-ink-dim">{m.notStored}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
