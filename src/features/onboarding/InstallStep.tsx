import { Check, CheckCircle2, RefreshCw } from "lucide-react"
import { type ReactNode, useId, useState } from "react"
import { type CatalogTool, ownerId, tools } from "@/domain/catalog"
import { installOverview, installPhase, type RowPhase, restartCommand, toQueue } from "@/domain/onboarding-flow"
import { asksOwner, toolStatus } from "@/domain/status"
import { FixPanel } from "@/features/fix"
import { NodeNotice } from "@/features/system"
import {
  AlongsideLine,
  failureWords,
  InstallFailure,
  InstallProgress,
  installProblem,
  PreflightNotice,
  toolsMessages,
  useFailureMessages,
} from "@/features/tools"
import { useMessages } from "@/i18n"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSystem } from "@/shared/system-store"
import { ToolIcon } from "@/shared/ToolIcon"
import { useTools } from "@/shared/tools-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { MOTION, useLinger, usePaced } from "@/ui/motion"
import { InstallOverview, InstallTips } from "./InstallWait"
import { onboardingMessages } from "./messages"
import { rack, row } from "./step-styles"

/**
 * Queues the chosen tools that are not on the computer yet; the store runs them one by one. In the order the Install
 * step lists them, not the order they were ticked, so "1 of 3" is the tool at the top. Each asks the store check first,
 * as on the Tools page.
 */
export function installChosen() {
  const { chosen } = useOnboarding.getState()
  const st = useTools.getState()
  const ids = tools.filter((t) => chosen.includes(t.id)).map((t) => t.id)
  for (const id of toQueue(ids, st.installs, st.sessions)) st.install(id, { check: true })
}

/**
 * One tool's row. `shown` is its state as paced for the eye (`usePaced`): a tool that finished keeps its bar, full and
 * green, for a moment, and the next one waits that moment before its bar opens. The words and a failure follow the
 * real state at once.
 */
function Progress({ tool, shown }: { tool: CatalogTool; shown: RowPhase }) {
  const installs = useTools((s) => s.installs[tool.id])
  const session = useTools((s) => s.sessions[ownerId(tool.id)])
  const status = toolStatus(installs, undefined, session)
  const outcome = session?.outcome
  const m = useMessages(onboardingMessages).install
  const tm = useMessages(toolsMessages).install
  const fm = useFailureMessages()
  const [fixOpen, setFixOpen] = useState(false)
  const fixId = useId()
  const version = (v: string) => <span className="font-mono tabular-nums">{v}</span>

  let tone: LampTone = "idle"
  let text: ReactNode = m.notInstalled
  let detail: ReactNode = null
  const asks = Boolean(session && asksOwner(session))
  if (status.kind === "checking") text = m.checking
  else if (session?.step === "preflight") {
    tone = asks ? "warn" : "idle"
    text = asks ? m.asked : m.checking
  } else if (session && shown === "wait") text = m.queued
  else if (session && !outcome) {
    tone = session.step === "queued" ? "idle" : "busy"
    text = session.step === "queued" ? m.queued : m.step(tm.steps.install[session.step] ?? m.installing)
  } else if (outcome?.event === "failed" && session) {
    tone = "bad"
    const [message, next] = failureWords(outcome, session.operation, fm)
    text = <span className="text-bad">{m.notInstalledFailed}</span>
    detail = (
      <>
        <span className="block text-bad">{message}</span>
        {next && <span className="block text-ink-soft">{next}</span>}
      </>
    )
  } else if (outcome?.event === "done") {
    tone = "ok"
    text = m.installed(version(outcome.version))
  } else if (status.kind === "ready" || status.kind === "outdated") {
    tone = "ok"
    text = m.already(version(status.version))
  }

  // A failure is told at once; only a success holds its full bar for a moment, while the next row's bar opens.
  const running = Boolean(session) && shown === "run" && outcome?.event !== "failed"
  const installing = useLinger(running) && outcome?.event !== "failed"
  return (
    <li className={cx(row, "flex-wrap gap-y-0")}>
      <span className="relative grid shrink-0 place-items-center">
        <Lamp tone={tone} {...(typeof text === "string" ? { label: text } : {})} />
        {/* Only a tool installed in this flow: one that was already here has nothing to celebrate. */}
        {outcome?.event === "done" && (
          <Check
            aria-hidden
            strokeWidth={3.2}
            className="check-in pointer-events-none absolute size-[0.85rem] text-on-status"
          />
        )}
      </span>
      <ToolIcon id={tool.id} className="size-[1.5rem] shrink-0 text-ink" />
      <span className="w-[9rem] shrink-0 font-semibold">{tool.name}</span>
      <span aria-live="polite" className="min-w-0 flex-1 text-body text-ink-soft">
        {text}
      </span>
      {session && (
        <InstallFailure
          tool={tool}
          session={session}
          fix={{ open: fixOpen, id: fixId, toggle: () => setFixOpen((o) => !o) }}
        />
      )}
      {outcome?.event === "failed" && (
        <Button size="sm" onClick={() => useTools.getState().install(tool.id, { check: true })}>
          {m.tryAgain}
        </Button>
      )}
      {/* Collapse sizes to its content, so the full-width line is this wrapper's. */}
      <div className="basis-full">
        <Collapse open={installing}>
          {session && (
            <div className={cx("pt-[0.8rem] pb-[0.2rem] sm:pl-[3.8rem]", installing && "step-in")}>
              <InstallProgress session={session} compact />
              {!session.alongside && <AlongsideLine preflight={session.preflight} className="" />}
            </div>
          )}
        </Collapse>
        <Collapse open={asks}>
          {session && (
            <div className="pt-[0.8rem] pb-[0.2rem] sm:pl-[3.8rem]">
              <PreflightNotice tool={tool} preflight={session.preflight} focusAfter={nextControl} />
            </div>
          )}
        </Collapse>
        <Collapse open={detail !== null}>
          <p className="selectable max-w-[70ch] pt-[0.4rem] pb-[0.2rem] text-body sm:pl-[3.8rem]">{detail}</p>
        </Collapse>
        {outcome?.event === "failed" && session && (
          <div className="sm:pl-[3.8rem]">
            <FixPanel id={fixId} open={fixOpen} problem={installProblem(tool, session, outcome)} />
          </div>
        )}
      </div>
    </li>
  )
}

