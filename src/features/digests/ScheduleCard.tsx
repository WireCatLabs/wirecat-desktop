import { useQuery } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { findTool, tools } from "@/domain/catalog"
import { dailyCap, formatUsd, runOutcome } from "@/domain/mail-agent"
import { ago, openToolAt, ToolNeeded } from "@/features/tools"
import { useLang, useMessages } from "@/i18n"
import type { DigestItem, DigestSpec, OtherSchedule, Route, RouteChoices } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Checkbox, Radio } from "@/ui/Checkbox"
import { Combobox } from "@/ui/Combobox"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { ToggleChip } from "@/ui/FilterBar"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { area, card } from "./editor-state"
import { bookMessages, SOURCES, type Source, WEEKDAYS } from "./messages-book"
import { type ScheduleText, scheduleMessages } from "./messages-schedule"
import { MORNING, specOf, useDigestBook } from "./schedule-store"

type RouteKind = Route["kind"]
const PREFIX: Record<RouteKind, string> = { telegramBot: "telegram-bot", email: "email" }
const input =
  "h-8 rounded-[0.3rem] border border-line-strong bg-app px-2 text-[0.9rem] text-ink focus-visible:outline-2 focus-visible:outline-brand aria-[invalid=true]:border-bad"
const MAX_TIMES = 6

export const routeLabel = (r: { kind: RouteKind; profile: string; to: string }, m: ScheduleText) =>
  `${m.routeKinds[r.kind]} (${r.profile} → ${r.to})`

/** `telegram-bot:personal/user:1001` read back for display; the form only ever builds this shape. */
export const parsedRoute = (route: string): { kind: RouteKind; profile: string; to: string } | null => {
  const m = /^(telegram-bot|email):([^/]+)\/(.+)$/.exec(route)
  if (!m) return null
  return { kind: m[1] === "email" ? "email" : "telegramBot", profile: m[2] ?? "", to: m[3] ?? "" }
}

export const TONE: Record<ReturnType<typeof runOutcome>, LampTone> = { ok: "ok", skipped: "warn", failed: "bad" }

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

export type Problem = "title" | "time" | "day"

/** After a click found a problem: moves the focus to the field that holds it, once the error is painted. */
export const focusProblem = (form: HTMLElement | null) =>
  requestAnimationFrame(() => form?.querySelector<HTMLElement>("[aria-invalid='true'], [data-problem]")?.focus())

/** Why a draft cannot be saved yet, or null. */
export function problemOf(spec: DigestSpec, onDays: boolean): Problem | null {
  if (!spec.title.trim()) return "title"
  if (spec.times.length === 0 || spec.times.some((t) => !CLOCK.test(t))) return "time"
  if (onDays && spec.weekdays.length === 0) return "day"
  return null
}

/** What an older memo, with one digest kept as a schedule, can be asked. */
export type Can = { named: boolean }

/** An older memo keeps one digest at one time a day: what the update brings, and the update itself. */
export function OlderMemo() {
  const m = useMessages(bookMessages).form
  const version = useTools((s) => s.installs.memo?.[0]?.version ?? null)
  const need = findTool("memo")?.digests?.minVersion
  if (!need) return <p className="text-[0.88rem] text-ink-dim">{m.olderMemo}</p>
  return (
    <ToolNeeded inline gap={{ kind: "old", tool: "memo", version, need }}>
      <p className="text-[0.88rem] text-ink-dim">{m.olderMemo}</p>
    </ToolNeeded>
  )
}

/**
 * The settings of one digest as fields: title, times, days, sources, routes, instructions and caps. The caller holds
 * the draft and saves it; what an older memo cannot do is shown off, with the update it needs.
 */
