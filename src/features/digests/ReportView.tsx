import { type ReactNode, useId, useState } from "react"
import {
  amountText,
  dayTitle,
  emojiOf,
  entityOf,
  HEALTH_EMOJI,
  isOverdue,
  type Moment,
  momentOf,
  orderedSections,
  SECTION_EMOJI,
  staleHealth,
  TITLE_EMOJI,
  targetOfRefs,
  targetsOfRefs,
  taskGroups,
  windowOf,
} from "@/domain/digest"
import { type DeepLinkTarget, formatLink } from "@/domain/links"
import { openTarget } from "@/features/links"
import { useLang, useMessages } from "@/i18n"
import type { Report, ReportItem } from "@/platform/digest-schemas"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ExpandChevron } from "@/ui/ExpandChevron"
import { SectionTitle } from "@/ui/SectionTitle"
import { digestMessages } from "./messages"

type M = (typeof digestMessages)["en"]

function OpenLink({
  target,
  label,
  children,
  className,
}: {
  target: DeepLinkTarget
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void openTarget(target)}
      className={cx("cursor-pointer font-medium text-brand hover:text-brand-hover", className)}
    >
      {children}
    </button>
  )
}

function dueText(due: Moment, overdue: boolean, m: M): string {
  if (overdue) return m.overdueBy(due.span)
  const at = due.time ? `, ${due.time}` : ""
  if (due.day === "today") return `${m.dueToday}${at}`
  if (due.day === "tomorrow") return `${m.dueTomorrow}${at}`
  return `${m.dueOn(due.date)}${at}`
}

function meetingTime(time: Moment, m: M): string {
  if (time.day === "today") return time.time ?? time.date
  if (time.day === "yesterday") return m.yesterday
  if (time.day === "tomorrow") return time.time ? `${m.tomorrow}, ${time.time}` : m.tomorrow
  return time.time ? `${time.date}, ${time.time}` : time.date
}

function Entity({ target, label, children }: { target: DeepLinkTarget | null; label: string; children: ReactNode }) {
  if (!target) return <>{children}</>
  return (
    <OpenLink target={target} label={label} className="underline decoration-brand/40 underline-offset-2">
      {children}
    </OpenLink>
  )
}

function refLabel(target: DeepLinkTarget, item: ReportItem, m: M): string {
  switch (target.type) {
    case "message":
      return m.refs.message
    case "chat":
      return m.refs.chat
    case "task":
      return m.refs.task(target.id)
    case "proposal":
      return m.refs.proposal
    case "person":
      return entityOf(item.refs, "person") && item.who ? item.who : m.refs.person
    case "project":
      return m.refs.project(target.key)
    default:
      return m.refs.other
  }
}

function Details({ item, now, m }: { item: ReportItem; now: number; m: M }) {
  const lang = useLang()
  const at = item.time ?? item.since
  const moment = at ? momentOf(at, now, lang) : null
  const where = [
    item.channel ? m.channels[item.channel] : null,
    moment ? [moment.date, moment.time].filter(Boolean).join(", ") : null,
  ]
    .filter((p): p is string => p !== null)
    .join(" · ")
  const targets = targetsOfRefs(item.refs)
  return (
    <dl className="mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-pill bg-app-2 px-3 py-2 text-[0.88rem]">
      {item.quote && (
        <>
          <dt className="text-ink-dim">{m.quote}</dt>
          <dd className="text-ink-soft italic">«{item.quote}»</dd>
        </>
      )}
      {where && (
        <>
          <dt className="text-ink-dim">{m.from}</dt>
          <dd className="text-ink-soft">{where}</dd>
        </>
      )}
      {targets.length > 0 && (
        <>
          <dt className="text-ink-dim">{m.linked}</dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-0.5">
            {targets.map((t) => {
              const label = refLabel(t, item, m)
              return (
                <OpenLink key={formatLink(t)} target={t} label={`${m.open}: ${label}`}>
                  {label}
                </OpenLink>
              )
            })}
          </dd>
        </>
      )}
    </dl>
  )
}

