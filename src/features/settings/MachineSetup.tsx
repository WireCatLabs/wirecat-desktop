import { CheckCircle2 } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { findTool, tools } from "@/domain/catalog"
import { FixButton, FixPanel } from "@/features/fix"
import { useMessages } from "@/i18n"
import { type MachineChoices, shownChoices, useMachineSetup } from "@/shared/machine-setup-store"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { fieldClass } from "@/ui/field"
import { SectionTitle } from "@/ui/SectionTitle"
import { Switch } from "@/ui/Switch"
import { applyChoice, type Item, type Job, useMachineRuns } from "./machine-setup"
import { type MachineText, machineMessages } from "./messages-machine"

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

/** Serve is asked about only once a messenger that has one is installed or chosen. */
function useMessengerHere() {
  const installs = useTools((s) => s.installs)
  const chosen = useOnboarding((s) => s.chosen)
  return tools.some((t) => t.background && (installs[t.id]?.length || chosen.includes(t.id)))
}

type RowProps = {
  id: string
  label: string
  help: string
  checked: boolean
  onChange: (on: boolean) => void
  children?: ReactNode
}

function Row({ id, label, help, checked, onChange, children }: RowProps) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Switch id={id} checked={checked} onChange={onChange} aria-describedby={`${id}-help`} className="mt-[0.15rem]" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <p id={`${id}-help`} className="max-w-[60ch] text-[0.9rem] text-ink-soft">
          {help}
        </p>
        {children}
      </div>
    </li>
  )
}

function TimeField({ value, onCommit, m }: { value: string; onCommit: (time: string) => void; m: MachineText }) {
  const id = useId()
  const [typed, setTyped] = useState(value)
  useEffect(() => setTyped(value), [value])
  const time = useFieldError(id, { live: { problem: CLOCK.test(typed) ? null : m.timeInvalid } })
  const commit = () => {
    if (!CLOCK.test(typed)) return time.fail()
    if (typed !== value) onCommit(typed)
  }
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 pt-1">
        <label htmlFor={id} className="text-[0.9rem]">
          {m.time}
        </label>
        <div className="w-[8.5rem]">
          <input
            id={id}
            type="time"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className={fieldClass}
            {...time.field}
          />
        </div>
      </div>
      {time.hint}
    </div>
  )
}

/**
 * The three questions about what WireCat does by itself. On the first setup screen (`applied` false) the answers are
 * only kept, since no account exists yet; in Settings and on the last setup step each change applies at once.
 */
export function MachineChoicesList({ applied }: { applied: boolean }) {
  const m = useMessages(machineMessages)
  const stored = useMachineSetup()
  const autostart = useMachineRuns((s) => s.autostart)
  const messengers = useMessengerHere()
  const ids = { atLogin: useId(), nightly: useId(), live: useId() }
  const shown = applied ? shownChoices(stored) : stored
  const atLogin = applied ? (autostart.on ?? stored.atLogin) : stored.atLogin

  useEffect(() => {
    if (applied) void useMachineRuns.getState().readAutostart()
  }, [applied])

  const change = (job: Job | null, patch: Partial<MachineChoices>) => {
    if (!applied) return stored.choose(patch)
    stored.settle(patch)
    if (job) void applyChoice(job, useMachineSetup.getState())
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="divide-y divide-line overflow-hidden rounded-inset border border-line bg-app">
        <Row
          id={ids.atLogin}
          label={m.atLogin}
          help={m.atLoginHelp}
          checked={atLogin}
          onChange={(on) => {
            change(null, { atLogin: on })
            if (applied) void useMachineRuns.getState().setAutostart(on)
          }}
        >
          <Collapse open={applied && autostart.error !== null}>
            <ErrorNotice inline raw={autostart.error}>
              {m.atLoginFailed}
            </ErrorNotice>
          </Collapse>
        </Row>
        <Row
          id={ids.nightly}
          label={m.nightly}
          help={m.nightlyHelp}
          checked={shown.nightly}
          onChange={(on) => change("nightly", { nightly: on })}
        >
          <Collapse open={shown.nightly}>
            <TimeField value={shown.time} m={m} onCommit={(time) => change("nightly", { time })} />
          </Collapse>
        </Row>
        {messengers && (
          <Row
            id={ids.live}
            label={m.live}
            help={m.liveHelp}
            checked={shown.live}
            onChange={(on) => change("live", { live: on })}
          />
        )}
      </ul>
      {applied && <Results />}
    </div>
  )
}

/** What applying the choices did to each account, kept until the app closes. */
function Results() {
  const m = useMessages(machineMessages)
  const items = Object.values(useMachineRuns((s) => s.items))
  return (
    <Collapse open={items.length > 0}>
      <section aria-label={m.results} className="flex flex-col gap-1 pt-2">
        <h4 className="text-[0.95rem] font-semibold">{m.results}</h4>
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <ResultRow key={`${i.job}:${i.tool}:${i.profile}`} item={i} m={m} />
          ))}
        </ul>
      </section>
    </Collapse>
  )
}

function ResultRow({ item, m }: { item: Item; m: MachineText }) {
  const fixId = useId()
  const [fixOpen, setFixOpen] = useState(false)
  const name = findTool(item.tool)?.name ?? item.tool
  const account = `${name} ${item.profile}`
  const { step } = item
  const test = item.job === "nightly"
  return (
    <li className="flex flex-col gap-1 text-[0.9rem]">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="font-medium">{m.job[item.job](account)}</span>
        <span role="status" className="flex items-center gap-1 text-ink-soft">
          {step.phase === "done" && <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />}
          {step.phase === "working"
            ? m.step.working
            : step.phase === "testing"
              ? m.step.testing
              : step.phase === "done"
                ? step.tested
                  ? m.step.tested
                  : m.step.done
                : step.phase === "kept"
                  ? m.step.kept(step.when)
                  : null}
        </span>
      </p>
      {step.phase === "failed" && (
        <>
          <ErrorNotice
            inline
            raw={[step.error, step.log].filter(Boolean).join("\n\n")}
            action={<FixButton open={fixOpen} controls={fixId} onClick={() => setFixOpen((o) => !o)} />}
          >
            {step.reason !== null || step.log !== null ? m.step.testFailed : m.step.failed}
          </ErrorNotice>
          <FixPanel
            id={fixId}
            open={fixOpen}
            problem={{
              what: test
                ? `Running the daily sync schedule of ${name} account ${item.profile} once as a test (schedule run)`
                : `Keeping ${name} account ${item.profile} running in the background and starting at login (server install)`,
              error: step.error,
              hint: null,
              log: step.log ? step.log.split("\n") : [],
            }}
          />
        </>
      )}
    </li>
  )
}

/** The block near the top of Settings. */
export function MachineSetting() {
  const m = useMessages(machineMessages)
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <SectionTitle as="h3" id={id}>
          {m.title}
        </SectionTitle>
        <p className="mt-1 max-w-[60ch] text-[0.9rem] text-ink-soft">{m.intro}</p>
      </div>
      <MachineChoicesList applied />
    </section>
  )
}
