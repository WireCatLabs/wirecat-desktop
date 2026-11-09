import { LoaderCircle, Play, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { dailyCap, formatUsd, runOutcome } from "@/domain/mail-agent"
import { ago, ToolNeeded } from "@/features/tools"
import { useLang, useMessages } from "@/i18n"
import type { DigestSchedule, OtherSchedule, Route, ScheduleRun } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { Switch } from "@/ui/Switch"
import { type ScheduleText, scheduleMessages } from "./messages-schedule"
import { DEFAULT_SETTINGS, useDigestSchedule } from "./schedule-store"

type RouteKind = Route["kind"]
const PREFIX: Record<RouteKind, string> = { telegramBot: "telegram-bot", email: "email" }
const input =
  "h-8 rounded-[0.3rem] border border-line-strong bg-app px-2 text-[0.9rem] text-ink focus-visible:outline-2 focus-visible:outline-brand"

const routeLabel = (r: { kind: RouteKind; profile: string; to: string }, m: ScheduleText) =>
  `${m.routeKinds[r.kind]} (${r.profile} → ${r.to})`

/** `telegram-bot:personal/user:1001` read back for display; the form only ever builds this shape. */
const parsedRoute = (route: string): { kind: RouteKind; profile: string; to: string } | null => {
  const m = /^(telegram-bot|email):([^/]+)\/(.+)$/.exec(route)
  if (!m) return null
  return { kind: m[1] === "email" ? "email" : "telegramBot", profile: m[2] ?? "", to: m[3] ?? "" }
}

function lastLine(last: ScheduleRun, m: ScheduleText, lang: string): string {
  const outcome = runOutcome(last)
  const parts = [m.lastRun(ago(last.at)), outcome === "failed" ? m.failed(last.failures) : m.ok]
  if (last.costUsd !== null) parts.push(m.cost(formatUsd(last.costUsd, lang)))
  for (const d of last.deliveries) if (!d.ok && d.kind) parts.push(m.notDelivered(m.routeKinds[d.kind]))
  return parts.join(" · ")
}

const TONE: Record<ReturnType<typeof runOutcome>, LampTone> = { ok: "ok", skipped: "warn", failed: "bad" }

/**
 * The morning digest's schedule, through memo's own `schedule` commands: what it does now, its last run and the
 * day's spend, the time, on and off, and a run now that names its price first. memo's other schedules are listed
 * below it, read only.
 */
export function ScheduleCard() {
  const m = useMessages(scheduleMessages)
  const titleId = useId()
  const switchId = useId()
  const { status, error, busy, failed, load } = useDigestSchedule()

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-[0.2rem] border border-line-strong bg-app px-[1.3rem] py-[1.1rem]"
    >
      <h2 id={titleId} className="text-[1.05rem] font-semibold text-ink">
        {m.title}
      </h2>
      {error && !status ? (
        <ErrorNotice inline>{m.readFailed(error)}</ErrorNotice>
      ) : status === null ? (
        <Skeleton className="h-[4.5rem] w-full" label={m.title} />
      ) : status.state === "noMemo" ? (
        <ToolNeeded inline gap={{ kind: "missing", tool: "memo", others: [] }} />
      ) : status.state === "old" ? (
        <ToolNeeded inline gap={{ kind: "old", tool: "memo", version: status.version, need: status.need }} />
      ) : (
        <>
          <Toggle id={switchId} digest={status.digest} harness={status.harness} />
          <Collapse open={status.digest !== null}>{status.digest && <On digest={status.digest} />}</Collapse>
          <Collapse open={status.digest === null}>
            {status.digest === null && <Off harness={status.harness} />}
          </Collapse>
          <Collapse open={failed !== null}>
            <ErrorNotice inline>
              {failed &&
                (failed.what === "save"
                  ? m.failedSave(failed.message)
                  : failed.what === "remove"
                    ? m.failedRemove(failed.message)
                    : m.failedRun(failed.message))}
            </ErrorNotice>
          </Collapse>
          {busy === "run" && (
            <p className="flex items-center gap-2 text-[0.9rem] text-ink-soft" aria-live="polite">
              <LoaderCircle className="size-4 animate-spin" aria-hidden /> {m.running}
            </p>
          )}
          {status.others.length > 0 && <Others others={status.others} />}
        </>
      )}
    </section>
  )
}

function Toggle({ id, digest, harness }: { id: string; digest: DigestSchedule | null; harness: boolean }) {
  const m = useMessages(scheduleMessages)
  const { busy, remembered, save, remove } = useDigestSchedule()
  const on = busy === "save" ? true : busy === "remove" ? false : digest !== null
  // Off with nothing remembered: the form below names the time and routes, and its button turns it on.
  const usable = digest !== null || (harness && remembered !== null)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Switch
        id={id}
        checked={on}
        disabled={busy !== null || !usable}
        onChange={(next) => {
          if (!next) void remove()
          else if (remembered) void save(remembered)
        }}
      />
      <label htmlFor={id} className="font-medium">
        {m.toggle}
      </label>
      {(busy === "save" || busy === "remove") && (
        <span className="text-[0.9rem] text-ink-dim" aria-live="polite">
          {busy === "save" ? m.saving : m.removing}
        </span>
      )}
    </div>
  )
}