export function DigestFields({
  spec,
  onChange,
  onDays,
  setOnDays,
  can,
  creating,
  shown = null,
}: {
  spec: DigestSpec
  onChange: (spec: DigestSpec) => void
  /** "On days" is chosen; with no day picked the draft cannot be saved. */
  onDays: boolean
  setOnDays: (on: boolean) => void
  can: Can
  /** The brief and the schedule switch; an open digest has its own card and button for them. */
  creating: boolean
  /** The problem a click on Save or Create found; it is said at its field until the draft is fixed. */
  shown?: Problem | null
}) {
  const m = useMessages(bookMessages).form
  const b = useMessages(bookMessages)
  const s = useMessages(scheduleMessages)
  const lang = useLang()
  const ids = {
    title: useId(),
    times: useId(),
    brief: useId(),
    run: useId(),
    day: useId(),
    days: useId(),
    every: useId(),
    some: useId(),
  }
  const title = useFieldError(ids.title, {
    live: { problem: shown === "title" ? (l) => bookMessages[l].form.needTitle : null, early: true },
  })
  const time = useFieldError(ids.times, {
    live: { problem: shown === "time" ? (l) => bookMessages[l].form.needTime : null, early: true },
  })
  const set = (part: Partial<DigestSpec>) => onChange({ ...spec, ...part })
  const short = (day: string) =>
    new Intl.DateTimeFormat(lang, { weekday: "short" }).format(new Date(2026, 10, 9 + WEEKDAYS.indexOf(day as never)))

  return (
    <div className="flex flex-col gap-[1.1rem] text-[0.92rem]">
      {!can.named && <OlderMemo />}
      <Field label={m.title} htmlFor={ids.title}>
        <input
          id={ids.title}
          value={spec.title}
          disabled={!can.named}
          maxLength={80}
          {...title.field}
          onChange={(e) => set({ title: e.target.value })}
          className={cx(input, "h-9 w-full max-w-[28rem] text-[0.95rem]")}
        />
        {title.hint}
      </Field>

      <Field label={m.times} hint={m.timesHint} id={ids.times}>
        <ul aria-labelledby={ids.times} className="flex flex-wrap items-center gap-2">
          {spec.times.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: two rows may hold the same time while it is typed
            <li key={i} className="flex items-center gap-1">
              <input
                type="time"
                aria-label={`${m.times} ${i + 1}`}
                value={t}
                aria-invalid={(time.error !== null && !CLOCK.test(t)) || undefined}
                aria-describedby={time.field["aria-describedby"]}
                onChange={(e) => set({ times: spec.times.map((x, j) => (j === i ? e.target.value : x)) })}
                className={input}
              />
              {spec.times.length > 1 && (
                <button
                  type="button"
                  aria-label={m.removeTime(t)}
                  onClick={() => set({ times: spec.times.filter((_, j) => j !== i) })}
                  className="cursor-pointer rounded p-1 text-ink-dim hover:bg-app-3 hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
          <li>
            <Button
              size="sm"
              variant="ghost"
              disabled={!can.named || spec.times.length >= MAX_TIMES}
              onClick={() => set({ times: [...spec.times, spec.times.at(-1) === "18:00" ? "12:00" : "18:00"] })}
              icon={<Plus className="size-4" aria-hidden />}
            >
              {m.addTime}
            </Button>
          </li>
        </ul>
        {time.hint}
      </Field>

      <Field label={m.days} id={ids.days}>
        <div className="flex flex-col gap-2">
          <div role="radiogroup" aria-labelledby={ids.days} className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-2">
              <Radio
                id={ids.every}
                name={ids.days}
                checked={!onDays}
                onChange={() => {
                  setOnDays(false)
                  set({ weekdays: [] })
                }}
              />
              <label htmlFor={ids.every}>{m.everyDay}</label>
            </span>
            <span className="flex items-center gap-2">
              <Radio
                id={ids.some}
                name={ids.days}
                checked={onDays}
                disabled={!can.named}
                onChange={() => setOnDays(true)}
              />
              <label htmlFor={ids.some} className={cx(!can.named && "text-ink-dim")}>
                {m.onDays}
              </label>
            </span>
          </div>
          {onDays && (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <ToggleChip
                  key={d}
                  on={spec.weekdays.includes(d)}
                  onChange={(on) =>
                    set({ weekdays: on ? [...spec.weekdays, d] : spec.weekdays.filter((x) => x !== d) })
                  }
                >
                  <span className="first-letter:uppercase">{short(d)}</span>
                </ToggleChip>
              ))}
            </div>
          )}
          {onDays && spec.weekdays.length === 0 && (
            <p
              id={ids.day}
              role={shown === "day" ? "alert" : undefined}
              data-problem={shown === "day" || undefined}
              tabIndex={shown === "day" ? -1 : undefined}
              className={cx("text-[0.85rem]", shown === "day" ? "text-bad" : "text-warn-ink")}
            >
              {m.pickDay}
            </p>
          )}
        </div>
      </Field>

      <Field label={m.sources} hint={m.sourcesHint}>
        <fieldset disabled={!can.named} className={cx("flex flex-wrap gap-1.5", !can.named && "opacity-55")}>
          {SOURCES.map((src) => (
            <ToggleChip
              key={src}
              on={spec.sources.includes(src)}
              onChange={(on) => set({ sources: on ? [...spec.sources, src] : spec.sources.filter((x) => x !== src) })}
            >
              {b.sources[src as Source]}
            </ToggleChip>
          ))}
        </fieldset>
      </Field>

      <Routes routes={spec.routes} onChange={(routes) => set({ routes })} m={s} />

      {creating && (
        <Field label={m.brief} hint={m.briefHint} htmlFor={ids.brief}>
          <textarea
            id={ids.brief}
            rows={3}
            value={spec.brief ?? ""}
            placeholder={m.briefPlaceholder}
            onChange={(e) => set({ brief: e.target.value || null })}
            className={area}
          />
        </Field>
      )}

      <Field label={m.caps} hint={m.perDayHint}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Usd
            label={m.perRun}
            value={spec.maxCostUsd ?? 0}
            min={0.01}
            onChange={(maxCostUsd) => set({ maxCostUsd })}
          />
          <Usd
            label={m.perDay}
            value={spec.maxCostPerDayUsd ?? 0}
            min={0}
            onChange={(maxCostPerDayUsd) => set({ maxCostPerDayUsd })}
          />
        </div>
      </Field>

      {creating && (
        <div className="flex items-center gap-2">
          <Checkbox id={ids.run} checked={spec.scheduled} onChange={(scheduled) => set({ scheduled })} />
          <label htmlFor={ids.run} className="font-medium text-ink">
            {m.schedule}
          </label>
        </div>
      )}
    </div>
  )
}

