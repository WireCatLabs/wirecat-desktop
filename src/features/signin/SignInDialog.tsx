import { Bot, Terminal } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { readMailNotes } from "@/domain/mail-signin"
import { keyringFallback } from "@/domain/signin-notes"
import { telegramNote } from "@/domain/telegram-signin"
import { useTerminal } from "@/features/tools"
import { useMessages } from "@/i18n"
import { useBotSignIn } from "@/shared/bot-signin-store"
import { botMessages } from "@/shared/messages-bot"
import {
  BITRIX,
  guidedProvider,
  NEEDS_UPDATE,
  type Phase,
  receivingHistory,
  running,
  useSignIn,
} from "@/shared/signin-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { BackButton } from "@/ui/BackButton"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { MOTION } from "@/ui/motion"
import { noticeBox } from "@/ui/notice"
import { explainView } from "./Failure"
import { type SigninMessages, signinMessages } from "./messages"
import { bitrixMessages } from "./messages-bitrix"
import { mailMessages } from "./messages-mail"
import { planMessages } from "./messages-plan"
import { telegramMessages } from "./messages-telegram"
import { wizardMessages } from "./messages-wizard"
import { Plan } from "./Plan"
import { SignInPath } from "./SignInPath"
import { checksInPlan, type SignInView, Stage, stageKey } from "./Stages"
import { KeyringNotice } from "./TelegramGuide"

/**
 * Signs a profile in with the tool's own sign-in, drawn in the window: a QR code, a code for the phone, a page to
 * open, the questions the tool asks, then its progress.
 */
export function SignInDialog() {
  const live = useSignIn()
  const s = useHeldSwitch(live)
  const m = useMessages(signinMessages)
  const tm = useMessages(telegramMessages)
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const body = useRef<HTMLDivElement>(null)
  const ended = !running(s.phase)
  const keyring = s.notes.map(keyringFallback).find((k) => k !== null) ?? null
  // tg's words about the login code are said beside the code's field instead, and mail's steps for the mailbox beside
  // the password.
  const said = s.tool === "email" ? readMailNotes(s.notes).other : s.notes
  const notes = said.filter((n) => keyringFallback(n) === null && (s.tool !== "tg" || telegramNote(n) === null))
  const key = stageKey(s)

  // The button that had focus goes away when the sign-in ends; its replacement takes focus instead of the page.
  useEffect(() => {
    if (ended) body.current?.closest("dialog")?.querySelector<HTMLElement>("[data-autofocus]")?.focus()
  }, [ended])

  return (
    <Dialog open={live.tool !== null} wide="xl" scroll title={m.title(name)} onClose={live.close} actions={<Actions />}>
      <div ref={body} className="flex flex-col gap-3 text-[1.1rem]">
        <p>{m.intro(<code className="font-mono text-ink">{s.profile}</code>, name)}</p>
        <Collapse open={notes.length > 0}>
          <p className={cx("selectable text-body leading-snug text-ink", noticeBox("warn"))}>{notes.join(" ")}</p>
        </Collapse>
        <Collapse open={keyring !== null}>{keyring && <KeyringNotice fallback={keyring} />}</Collapse>
        {/* The whole way in with the current step lit: beside the step on wide windows, over it on narrow ones. */}
        <div className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8">
          <div className="md:self-start">
            <SignInPath s={s} />
          </div>
          {/* One step fades into the next in the same place, and the box follows its height (rule 9). */}
          <AutoHeight swap={key}>
            <Crossfade swap={key} ms={MOTION.swap}>
              {s.phase === "plan" || checksInPlan(s) ? <Plan /> : <Stage name={name} s={s} />}
            </Crossfade>
          </AutoHeight>
        </div>
        <p role="status" className="sr-only">
          {s.phase === "starting" && s.switchingTo
            ? tm.switching[s.switchingTo]
            : s.phase === "scan" && s.scannedAt !== null
              ? m.announce.scanned
              : announcement(m.announce, s.phase, s.codes, s.progress?.step === "waiting", s.stopping, s.need?.prompt)}
        </p>
      </div>
    </Dialog>
  )
}