function Item({ item, now }: { item: ReportItem; now: number }) {
  const m = useMessages(digestMessages)
  const lang = useLang()
  const detailsId = useId()
  const [open, setOpen] = useState(false)
  const overdue = isOverdue(item, now)
  const due = item.due ? momentOf(item.due, now, lang) : null
  const dueWords = due ? dueText(due, overdue, m) : ""
  const strong = (text: ReactNode) => <strong className="font-semibold text-ink">{text}</strong>
  const person = entityOf(item.refs, "person")
  const project = entityOf(item.refs, "project")
  const who = (
    <Entity target={person} label={`${m.open}: ${item.who ?? ""}`}>
      {item.who}
    </Entity>
  )
  const topic = (
    <Entity target={project} label={`${m.open}: ${project ? refLabel(project, item, m) : ""}`}>
      {item.topic}
    </Entity>
  )
  const first: ReactNode = (() => {
    switch (item.type) {
      case "reply":
        return (
          <>
            {strong(
              <>
                {who} · {topic}
              </>,
            )}{" "}
            — {item.action}
          </>
        )
      case "question":
        return (
          <>
            {strong(who)} {m.asks} {item.action}
          </>
        )
      case "task":
        return (
          <>
            {strong(topic)}
            {dueWords ? <> — {overdue ? strong(dueWords) : dueWords}</> : item.who ? <> — {who}</> : null}
          </>
        )
      case "fact":
        return (
          <>
            {strong(topic)}: {item.detail}
          </>
        )
      case "risk":
        return (
          <>
            {strong(topic)}: {item.detail} → {item.action}
          </>
        )
      case "money":
        return (
          <>
            {strong(
              <>
                {item.amount ? amountText(item.amount, lang) : ""} · {who} · {topic}
              </>,
            )}
            {item.action ? ` — ${item.action}` : null}
          </>
        )
      case "decision":
        return (
          <>
            {strong(topic)} — {item.count ? `${item.count} ` : ""}
            {item.action}
          </>
        )
      case "meeting":
        return (
          <>
            {strong(
              <>
                {item.time ? meetingTime(momentOf(item.time, now, lang), m) : ""} · {topic}
              </>,
            )}
            {item.who ? <> · {who}</> : null}
          </>
        )
    }
  })()
  const has = (types: string) => types.split(",").includes(item.type)
  const second = [
    item.since && has("reply,question") ? m.waiting(momentOf(item.since, now, lang).span) : null,
    dueWords && has("risk,money,decision") ? dueWords : null,
    item.action && has("task,meeting") ? item.action : null,
    item.detail && has("task,money,meeting,decision") ? item.detail : null,
    item.who && has("fact,risk,decision") ? item.who : null,
    item.who && item.type === "task" && dueWords ? item.who : null,
    item.channel ? m.channels[item.channel] : null,
    item.quote ? `«${item.quote}»` : null,
  ].filter((part): part is string => part !== null)
  const target = targetOfRefs(item.refs)
  const what = item.topic ?? item.who ?? ""
  // A click on the item's text opens its details; a click on a link inside it only follows the link.
  const toggleFromText = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a") || window.getSelection()?.toString()) return
    setOpen((o) => !o)
  }
  return (
    <li className="flex gap-[0.6rem] py-[0.45rem]">
      <span aria-hidden className="w-[1.4rem] shrink-0 text-center">
        {emojiOf(item, overdue)}
      </span>
      <div className="min-w-0 flex-1">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the Details button below is the keyboard's way in */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: as above */}
        <div className="cursor-pointer" onClick={toggleFromText}>
          <p className="text-ink-soft">{first}</p>
          <p className="mt-[0.1rem] text-[0.88rem] text-ink-dim">
            {second.join(" · ")}
            {target && (
              <>
                {second.length > 0 && " · "}
                <OpenLink target={target} label={m.openWhat(what)}>
                  {m.open}
                </OpenLink>
              </>
            )}
            {(second.length > 0 || target) && " · "}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={detailsId}
              aria-label={m.detailsOf(what)}
              onClick={() => setOpen((o) => !o)}
              className="inline-flex cursor-pointer items-center gap-0.5 text-ink-dim hover:text-ink"
            >
              {m.details}
              <ExpandChevron open={open} className="size-3.5" />
            </button>
          </p>
        </div>
        <Collapse open={open}>
          <div id={detailsId}>{open && <Details item={item} now={now} m={m} />}</div>
        </Collapse>
      </div>
    </li>
  )
}

