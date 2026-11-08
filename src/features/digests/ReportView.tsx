import type { ReactNode } from "react"
import {
  amountText,
  dayTitle,
  emojiOf,
  HEALTH_EMOJI,
  isOverdue,
  type Moment,
  momentOf,
  orderedSections,
  SECTION_EMOJI,
  staleHealth,
  TITLE_EMOJI,
  targetOfRefs,
  taskGroups,
  windowOf,
} from "@/domain/digest"
import type { DeepLinkTarget } from "@/domain/links"
import { openTarget } from "@/features/links"
import { useLang, useMessages } from "@/i18n"
import type { Report, ReportItem } from "@/platform/digest-schemas"
import { digestMessages } from "./messages"

type M = (typeof digestMessages)["en"]

function OpenLink({ target, label, children }: { target: DeepLinkTarget; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void openTarget(target)}
      className="cursor-pointer font-medium text-brand hover:text-brand-hover"
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

function Item({ item, now }: { item: ReportItem; now: number }) {
  const m = useMessages(digestMessages)
  const lang = useLang()
  const overdue = isOverdue(item, now)
  const due = item.due ? momentOf(item.due, now, lang) : null
  const dueWords = due ? dueText(due, overdue, m) : ""
  const strong = (text: string) => <strong className="font-semibold text-ink">{text}</strong>
  const first: ReactNode = (() => {
    switch (item.type) {
      case "reply":
        return (
          <>
            {strong(`${item.who} · ${item.topic}`)} — {item.action}
          </>
        )
      case "question":
        return (
          <>
            {strong(item.who ?? "")} {m.asks} {item.action}
          </>
        )
      case "task":
        return (
          <>
            {strong(item.topic ?? "")}
            {dueWords ? <> — {overdue ? strong(dueWords) : dueWords}</> : item.who ? ` — ${item.who}` : null}
          </>
        )
      case "fact":
        return (
          <>
            {strong(item.topic ?? "")}: {item.detail}
          </>
        )
      case "risk":
        return (
          <>
            {strong(item.topic ?? "")}: {item.detail} → {item.action}
          </>
        )
      case "money":
        return (
          <>
            {strong(`${item.amount ? amountText(item.amount, lang) : ""} · ${item.who} · ${item.topic}`)}
            {item.action ? ` — ${item.action}` : null}
          </>
        )
      case "decision":
        return (
          <>
            {strong(item.topic ?? "")} — {item.count ? `${item.count} ` : ""}
            {item.action}
          </>
        )
      case "meeting":
        return (
          <>
            {strong(`${item.time ? meetingTime(momentOf(item.time, now, lang), m) : ""} · ${item.topic}`)}
            {item.who ? ` · ${item.who}` : null}
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
  return (
    <li className="flex gap-[0.6rem] py-[0.45rem]">
      <span aria-hidden className="w-[1.4rem] shrink-0 text-center">
        {emojiOf(item, overdue)}
      </span>
      <div className="min-w-0">
        <p className="text-ink-soft">{first}</p>
        {(second.length > 0 || target) && (
          <p className="mt-[0.1rem] text-[0.88rem] text-ink-dim">
            {second.join(" · ")}
            {target && (
              <>
                {second.length > 0 && " · "}
                <OpenLink target={target} label={m.openWhat(item.topic ?? item.who ?? "")}>
                  {m.open}
                </OpenLink>
              </>
            )}
          </p>
        )}
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
        <h2 className="text-[1.25rem] font-semibold text-ink">
          {TITLE_EMOJI} {m.title(dayTitle(report.date, lang))}
        </h2>
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