function Field(props: { label: string; hint?: string; htmlFor?: string; id?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {props.htmlFor ? (
        <label htmlFor={props.htmlFor} className="font-medium text-ink">
          {props.label}
        </label>
      ) : (
        <p id={props.id} className="font-medium text-ink">
          {props.label}
        </p>
      )}
      {props.hint && <p className="text-[0.85rem] text-ink-dim">{props.hint}</p>}
      {props.children}
    </div>
  )
}

function Usd(props: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <span className="flex items-center gap-2">
      <label htmlFor={id} className="text-ink-soft">
        {props.label}
      </label>
      <span className="text-ink-dim">$</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={props.min}
        max={50}
        step={0.1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={cx(input, "w-[5.5rem] tabular-nums")}
      />
    </span>
  )
}

const NO_CHOICES: RouteChoices = { bots: [], ownChats: [], mailboxes: [] }

/** What the account and the chat or address fields suggest; the owner may still type any other. */
function suggestions(choices: RouteChoices, kind: RouteKind, profile: string, m: ScheduleText) {
  if (kind === "telegramBot")
    return {
      accounts: choices.bots,
      targets: choices.ownChats.map((c) => c.value),
      notes: Object.fromEntries(choices.ownChats.map((c) => [c.value, m.ownChat(c.profile)])),
    }
  const boxes = choices.mailboxes.filter((b) => b.address)
  // The account's own address first: a digest sent to the mailbox it comes from.
  const mine = boxes.filter((b) => b.profile === profile.trim())
  const ordered = [...mine, ...boxes.filter((b) => !mine.includes(b))]
  const targets = [...new Set(ordered.map((b) => b.address ?? ""))]
  return {
    accounts: choices.mailboxes.map((b) => b.profile),
    targets,
    notes: Object.fromEntries(ordered.map((b) => [b.address ?? "", m.ownMailbox(b.profile)])),
  }
}