/**
 * A switch of method says "Switching to…" long enough to read, even when the tool answers at once: until `hold` has
 * passed, the dialog keeps drawing the switching moment. Only the picture waits; the tool's next step is already in the
 * store, and a failure or a close is shown at once.
 */
function useHeldSwitch(s: SignInView): SignInView {
  const held = useRef<{ view: SignInView; until: number } | null>(null)
  const [, redraw] = useState(0)
  // On the keys step the switch keeps the keys on screen and says nothing, so there is nothing to read.
  if (s.phase === "starting" && s.switchingTo && stageKey(s) === "starting") {
    if (held.current?.view.run !== s.run) held.current = { view: s, until: Date.now() + MOTION.hold }
    else held.current.view = s
  }
  const h = held.current
  const wait = h && h.view.run === s.run && s.tool !== null && running(s.phase) ? h.until - Date.now() : 0
  const holding = wait > 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: one timer per held switch, not one per redraw
  useEffect(() => {
    if (!holding) return
    const t = setTimeout(() => redraw((n) => n + 1), wait)
    return () => clearTimeout(t)
  }, [holding])
  return holding && h ? h.view : s
}

function announcement(
  m: SigninMessages["announce"],
  phase: Phase,
  codes: number,
  slow: boolean,
  stopping: boolean,
  prompt?: string,
) {
  if (stopping) return m.stopping
  if (phase === "scan") return codes === 1 ? m.qrReady : ""
  if (phase === "pair") return m.pairReady
  if (phase === "browser") return m.browser
  if (phase === "answer") return prompt ? m.asks(prompt) : ""
  if (phase === "progress") return slow ? m.slow : m.working
  if (phase === "done") return m.done
  return ""
}

function Actions() {
  const s = useSignIn()
  const m = useMessages(signinMessages)
  const pm = useMessages(planMessages)
  const wm = useMessages(wizardMessages)
  const bm = useMessages(botMessages)
  const mm = useMessages(mailMessages)
  const { stop, close, start, tool, profile, onFinish, phase, stopping, method } = s
  const entry = tool ? findTool(tool) : undefined
  // A provider is chosen in the plan itself, never switched to in the middle of a sign-in.
  const others = entry && !entry.signIn?.pick ? signInMethods(entry).filter((m) => m.id !== method) : []
  if (phase === "plan" && tool === BITRIX) return <BitrixActions />
  if (phase === "plan") {
    const guided = guidedProvider(s) !== null
    if (guided && s.planStep === "password")
      return (
        <>
          <BackButton onClick={() => useSignIn.setState({ planStep: "choose", planMissing: null })} />
          <Button variant="secondary" onClick={close}>
            {m.cancel}
          </Button>
          <Button variant="primary" onClick={s.begin}>
            {mm.signIn}
          </Button>
        </>
      )
    return (
      <>
        {others.map((other) =>
          tool && profile ? (
            <Button key="switch" variant="ghost" onClick={() => useSignIn.setState({ method: other.id })}>
              <SwitchLabel id={other.id} label={other.label} />
            </Button>
          ) : null,
        )}
        {entry?.bot && tool && (
          <Button
            variant="ghost"
            icon={<Bot className="size-4" aria-hidden />}
            onClick={() => {
              close()
              useBotSignIn.getState().open(tool)
            }}
          >
            {bm.botInstead}
          </Button>
        )}
        <Button variant="secondary" onClick={close}>
          {m.cancel}
        </Button>
        <Button variant="primary" onClick={s.begin} data-autofocus>
          {guided ? mm.next : pm.start}
        </Button>
      </>
    )
  }
  if (running(phase)) {
    const reason = receivingHistory(s) ? m.back.history : phase === "progress" || stopping ? m.back.busy : undefined
    return (
      <>
        <BackButton onClick={s.toPlan} reason={reason} stops={m.back.stops} />
        {others.map((method) =>
          tool && profile && phase !== "progress" ? (
            <Button
              key="switch"
              variant="ghost"
              onClick={() => start(tool, profile, onFinish ?? undefined, method.id, true)}
            >
              <SwitchLabel id={method.id} label={method.label} />
            </Button>
          ) : null,
        )}
        {/* Cancel closes at once; only "Stop and keep" waits, to say what the phone sent before the stop. */}
        <Button variant="secondary" onClick={receivingHistory(s) ? stop : close} disabled={stopping}>
          <Steady
            shown={stopping ? m.stopping : receivingHistory(s) ? m.stopKeep : m.cancel}
            others={[m.cancel, m.stopping]}
          />
        </Button>
      </>
    )
  }
  if (phase === "failed") {
    const explained = explainView(s)
    // A tool too old to sign in here still signs in at a terminal.
    const terminal = s.failure?.code === NEEDS_UPDATE && tool && profile && entry?.setup
    return (
      <>
        <BackButton onClick={s.toPlan} />
        <Button variant="ghost" onClick={close}>
          {m.close}
        </Button>
        {terminal && (
          <Button
            variant="secondary"
            icon={<Terminal className="size-4" aria-hidden />}
            onClick={() => {
              // The tool's details page under the dialog says whether the terminal opened, and what to do next.
              useTerminal.getState().open(tool, profile)
              close()
            }}
          >
            {m.openTerminal}
          </Button>
        )}
        {/* With a provider to pick, the address or password may be what was wrong: back to the plan to change them. */}
        {/* Zoom's missing app has its own Save and sign in; a bare retry would fail the same way. */}
        {explained?.reason !== "clientIdMissing" && (
          <Button
            variant="secondary"
            onClick={entry?.signIn?.pick ? () => useSignIn.setState({ phase: "plan", failure: null }) : s.again}
            data-autofocus
          >
            {explained?.reason === "qrExpired" ? wm.actions.newCode : m.tryAgain}
          </Button>
        )}
      </>
    )
  }
  return (
    <Button variant="primary" onClick={close} data-autofocus>
      {m.done}
    </Button>
  )
}

