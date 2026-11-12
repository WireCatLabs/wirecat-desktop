import { useCallback, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { dailyCap, formatUsd, type RunOutcome, runOutcome } from "@/domain/mail-agent"
import { useLang, useMessages } from "@/i18n"
import { ago } from "@/i18n/ago"
import type { BackgroundAgents } from "@/platform/background-agent-schemas"
import type { Skipped, MailAgent as State } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import {
  agentName,
  BackgroundAgentChoice,
  costed,
  otherAgent,
  useAgentsLoaded,
  useAgentWarning,
} from "@/shared/BackgroundAgentChoice"
import { useBackgroundAgents } from "@/shared/background-agent-store"
import { errorText } from "@/shared/errors"
import { backgroundAgentMessages } from "@/shared/messages-background-agent"
import { OpenLink } from "@/shared/OpenLink"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { Skeleton } from "@/ui/Skeleton"
import { Switch } from "@/ui/Switch"
import { openTool } from "./go"
import { type MailAgentText, mailAgentMessages } from "./messages-mail-agent"
import { syncScheduleMessages } from "./messages-sync-schedule"

const TONE: Record<RunOutcome, LampTone> = { ok: "ok", skipped: "warn", failed: "bad" }

type Pending = { on: boolean; every?: string } | null
type Failure = { on: boolean | null; every?: string; message: string } | null

const skipWhy = (m: MailAgentText, { reason }: Skipped) =>
  reason && Object.hasOwn(m.skipReasons, reason) ? m.skipReasons[reason] : undefined

/**
 * memo's mail agent for Email: the switch is memo's own `schedule agent` and `schedule remove`, so the timer it
 * writes (systemd, launchd or Task Scheduler) is memo's, and so are the words when it refuses.
 */
export function MailAgent({ tool }: { tool: CatalogTool }) {
  const m = useMessages(mailAgentMessages)
  const duration = useMessages(syncScheduleMessages).duration
  const headingId = useId()
  const switchId = useId()
  const helpId = useId()
  const everyId = useId()
  const choices = tool.mailAgent?.choices ?? []
  // The interval to turn on with: the schedule's own while it runs, else the last one seen here, else the catalog's.
  const [every, setEvery] = useState(tool.mailAgent?.every ?? "30m")
  const [state, setState] = useState<State | null>(null)
  const [waiting, setWaiting] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [failure, setFailure] = useState<Failure>(null)
  const [ask, setAsk] = useState(false)
  const agents = useAgentsLoaded()
  const warning = useAgentWarning()
  const effective = agents?.effective ?? null
  const ready = agents?.agents.filter((a) => a.state === "ready").map((a) => a.id) ?? []
  const choose = state?.state === "off" && effective === null && ready.length > 1

  const loadWaiting = useCallback(() => {
    platform.mailAgentWaiting(tool.id).then(setWaiting, () => setWaiting(null))
  }, [tool.id])

  useEffect(() => {
    let live = true
    platform.mailAgentStatus(tool.id).then(
      (s) => {
        if (!live) return
        setState(s)
        if (s.state === "on" && s.every) setEvery(s.every)
      },
      (e) => live && setFailure({ on: null, message: errorText(e) }),
    )
    loadWaiting()
    return () => {
      live = false
    }
  }, [tool.id, loadWaiting])

  // A new interval keeps the agent the schedule runs in; only an explicit pick moves it to another.
  // `choose`: an explicit pick is the owner's choice for every job; saving the schedule again as it is moves nothing.
  const change = (on: boolean, interval = every, pick?: string, choose = true) => {
    const agent = pick ?? (state?.state === "on" ? (state.agent ?? effective) : effective)
    if (on && agent === null) return setAsk(true)
    setAsk(false)
    setPending(on && state?.state === "on" && !pick ? { on, every: interval } : { on })
    setFailure(null)
    platform.mailAgentSet(tool.id, on, on ? interval : undefined, on ? (agent ?? undefined) : undefined).then(
      (s) => {
        setState(s)
        if (s.state === "on" && s.every) setEvery(s.every)
        setPending(null)
        loadWaiting()
        // The mail agent is the one job that can change agent, so the owner's click here is his choice for all.
        if (choose && pick && agents?.chosen !== pick) void useBackgroundAgents.getState().choose(pick)
      },
      (e) => {
        setPending(null)
        setFailure(
          on && state?.state === "on" ? { on, every: interval, message: errorText(e) } : { on, message: errorText(e) },
        )
      },
    )
  }
  const pick = (next: string) => {
    setEvery(next)
    if (state?.state === "on" && next !== state.every) change(true, next)
  }
  const shownEvery = state?.state === "on" ? state.every : every

  const on = pending ? pending.on : state?.state === "on"
  const usable = state?.state === "on" || (state?.state === "off" && state.harness)
  const runningIn = state?.state === "on" ? state.agent : effective
  return (
    <section
      aria-labelledby={headingId}
      data-place={`mailAgent:${tool.id}`}
      className="flex min-w-0 flex-col gap-3 border-line border-t pt-4 lg:col-span-2"
    >
      <h4 id={headingId} className="text-[1.02rem] font-semibold text-ink">
        {m.title}
      </h4>
      <p className="max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">{m.what}</p>
      {state === null && failure === null && <Skeleton className="h-[2.25rem] w-full max-w-[28rem]" />}
      {state?.state === "noMemo" && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.9rem] text-ink-soft">{m.noMemo}</p>
          <Button size="sm" variant="secondary" onClick={() => openTool("memo")}>
            {m.openMemo}
          </Button>
        </div>
      )}
      {state?.state === "old" && <p className="text-[0.9rem] text-ink-soft">{m.old(state.version, state.need)}</p>}
      {(state?.state === "on" || state?.state === "off") && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex min-w-0 items-start gap-3">
              <Switch
                id={switchId}
                checked={on}
                disabled={pending !== null || !usable}
                aria-describedby={helpId}
                onChange={change}
              />
              <label htmlFor={switchId} className="min-w-0 font-medium">
                {m.toggle}
              </label>
            </span>
            {choices.length > 0 && (
              <>
                <label htmlFor={everyId} className="ml-2 text-[0.9rem] text-ink-soft">
                  {m.every}
                </label>
                <Select
                  id={everyId}
                  size="sm"
                  value={shownEvery ?? ""}
                  {...(state?.state === "on" ? { placeholder: state.when } : {})}
                  disabled={pending !== null || !usable}
                  onChange={pick}
                  options={choices.map((c) => ({ value: c, label: duration(c) }))}
                />
              </>
            )}
            {pending && (
              <span className="text-[0.9rem] text-ink-dim" aria-live="polite">
                {pending.every ? m.changing : pending.on ? m.turningOn : m.turningOff}
              </span>
            )}
          </div>
          <p id={helpId} className="text-[0.875rem] text-ink-dim">
            {m.toggleHelp(
              shownEvery ? duration(shownEvery) : state?.state === "on" ? state.when : duration(every),
              runningIn === null ? null : agentName(agents, runningIn),
              runningIn !== null && costed(agents, runningIn),
            )}
          </p>
        </div>
      )}
      <Collapse open={choose}>
        <div className="flex flex-col gap-2">
          <p className={ask ? "text-[0.9rem] text-warn-ink" : "text-[0.9rem] text-ink-soft"} aria-live="polite">
            {m.needAgent}
          </p>
          {choose && <BackgroundAgentChoice describedBy={helpId} />}
        </div>
      </Collapse>
      <Collapse open={state?.state === "off" && !state.harness}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.9rem] text-ink-soft">{m.noHarness}</p>
          <OpenLink url="https://claude.com/claude-code" variant="ghost">
            {m.aboutClaude}
          </OpenLink>
        </div>
      </Collapse>
      <Collapse open={state?.state === "on"}>
        {state?.state === "on" && (
          <Status
            state={state}
            m={m}
            effective={effective}
            agents={agents}
            busy={pending !== null}
            onRun={(agent) => warning.ask(agent, () => change(true, shownEvery ?? every, agent))}
            onResave={(agent) => warning.ask(agent, () => change(true, shownEvery ?? every, agent, false))}
          />
        )}
      </Collapse>
      <Collapse open={failure !== null}>
        <ErrorNotice inline raw={failure?.message ?? null}>
          {failure &&
            (failure.on === null
              ? m.readFailed
              : failure.every
                ? m.failedEvery
                : failure.on
                  ? m.failedOn
                  : m.failedOff)}
        </ErrorNotice>
      </Collapse>
      <Collapse open={waiting !== null}>
        <Waiting count={waiting} m={m} />
      </Collapse>
      {warning.dialog}
    </section>
  )
}