function Routes({ routes, onChange, m }: { routes: string[]; onChange: (r: string[]) => void; m: ScheduleText }) {
  const kindId = useId()
  const [kind, setKind] = useState<RouteKind>("telegramBot")
  const [profile, setProfile] = useState("")
  const [to, setTo] = useState("")
  const { data } = useQuery({
    queryKey: ["digest", "route-choices"],
    queryFn: () => platform.digestRouteChoices(),
    staleTime: 60_000,
  })
  const offer = suggestions(data ?? NO_CHOICES, kind, profile, m)
  const draft = `${PREFIX[kind]}:${profile.trim()}/${to.trim()}`
  const rowId = useId()
  const need = useFieldError(rowId, {
    live: { problem: parsedRoute(draft) ? null : (l) => scheduleMessages[l].routeIncomplete(kind) },
  })
  const add = () => {
    if (!parsedRoute(draft)) return need.fail()
    if (!routes.includes(draft)) onChange([...routes, draft])
    setTo("")
    need.clear()
  }
  return (
    <Field label={m.routes} hint={m.routesHint}>
      {routes.length > 0 && (
        <ul className="flex flex-col gap-1">
          {routes.map((r) => {
            const p = parsedRoute(r)
            const label = p ? routeLabel(p, m) : r
            return (
              <li key={r} className="flex items-center gap-2 text-ink">
                <span>{label}</span>
                <button
                  type="button"
                  aria-label={m.removeRoute(label)}
                  onClick={() => onChange(routes.filter((x) => x !== r))}
                  className="cursor-pointer rounded p-0.5 text-ink-dim hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div id={rowId} className="flex flex-wrap items-center gap-2">
        <Select
          id={kindId}
          size="sm"
          aria-label={m.routes}
          value={kind}
          onChange={setKind}
          options={[
            { value: "telegramBot", label: m.routeKinds.telegramBot },
            { value: "email", label: m.routeKinds.email },
          ]}
        />
        <Combobox
          aria-label={m.routeProfile}
          placeholder={m.routeProfile}
          value={profile}
          onChange={setProfile}
          aria-invalid={(need.error !== null && !profile.trim()) || undefined}
          aria-describedby={need.field["aria-describedby"]}
          options={offer.accounts}
          className="w-[10rem]"
        />
        <Combobox
          aria-label={m.routeTo(kind)}
          placeholder={m.routeTo(kind)}
          value={to}
          onChange={setTo}
          aria-invalid={(need.error !== null && !to.trim()) || undefined}
          aria-describedby={need.field["aria-describedby"]}
          options={offer.targets}
          notes={offer.notes}
          className="w-[16rem]"
        />
        <Button size="sm" variant="ghost" onClick={add}>
          {m.addRoute}
        </Button>
      </div>
      {need.hint}
    </Field>
  )
}

/** Digests are written by Claude Code; without it nothing can run, and Agents installs it. */
export function NoHarness() {
  const m = useMessages(bookMessages).form
  return (
    <p className="text-[0.92rem] text-warn-ink">
      {m.noHarness}{" "}
      <button
        type="button"
        onClick={() => useNav.getState().go("agents")}
        className="cursor-pointer font-medium text-brand underline-offset-2 hover:text-brand-hover hover:underline"
      >
        {m.toAgents}
      </button>
    </p>
  )
}

/** One digest's settings, saved with `digest edit` (or the schedule an older memo keeps). */
export function ScheduleCard({
  item,
  title,
  can,
  harness,
}: {
  item: DigestItem
  title: string
  can: Can
  harness: boolean
}) {
  const m = useMessages(bookMessages)
  const lang = useLang()
  const titleId = useId()
  const { busy, failed, remembered, save } = useDigestBook()
  const start = specOf(item, title, remembered)
  const [draft, setDraft] = useState(start)
  const [savedOnce, setSavedOnce] = useState(false)
  const key = JSON.stringify(start)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new answer from memo resets the draft, nothing else
  useEffect(() => setDraft(start), [key])
  const [onDays, setOnDays] = useState(start.weekdays.length > 0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: as the draft, from memo's answer only
  useEffect(() => setOnDays(start.weekdays.length > 0), [key])
  const problem = problemOf(draft, onDays)
  const [tried, setTried] = useState(false)
  const form = useRef<HTMLDivElement>(null)
  const dirty = JSON.stringify(draft) !== key
  const saveId = useId()
  const unchanged = useFieldError(saveId, {
    live: { problem: dirty ? null : (l) => bookMessages[l].form.nothingToSave },
  })
  const working = busy[item.name] === "save"
  const cap = dailyCap(item.maxCostPerDayUsd)

  return (
    <section aria-labelledby={titleId} className={card}>
      <h2 id={titleId} className="text-[1.05rem] font-semibold text-ink">
        {m.one.settings}
      </h2>
      {item.spentTodayUsd !== null && (
        <p className="text-[0.88rem] text-ink-soft tabular-nums">
          {m.one.spentToday(formatUsd(item.spentTodayUsd, lang), cap === null ? null : formatUsd(cap, lang))}
        </p>
      )}
      {!harness && <NoHarness />}
      <div ref={form}>
        <DigestFields
          key={item.name}
          spec={draft}
          onChange={setDraft}
          onDays={onDays}
          setOnDays={setOnDays}
          can={can}
          creating={false}
          shown={tried ? problem : null}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-line border-t pt-3">
        {savedOnce && !dirty && !working && (
          <span className="text-[0.88rem] text-ink-dim" aria-live="polite">
            {m.form.saved}
          </span>
        )}
        <span className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty || working}
          onClick={() => {
            setDraft(start)
            setOnDays(start.weekdays.length > 0)
          }}
        >
          {m.form.cancel}
        </Button>
        <Button
          id={saveId}
          variant="primary"
          size="sm"
          disabled={working || !harness}
          onClick={async () => {
            if (!dirty) return unchanged.fail()
            if (problem) {
              setTried(true)
              focusProblem(form.current)
              return
            }
            setSavedOnce(await save(draft, false))
          }}
        >
          {working ? m.form.saving : m.form.save}
        </Button>
      </div>
      {unchanged.hint}
      {failed?.name === item.name && failed.what === "save" && (
        <ErrorNotice inline>{m.form.failedSave(failed.message)}</ErrorNotice>
      )}
    </section>
  )
}

/** The tool whose panel sets a schedule up, by the name the catalog gives it there; null for one made by hand. */
const setUpIn = (name: string) => tools.find((t) => t.mailAgent?.name === name) ?? null

export function OtherSchedules({ others }: { others: OtherSchedule[] }) {
  const m = useMessages(scheduleMessages)
  const lang = useLang()
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <h2 id={titleId} className="font-semibold text-ink">
        {m.others}
      </h2>
      <p className="text-[0.85rem] text-ink-dim">{m.othersHint}</p>
      <ul className="flex flex-col gap-1 text-[0.9rem] text-ink-soft">
        {others.map((o) => {
          const cap = dailyCap(o.maxCostPerDayUsd)
          const last = o.last
          const skip = last?.skipped
          const parts = [o.when]
          if (last) {
            parts.push(
              skip
                ? m.skipped(ago(skip.at), (skip.reason && m.skipReasons[skip.reason]) || skip.why)
                : `${m.lastRun(ago(last.at)).toLowerCase()} · ${runOutcome(last) === "failed" ? m.failed(last.failures) : m.ok}`,
            )
          }
          if (o.spentTodayUsd !== null)
            parts.push(m.spentToday(formatUsd(o.spentTodayUsd, lang), cap === null ? null : formatUsd(cap, lang)))
          const tool = setUpIn(o.name)
          return (
            <li key={o.name} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <Lamp tone={last ? TONE[runOutcome(last)] : "idle"} size="sm" />
              <span className="font-medium text-ink">{o.name}</span>
              <span>{parts.join(" · ")}</span>
              {tool ? (
                <button
                  type="button"
                  onClick={() => openToolAt(tool.id, "mailAgent")}
                  className="cursor-pointer text-[0.88rem] font-medium text-brand underline-offset-2 hover:text-brand-hover hover:underline"
                >
                  {m.changeMailAgent(tool.name)}
                </button>
              ) : (
                <span className="text-[0.85rem] text-ink-dim">{m.madeByHand}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export { MORNING }