function On({ digest }: { digest: DigestSchedule }) {
  const m = useMessages(scheduleMessages)
  const lang = useLang()
  const timeId = useId()
  const { busy, remembered, save, runNow } = useDigestSchedule()
  const [time, setTime] = useState(digest.time ?? DEFAULT_SETTINGS.time)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => setTime(digest.time ?? DEFAULT_SETTINGS.time), [digest.time])

  const cap = dailyCap(digest.maxCostPerDayUsd)
  const capped = cap !== null && digest.spentTodayUsd !== null && digest.spentTodayUsd >= cap
  const price = digest.last?.costUsd != null ? formatUsd(digest.last.costUsd, lang) : null
  const routes = digest.routes.map((r) => routeLabel(r, m)).join(", ")
  const settings = remembered ?? {
    ...DEFAULT_SETTINGS,
    routes: digest.routes.map((r) => r.value),
  }

  return (
    <div className="flex flex-col gap-2 text-[0.92rem] text-ink-soft">
      <p>
        {digest.time ? m.daily(digest.time) : m.when(digest.when)} · {m.routes}: {routes || m.noRoute}
      </p>
      {digest.last ? (
        <p className="flex items-center gap-2">
          <Lamp tone={TONE[runOutcome(digest.last)]} size="sm" />
          <span>{lastLine(digest.last, m, lang)}</span>
        </p>
      ) : (
        <p>{m.noRunYet}</p>
      )}
      {digest.spentTodayUsd !== null && (
        <p className="tabular-nums">
          {m.spentToday(formatUsd(digest.spentTodayUsd, lang), cap === null ? null : formatUsd(cap, lang))}
        </p>
      )}
      {capped && <p className="text-warn">{m.capReached}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <label htmlFor={timeId} className="font-medium text-ink">
          {m.time}
        </label>
        <input id={timeId} type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null || !time || time === digest.time}
          onClick={() => void save({ ...settings, time, routes: digest.routes.map((r) => r.value) })}
        >
          {m.changeTime}
        </Button>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy !== null || capped}
          onClick={() => setConfirm(true)}
          icon={<Play className="size-4" aria-hidden />}
        >
          {m.runNow}
        </Button>
      </div>
      <Dialog
        open={confirm}
        title={m.confirmTitle}
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              {m.cancel}
            </Button>
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                setConfirm(false)
                void runNow()
              }}
            >
              {m.confirmRun(price)}
            </Button>
          </>
        }
      >
        <p className="text-ink-soft">{m.confirmBody(price, m.confirmTo(routes))}</p>
      </Dialog>
    </div>
  )
}

function Off({ harness }: { harness: boolean }) {
  const m = useMessages(scheduleMessages)
  const lang = useLang()
  const timeId = useId()
  const kindId = useId()
  const { busy, remembered, save } = useDigestSchedule()
  const start = remembered ?? DEFAULT_SETTINGS
  const [time, setTime] = useState(start.time)
  const [routes, setRoutes] = useState<string[]>(start.routes)
  const [kind, setKind] = useState<RouteKind>("telegramBot")
  const [profile, setProfile] = useState("")
  const [to, setTo] = useState("")

  const add = () => {
    const route = `${PREFIX[kind]}:${profile.trim()}/${to.trim()}`
    if (parsedRoute(route) && !routes.includes(route)) setRoutes([...routes, route])
    setTo("")
  }

  return (
    <div className="flex flex-col gap-2.5 text-[0.92rem] text-ink-soft">
      <p className="max-w-[70ch]">{m.offBody}</p>
      {!harness && <p className="text-warn">{m.noHarness}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={timeId} className="font-medium text-ink">
          {m.time}
        </label>
        <input id={timeId} type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="font-medium text-ink">{m.routes}</p>
        <p className="text-[0.85rem] text-ink-dim">{m.routesHint}</p>
        {routes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {routes.map((r) => {
              const p = parsedRoute(r)
              const label = p ? routeLabel(p, m) : r
              return (
                <li key={r} className="flex items-center gap-2">
                  <span>{label}</span>
                  <button
                    type="button"
                    aria-label={m.removeRoute(label)}
                    onClick={() => setRoutes(routes.filter((x) => x !== r))}
                    className="cursor-pointer rounded p-0.5 text-ink-dim hover:text-ink"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
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
          <input
            aria-label={m.routeProfile}
            placeholder={m.routeProfile}
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            className={`${input} w-[9rem]`}
          />
          <input
            aria-label={m.routeTo(kind)}
            placeholder={m.routeTo(kind)}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`${input} w-[14rem]`}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={!parsedRoute(`${PREFIX[kind]}:${profile.trim()}/${to.trim()}`)}
            onClick={add}
          >
            {m.addRoute}
          </Button>
        </div>
      </div>
      <p className="text-[0.85rem] text-ink-dim">
        {m.caps(formatUsd(start.maxCostUsd, lang), formatUsd(start.maxCostPerDayUsd, lang))}
      </p>
      <div>
        <Button
          size="sm"
          variant="primary"
          disabled={busy !== null || !harness || !time}
          onClick={() => void save({ ...start, time, routes })}
        >
          {remembered ? m.turnOn : m.create}
        </Button>
      </div>
    </div>
  )
}

function Others({ others }: { others: OtherSchedule[] }) {
  const m = useMessages(scheduleMessages)
  const lang = useLang()
  return (
    <div className="flex flex-col gap-1.5 border-line border-t pt-3">
      <h3 className="font-semibold text-ink">{m.others}</h3>
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
          return (
            <li key={o.name} className="flex items-center gap-2">
              <Lamp tone={last ? TONE[runOutcome(last)] : "idle"} size="sm" />
              <span className="font-medium text-ink">{o.name}</span>
              <span>{parts.join(" · ")}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
