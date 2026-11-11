import { useCallback, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { dailyCap, formatUsd, type RunOutcome, runOutcome } from "@/domain/mail-agent"
import { useLang, useMessages } from "@/i18n"
import type { Skipped, MailAgent as State } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { agentName, BackgroundAgentChoice, useAgentsLoaded } from "@/shared/BackgroundAgentChoice"
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
import { ago } from "./connect-steps"
import { openTool } from "./go"
import { type MailAgentText, mailAgentMessages } from "./messages-mail-agent"
import { syncScheduleMessages } from "./messages-sync-schedule"

const TONE: Record<RunOutcome, LampTone> = { ok: "ok", skipped: "warn", failed: "bad" }

type Pending = { on: boolean; every?: string } | null
type Failure = { on: boolean | null; every?: string; message: string } | null

const skipWhy = (m: MailAgentText, { reason, why }: Skipped) =>
  (reason && Object.hasOwn(m.skipReasons, reason) ? m.skipReasons[reason] : undefined) ?? why

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

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
  const names = useMessages(backgroundAgentMessages).names
  const effective = agents?.effective ?? null
  const installed = agents?.agents.filter((a) => a.installed).length ?? 0
  const choose = state?.state === "off" && effective === null && installed > 1

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
      (e) => live && setFailure({ on: null, message: messageOf(e) }),
    )
    loadWaiting()
    return () => {
      live = false
    }
  }, [tool.id, loadWaiting])

  // A new interval keeps the agent the schedule runs in; only an explicit pick moves it to another.
  const change = (on: boolean, interval = every, pick?: string) => {
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
      },
      (e) => {
        setPending(null)
        setFailure(
          on && state?.state === "on" ? { on, every: interval, message: messageOf(e) } : { on, message: messageOf(e) },
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
              runningIn === null ? null : agentName(names, runningIn),
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
            others={agents?.agents.filter((a) => a.installed).map((a) => a.id) ?? []}
            busy={pending !== null}
            onRun={(agent) => change(true, shownEvery ?? every, agent)}
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
    </section>
  )
}

type StatusProps = {
  state: Extract<State, { state: "on" }>
  m: MailAgentText
  /** The agent for background jobs; another one than the schedule's is offered, never switched to. */
  effective: string | null
  /** Installed agents. */
  others: string[]
  busy: boolean
  onRun: (agent: string) => void
}

function Status({ state, m, effective, others, busy, onRun }: StatusProps) {
  const lang = useLang()
  const a = useMessages(backgroundAgentMessages)
  const { last, spentTodayUsd, trouble } = state
  const failing = trouble !== null && last !== null && last.exitCode !== 0
  const troubled = failing ? (trouble.agent ?? state.agent) : null
  const instead = failing ? others.find((id) => id !== troubled) : undefined
  const moved = !failing && state.agent !== null && effective !== null && effective !== state.agent
  const outcome = last ? runOutcome(last) : null
  const cap = dailyCap(state.maxCostPerDayUsd)
  return (
    <div className="flex flex-col gap-1 text-[0.9rem] text-ink-soft" aria-live="polite">
      {last && outcome ? (
        <p className="flex items-center gap-2">
          <Lamp tone={TONE[outcome]} size="sm" />
          <span>
            {last.skipped
              ? m.skipped(ago(last.skipped.at), skipWhy(m, last.skipped))
              : `${m.lastRun(ago(last.at))} · ${outcome === "ok" ? m.ok : m.failed(last.failures)}`}
          </span>
        </p>
      ) : (
        <p>{m.noRunYet}</p>
      )}
      {spentTodayUsd !== null && (
        <p className="tabular-nums">
          {m.spentToday(formatUsd(spentTodayUsd, lang), cap === null ? null : formatUsd(cap, lang))}
        </p>
      )}
      {state.agent === "codex" && <p>{a.codexNoCap}</p>}
      {failing && (
        <ErrorNotice
          inline
          raw={trouble.line}
          action={
            instead && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRun(instead)}>
                {a.runVia(agentName(a.names, instead))}
              </Button>
            )
          }
        >
          {a.trouble[trouble.kind](troubled === null ? a.theAgent : agentName(a.names, troubled))}
        </ErrorNotice>
      )}
      {moved && state.agent && effective && (
        <div className="flex flex-wrap items-center gap-3">
          <p>{m.otherChosen(agentName(a.names, effective), agentName(a.names, state.agent))}</p>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRun(effective)}>
            {a.runVia(agentName(a.names, effective))}
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
