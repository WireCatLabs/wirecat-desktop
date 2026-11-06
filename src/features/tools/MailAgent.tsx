import { ExternalLink } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { dailyCap, formatUsd, type RunOutcome, runOutcome } from "@/domain/mail-agent"
import { useLang, useMessages } from "@/i18n"
import type { Skipped, MailAgent as State } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { Skeleton } from "@/ui/Skeleton"
import { Switch } from "@/ui/Switch"
import { ago } from "./connect-steps"
import { openTool } from "./go"
import { type MailAgentText, mailAgentMessages } from "./messages-mail-agent"

const TONE: Record<RunOutcome, LampTone> = { ok: "ok", skipped: "warn", failed: "bad" }

type Pending = { on: boolean } | null
type Failure = { on: boolean | null; message: string } | null

const skipWhy = (m: MailAgentText, { reason, why }: Skipped) =>
  (reason && Object.hasOwn(m.skipReasons, reason) ? m.skipReasons[reason] : undefined) ?? why

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * memo's mail agent for Email: the switch is memo's own `schedule agent` and `schedule remove`, so the timer it
 * writes (systemd, launchd or Task Scheduler) is memo's, and so are the words when it refuses.
 */
export function MailAgent({ tool }: { tool: CatalogTool }) {
  const m = useMessages(mailAgentMessages)
  const headingId = useId()
  const switchId = useId()
  const helpId = useId()
  const [state, setState] = useState<State | null>(null)
  const [waiting, setWaiting] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [failure, setFailure] = useState<Failure>(null)

  const loadWaiting = useCallback(() => {
    platform.mailAgentWaiting(tool.id).then(setWaiting, () => setWaiting(null))
  }, [tool.id])

  useEffect(() => {
    let live = true
    platform.mailAgentStatus(tool.id).then(
      (s) => live && setState(s),
      (e) => live && setFailure({ on: null, message: messageOf(e) }),
    )
    loadWaiting()
    return () => {
      live = false
    }
  }, [tool.id, loadWaiting])

  const change = (on: boolean) => {
    setPending({ on })
    setFailure(null)
    platform.mailAgentSet(tool.id, on).then(
      (s) => {
        setState(s)
        setPending(null)
        loadWaiting()
      },
      (e) => {
        setPending(null)
        setFailure({ on, message: messageOf(e) })
      },
    )
  }

  const on = pending ? pending.on : state?.state === "on"
  const usable = state?.state === "on" || (state?.state === "off" && state.harness)
  return (
    <section
      aria-labelledby={headingId}
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
            <Switch
              id={switchId}
              checked={on}
              disabled={pending !== null || !usable}
              aria-describedby={helpId}
              onChange={change}
            />
            <label htmlFor={switchId} className="font-medium">
              {m.toggle}
            </label>
            {pending && (
              <span className="text-[0.9rem] text-ink-dim" aria-live="polite">
                {pending.on ? m.turningOn : m.turningOff}
              </span>
            )}
          </div>
          <p id={helpId} className="text-[0.875rem] text-ink-dim">
            {m.toggleHelp}
          </p>
        </div>
      )}
      <Collapse open={state?.state === "off" && !state.harness}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.9rem] text-ink-soft">{m.noHarness}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => platform.openUrl("https://claude.com/claude-code")}
            icon={<ExternalLink className="size-4" aria-hidden />}
          >
            {m.aboutClaude}
          </Button>
        </div>
      </Collapse>
      <Collapse open={state?.state === "on"}>{state?.state === "on" && <Status state={state} m={m} />}</Collapse>
      <Collapse open={failure !== null}>
        <ErrorNotice inline>
          {failure &&
            (failure.on === null
              ? m.readFailed(failure.message)
              : failure.on
                ? m.failedOn(failure.message)
                : m.failedOff(failure.message))}
        </ErrorNotice>
      </Collapse>
      <Collapse open={waiting !== null}>
        <Waiting count={waiting} m={m} />
      </Collapse>
    </section>
  )
}

function Status({ state, m }: { state: Extract<State, { state: "on" }>; m: MailAgentText }) {
  const lang = useLang()
  const { last, spentTodayUsd } = state
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