type StatusProps = {
  state: Extract<State, { state: "on" }>
  m: MailAgentText
  /** The agent for background jobs; another one than the schedule's is offered, never switched to. */
  effective: string | null
  agents: BackgroundAgents | null
  busy: boolean
  onRun: (agent: string) => void
  /** Saves the schedule again with the same agent and interval, for one memo stopped until it is saved again. */
  onResave: (agent: string) => void
}

function Status({ state, m, effective, agents, busy, onRun, onResave }: StatusProps) {
  const lang = useLang()
  const a = useMessages(backgroundAgentMessages)
  const { last, spentTodayUsd, trouble } = state
  // After a switch the last run is still the old agent's: its refusal no longer says anything about the job.
  const failing =
    trouble !== null &&
    last !== null &&
    last.exitCode !== 0 &&
    (trouble.agent === null || state.agent === null || trouble.agent === state.agent)
  const troubled = failing ? (trouble.agent ?? state.agent) : null
  const other = otherAgent(agents, troubled)
  const instead = failing ? other.instead : undefined
  const pickOther = failing && other.pick
  const name = (id: string) => agentName(agents, id)
  const paid = state.agent === null || costed(agents, state.agent)
  const moved = !failing && state.agent !== null && effective !== null && effective !== state.agent
  const outcome = last ? runOutcome(last) : null
  // cli-core's start guard (SEC-11): a schedule saved before it, or changed since, is skipped until saved again.
  const stale = last?.skipped?.reason === "agent.refused" && /save it again/i.test(last.skipped.why)
  const cap = dailyCap(state.maxCostPerDayUsd)
  return (
    <div className="flex flex-col gap-1 text-[0.9rem] text-ink-soft" aria-live="polite">
      {last?.skipped && !skipWhy(m, last.skipped) ? (
        <ErrorNotice inline tone="warn" raw={last.skipped.why}>
          {m.skippedUnknown(ago(last.skipped.at))}
        </ErrorNotice>
      ) : last && outcome ? (
        <p className="flex items-center gap-2">
          <Lamp tone={TONE[outcome]} size="sm" />
          <span>
            {last.skipped
              ? m.skipped(ago(last.skipped.at), skipWhy(m, last.skipped) ?? "")
              : `${m.lastRun(ago(last.at))} · ${outcome === "ok" ? m.ok : m.failed(last.failures)}`}
          </span>
        </p>
      ) : (
        <p>{m.noRunYet}</p>
      )}
      {spentTodayUsd !== null && paid && (
        <p className="tabular-nums">
          {m.spentToday(formatUsd(spentTodayUsd, lang), cap === null ? null : formatUsd(cap, lang))}
        </p>
      )}
      {!paid && state.agent && <p>{a.noCost(name(state.agent))}</p>}
      {failing && (
        <ErrorNotice
          inline
          raw={trouble.line}
          action={
            instead && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRun(instead)}>
                {a.switchTo(name(instead))}
              </Button>
            )
          }
        >
          {a.trouble[trouble.kind](troubled === null ? a.theAgent : name(troubled))}
        </ErrorNotice>
      )}
      {stale && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-warn-ink">{state.agent ? m.resave(name(state.agent)) : m.resaveUnknown}</p>
          {state.agent && (
            <Button size="sm" disabled={busy} onClick={() => state.agent && onResave(state.agent)}>
              {m.resaveButton}
            </Button>
          )}
        </div>
      )}
      {pickOther && (
        <div className="flex flex-col gap-2">
          <p>{m.pickOther}</p>
          <BackgroundAgentChoice />
        </div>
      )}
      {moved && state.agent && effective && (
        <div className="flex flex-wrap items-center gap-3">
          <p>{m.otherChosen(name(effective), name(state.agent))}</p>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRun(effective)}>
            {a.switchTo(name(effective))}
          </Button>
        </div>
      )}
    </div>
  )
}

function Waiting({ count, m }: { count: number | null; m: MailAgentText }) {
  if (count === null) return null
  if (count === 0) return <p className="text-[0.9rem] text-ink-soft">{m.noneWaiting}</p>
  return (
    <div className="flex max-w-[28rem] flex-col gap-1.5">
      <p className="text-[0.9rem] font-medium text-ink">{m.waiting(count)}</p>
      <p className="text-[0.875rem] text-ink-dim">{m.review}</p>
      <CopyField value="memo review list" label={m.copyReview} />
    </div>
  )
}
