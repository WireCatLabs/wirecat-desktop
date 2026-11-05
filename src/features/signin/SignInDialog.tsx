import { Terminal } from "lucide-react"
import { type ReactNode, useEffect, useRef } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { keyringFallback } from "@/domain/signin-notes"
import { telegramNote } from "@/domain/telegram-signin"
import { useMessages } from "@/i18n"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { Dialog } from "@/ui/Dialog"
import { useTerminal } from "../tools/terminal-store"
import { type SigninMessages, signinMessages } from "./messages"
import { planMessages } from "./messages-plan"
import { telegramMessages } from "./messages-telegram"
import { Plan } from "./Plan"
import { Stage, stageKey } from "./Stages"
import { NEEDS_UPDATE, type Phase, receivingHistory, running, useSignIn } from "./store"
import { KeyringNotice } from "./TelegramGuide"
import { TelegramPath } from "./TelegramPath"

/**
 * Signs a profile in with the tool's own sign-in, drawn in the window: a QR code, a code for the phone, a page to
 * open, the questions the tool asks, then its progress.
 */
export function SignInDialog() {
  const s = useSignIn()
  const m = useMessages(signinMessages)
  const tm = useMessages(telegramMessages)
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const body = useRef<HTMLDivElement>(null)
  const ended = !running(s.phase)
  const keyring = s.notes.map(keyringFallback).find((k) => k !== null) ?? null
  // tg's words about the login code are said beside the code's field instead.
  const notes = s.notes.filter((n) => keyringFallback(n) === null && (s.tool !== "tg" || telegramNote(n) === null))
  const key = stageKey(s)

  // The button that had focus goes away when the sign-in ends; its replacement takes focus instead of the page.
  useEffect(() => {
    if (ended) body.current?.closest("dialog")?.querySelector<HTMLElement>("[data-autofocus]")?.focus()
  }, [ended])

  return (
    <Dialog open={s.tool !== null} wide="xl" scroll title={m.title(name)} onClose={s.close} actions={<Actions />}>
      <div ref={body} className="flex flex-col gap-3 text-[1rem]">
        <p>{m.intro(<code className="font-mono text-ink">{s.profile}</code>, name)}</p>
        <Collapse open={notes.length > 0}>
          <p className="selectable rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2 text-[0.95rem] leading-snug text-ink">
            {notes.join(" ")}
          </p>
        </Collapse>
        <Collapse open={keyring !== null}>{keyring && <KeyringNotice fallback={keyring} />}</Collapse>
        {/* The plan lists the same path in full; once tg runs, this says which way in it is and where. */}
        <Collapse open={s.tool === "tg" && s.phase !== "plan"}>
          <TelegramPath s={s} />
        </Collapse>
        {/* One step fades into the next in the same place, and the box follows its height (rule 9). */}
        <AutoHeight swap={key}>
          <Crossfade swap={key}>{s.phase === "plan" ? <Plan /> : <Stage name={name} s={s} />}</Crossfade>
        </AutoHeight>
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
  const { stop, close, start, tool, profile, onFinish, phase, stopping, method } = s
  const entry = tool ? findTool(tool) : undefined
  const others = entry ? signInMethods(entry).filter((m) => m.id !== method) : []
  if (phase === "plan") {
    return (
      <>
        {others.map((other) =>
          tool && profile ? (
            <Button key="switch" variant="ghost" onClick={() => useSignIn.setState({ method: other.id })}>
              <SwitchLabel id={other.id} label={other.label} />
            </Button>
          ) : null,
        )}
        <Button variant="secondary" onClick={close}>
          {m.cancel}
        </Button>
        <Button variant="primary" onClick={s.begin} data-autofocus>
          {pm.start}
        </Button>
      </>
    )
  }
  if (running(phase)) {
    return (
      <>
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
    // A tool too old to sign in here still signs in at a terminal.
    const terminal = s.failure?.code === NEEDS_UPDATE && tool && profile && entry?.setup
    return (
      <>
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
        <Button variant="secondary" onClick={s.again} data-autofocus>
          {m.tryAgain}
        </Button>
      </>
    )
  }
  return (
    <Button variant="primary" onClick={close} data-autofocus>
      {m.done}
    </Button>
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