/** One day's `wirecat.report/1` document, laid out as cli-core's text renderer lays it out, its links opening here. */
export function ReportView({ report, now }: { report: Report; now: number }) {
  const m = useMessages(digestMessages)
  const lang = useLang()
  const sections = orderedSections(report.sections)
  const groups = taskGroups(report.tasks)
  const holder =
    sections.find((s) => s.items.some((i) => i.type === "task")) ??
    sections.find((s) => s.kind === "today") ??
    sections.at(-1)
  const health = staleHealth(report.health)
  const scope = report.scope
  return (
    <article className="flex flex-col gap-[1.2rem] text-[0.95rem]">
      <header>
        <SectionTitle>
          {TITLE_EMOJI} {m.title(dayTitle(report.date, lang))}
        </SectionTitle>
        {report.summary && <p className="mt-1 text-ink-soft">{report.summary}</p>}
      </header>
      {sections.length === 0 && <p className="text-ink-soft">{health.length > 0 ? m.quietStale : m.quiet}</p>}
      {sections.map((section) => (
        <section key={section.kind} aria-label={m.sections[section.kind]}>
          <h3 className="font-semibold text-ink">
            <span aria-hidden>{SECTION_EMOJI[section.kind]}</span> {m.sections[section.kind]}
          </h3>
          <ul className="mt-1">
            {section.items.map((item, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a digest is read once; its items have no ids and never move
              <Item key={i} item={item} now={now} />
            ))}
          </ul>
          {section.more > 0 && <p className="text-[0.88rem] text-ink-dim">{m.more(section.more)}</p>}
          {section === holder && groups.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-x-[0.9rem] gap-y-1 text-[0.9rem]">
              {groups.map((g) =>
                g.target ? (
                  <OpenLink key={g.filter} target={g.target} label={`${m.groups[g.filter]} (${g.count})`}>
                    {m.groups[g.filter]} ({g.count})
                  </OpenLink>
                ) : (
                  <span key={g.filter} className="text-ink-dim">
                    {m.groups[g.filter]} ({g.count})
                  </span>
                ),
              )}
            </p>
          )}
        </section>
      ))}
      {health.length > 0 && (
        <section aria-label={m.health}>
          <ul>
            {health.map((h, i) => {
              const since = h.since ? momentOf(h.since, now, lang).date : null
              const span = new Intl.NumberFormat(lang, { style: "unit", unit: "day", unitDisplay: "long" }).format(
                Math.floor(h.stale_hours / 24),
              )
              const why =
                h.reason === "sync-failed"
                  ? m.syncFailed(since)
                  : h.reason === "no-schedule"
                    ? m.noSchedule
                    : h.reason === "quiet"
                      ? since
                        ? m.quietSince(since)
                        : m.quietFor(span)
                      : m.stale(span)
              const target = targetOfRefs(h.refs)
              const name = h.account ? `${h.source} (${h.account})` : h.source
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: as above, a digest's lines never move
                <li key={i} className="py-[0.2rem] text-ink-soft">
                  <span aria-hidden>{HEALTH_EMOJI}</span> {name}: {why}
                  {target && (
                    <>
                      {" · "}
                      <OpenLink target={target} label={`${m.fix}: ${name}`}>
                        {m.fix}
                      </OpenLink>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {scope && (
        <p className="border-line border-t pt-[0.8rem] text-[0.88rem] text-ink-dim">
          {m.viewed(windowOf(scope.from, scope.to, lang))}
          {scope.sources.length > 0 &&
            `: ${scope.sources
              .map((s) =>
                s.accounts > 1 ? `${m.channels[s.kind]} (${m.sourceAccounts(s.kind, s.accounts)})` : m.channels[s.kind],
              )
              .join(", ")}`}
          {(["chats", "mail", "tasks", "meetings"] as const).some((k) => scope.counts[k] > 0) &&
            ` · ${(["chats", "mail", "tasks", "meetings"] as const)
              .filter((k) => scope.counts[k] > 0)
              .map((k) => m.counts(k, scope.counts[k]))
              .join(", ")}`}
        </p>
      )}
    </article>
  )
}
