import { useEffect, useId, useState } from "react"
import { type CatalogTool, syncSchedules } from "@/domain/catalog"
import { type AdviceKind, advice } from "@/domain/sync"
import { useLang, useMessages } from "@/i18n"
import type { ScheduleRun } from "@/platform/bindings"
import { signedInSince, useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Select } from "@/ui/Select"
import { ago } from "./connect-steps"
import { syncMessages } from "./messages-sync"
import { type SyncScheduleText, syncScheduleMessages } from "./messages-sync-schedule"
import { SignInLost } from "./SignInLost"
import { syncKey, useSync } from "./sync-store"

/** The schedule is read again this often while the row shows, so a later timed run clears an old failure. */
export const SCHEDULE_READ_EVERY_MS = 2 * 60_000

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** The run's failure as the sync's own words: `reason` is an error code or a reason id, never for reading. */
const failureOf = (reason: string | null) => advice({ message: "", code: reason, reason, run: null })

function lastWords(last: ScheduleRun | null, m: SyncScheduleText, why: Record<AdviceKind, string>): string {
  if (!last) return m.noRunYet
  if (last.exitCode === 0) return m.lastOk(ago(last.at))
  const kind = failureOf(last.reason).kind
  return m.lastFailed(ago(last.at), kind === "failed" ? null : why[kind])
}

/**
 * An account's sync on a timer: the tool's own `schedule command`, which writes the timer. One line says whether it
 * runs and how its latest run went; Change opens the interval and Turn off under it, without leaving the row.
 */
export function SyncSchedule({ tool, profile }: { tool: CatalogTool; profile: string }) {
  const m = useMessages(syncScheduleMessages)
  const why = useMessages(syncMessages).sync.advice
  const lang = useLang()
  const selectId = useId()
  const key = syncKey(tool.id, profile)
  const schedule = useSync((s) => s.schedules[key])
  const run = useSync((s) => s.runs[key])
  const signedInAt = useSignIn((s) => s.signedInAt)
  const [open, setOpen] = useState(false)
  const [every, setEvery] = useState(tool.sync?.schedule?.every ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const read = () => void useSync.getState().loadSchedule(tool.id, profile)
    read()
    const timer = setInterval(read, SCHEDULE_READ_EVERY_MS)
    return () => clearInterval(timer)
  }, [tool.id, profile])

  if (!syncSchedules(tool) || schedule === undefined) return null
  const choices = tool.sync?.schedule?.choices ?? []
  const on = schedule?.state === "on" ? schedule : null
  const last = on?.last ?? null
  const failing = last && last.exitCode !== 0 ? last : null
  const lost =
    failing &&
    failureOf(failing.reason).kind === "signedOut" &&
    !signedInSince({ signedInAt }, tool.id, profile, Date.parse(failing.at)) &&
    !(run?.phase === "failed" && run.failure && advice(run.failure).kind === "signedOut")

  const change = (next: string | null) => {
    setSaving(true)
    setError(null)
    useSync
      .getState()
      .setSchedule(tool.id, profile, next)
      .then(
        () => {
          setSaving(false)
          setOpen(false)
        },
        (e) => {
          setSaving(false)
          setError(messageOf(e))
        },
      )
  }
  const openPanel = () => {
    setEvery(on?.every ?? tool.sync?.schedule?.every ?? choices[0] ?? "")
    setError(null)
    setOpen(true)
  }

  return (
    <section aria-label={m.region(`${tool.name} ${profile}`)} className="flex flex-col gap-1">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.875rem] text-ink-dim">
        {schedule === null ? (
          <span>{m.readFailed}</span>
        ) : on ? (
          <span className="flex min-w-0 items-center gap-2">
            <Lamp tone={failing ? "bad" : last ? "ok" : "idle"} size="sm" />
            <span>
              {on.every ? m.on(m.duration(on.every)) : m.onWhen(on.when)} · {lastWords(last, m, why)}
            </span>
          </span>
        ) : null}
        {!open && schedule !== null && (
          <Button size="sm" variant="secondary" onClick={openPanel}>
            {on ? m.change : m.setUp}
          </Button>
        )}
      </p>
      {lost && <SignInLost tool={tool} profile={profile} inline />}
      {failing?.failingSince && (
        <p className="text-[0.875rem] text-bad">
          {m.failingSince(
            new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(
              Date.parse(failing.failingSince),
            ),
            failing.failures,
          )}
        </p>
      )}
      <Collapse open={open}>
        <div className="flex flex-col gap-2 rounded-[0.3rem] border border-line bg-app-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={selectId} className="text-[0.9rem] font-medium">
              {m.every}
            </label>
            <Select
              id={selectId}
              size="sm"
              value={every}
              onChange={setEvery}
              options={choices.map((c) => ({ value: c, label: m.duration(c) }))}
            />
            <Button size="sm" variant="primary" disabled={saving} onClick={() => change(every)}>
              {saving ? m.saving : on ? m.save : m.turnOn}
            </Button>
            {on && (
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => change(null)}>
                {m.turnOff}
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={saving} onClick={() => setOpen(false)}>
              {m.cancel}
            </Button>
          </div>
          <p className="text-[0.85rem] text-ink-dim">{m.hint(tool.name)}</p>
          <Collapse open={error !== null}>
            <ErrorNotice inline raw={error}>
              {error && m.failed}
            </ErrorNotice>
          </Collapse>
        </div>
      </Collapse>
    </section>
  )
}