const BITRIX_BACK = { webhook: "choose", paste: "webhook", app: "choose" } as const

/** Bitrix24's own steps: Back to the one before, and the next, which checks the webhook or signs in with the app. */
function BitrixActions() {
  const { planStep, comparing, webhookProblem, appProblem, close, begin } = useSignIn()
  const m = useMessages(signinMessages)
  const mm = useMessages(mailMessages)
  const bm = useMessages(bitrixMessages)
  const back = planStep === "webhook" || planStep === "paste" || planStep === "app" ? BITRIX_BACK[planStep] : null
  const label =
    planStep === "paste"
      ? webhookProblem
        ? bm.paste.checkAgain
        : bm.paste.check
      : planStep === "app"
        ? appProblem
          ? bm.app.again
          : bm.app.signIn
        : mm.next
  return (
    <>
      {back && (
        <BackButton
          onClick={() =>
            useSignIn.setState({ planStep: back, planMissing: null, webhookProblem: null, appProblem: null })
          }
          reason={comparing ? m.back.busy : undefined}
        />
      )}
      <Button variant="secondary" onClick={close}>
        {m.cancel}
      </Button>
      <Button variant="primary" onClick={begin} disabled={comparing} busy={comparing}>
        {label}
      </Button>
    </>
  )
}

/** The other way in; after a switch the label fades to the way back, in the button's place. */
function SwitchLabel({ id, label }: { id: string; label: string }) {
  const m = useMessages(signinMessages)
  return (
    <Crossfade swap={id} className="inline-grid">
      {m.switchTo(id, label)}
    </Crossfade>
  )
}

/** A label that changes in place ("Cancel", then "Stopping…") at the width of the widest, so the button keeps its size. */
function Steady({ shown, others }: { shown: ReactNode; others: string[] }) {
  return (
    <span className="inline-grid">
      <span className="[grid-area:1/1]">{shown}</span>
      {others.map((o) => (
        <span key={o} aria-hidden className="invisible [grid-area:1/1]">
          {o}
        </span>
      ))}
    </span>
  )
}