// Once the warning is answered, the row has no button of its own: "Install the rest" after Not now, else Continue.
const nextControl = () =>
  document.querySelector<HTMLElement>("[data-install-rest]") ?? document.querySelector<HTMLElement>("[data-setup-next]")

export function Install() {
  const chosen = useOnboarding((s) => s.chosen)
  const nodeReady = useSystem((s) => s.readiness?.node.ok ?? false)
  const pending = useTools((s) => installOverview(chosen, s.installs, s.sessions).pending)
  const allDone = useTools((s) => installOverview(chosen, s.installs, s.sessions).allDone)
  const settledWithOne = useTools((s) => installOverview(chosen, s.installs, s.sessions).settledWithOne)
  const list = tools.filter((t) => chosen.includes(t.id))
  const m = useMessages(onboardingMessages).install
  // Joined, so the store hands back one string that changes only when a row's state does.
  const phases = useTools((s) => list.map((t) => installPhase(s.sessions[ownerId(t.id)])).join(" "))
  const shown = usePaced(phases ? phases.split(" ") : []) as readonly RowPhase[]
  const settled = !shown.some((p) => p === "run" || p === "wait")

  if (list.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <p className="flex-1 text-body text-ink-soft">{m.none}</p>
        <Button size="sm" onClick={() => useOnboarding.getState().go("choose")}>
          {m.choose}
        </Button>
      </div>
    )
  }

  return (
    <>
      <NodeNotice />
      <InstallOverview chosen={list.map((t) => t.id)} />
      <ul aria-label={m.list} className={rack}>
        {list.map((t, i) => (
          <Progress key={t.id} tool={t} shown={shown[i] ?? "idle"} />
        ))}
      </ul>
      {pending && nodeReady && (
        <div>
          <Button size="sm" data-install-rest onClick={installChosen}>
            {m.rest}
          </Button>
        </div>
      )}
      <div aria-live="polite">
        <Crossfade swap={allDone && settled ? "done" : "note"} ms={MOTION.step}>
          <p className="flex min-h-[1.6rem] items-center gap-2 text-body">
            {allDone && settled ? (
              <>
                <CheckCircle2 className="check-in size-5 shrink-0 text-ok" aria-hidden />
                <span className="text-ink">
                  {m.allDone} {m.moreLater}
                </span>
              </>
            ) : (
              <span className="text-ink-soft">{m.note}</span>
            )}
          </p>
        </Crossfade>
      </div>
      <Collapse open={settledWithOne && settled}>
        <RestartNote chosen={list.map((t) => t.id)} />
      </Collapse>
      <InstallTips chosen={list.map((t) => t.id)} />
    </>
  )
}

/** Open apps keep the PATH they started with, which is why Codex can miss a tool that is installed and on PATH. */
function RestartNote({ chosen }: { chosen: readonly string[] }) {
  const w = useMessages(onboardingMessages).wait
  const manual = useTools((s) => restartCommand(chosen, s.sessions))
  return (
    <div className="flex flex-col gap-2 text-body text-ink-soft">
      <p className="flex items-start gap-2">
        <RefreshCw aria-hidden className="mt-[0.2rem] size-4 shrink-0" />
        {w.restart}
      </p>
      {manual && (
        <>
          <p>{w.manual}</p>
          <CopyField value={manual} label={w.manual} />
        </>
      )}
    </div>
  )
}
