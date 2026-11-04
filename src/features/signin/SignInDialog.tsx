import { Terminal } from "lucide-react"
import { useEffect, useRef } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { keyringFallback } from "@/domain/signin-notes"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { useTerminal } from "../tools/terminal-store"
import { type SigninMessages, signinMessages } from "./messages"
import { planMessages } from "./messages-plan"
import { Plan } from "./Plan"
import { Stage } from "./Stages"
import { NEEDS_UPDATE, type Phase, receivingHistory, running, useSignIn } from "./store"
import { KeyringNotice } from "./TelegramGuide"

/**
 * Signs a profile in with the tool's own sign-in, drawn in the window: a QR code, a code for the phone, a page to
 * open, the questions the tool asks, then its progress.
 */
export function SignInDialog() {
  const s = useSignIn()
  const m = useMessages(signinMessages)
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const body = useRef<HTMLDivElement>(null)
  const ended = !running(s.phase)
  const keyring = s.notes.map(keyringFallback).find((k) => k !== null) ?? null
  const notes = s.notes.filter((n) => keyringFallback(n) === null)

  // The button that had focus goes away when the sign-in ends; its replacement takes focus instead of the page.
  useEffect(() => {
    if (ended) body.current?.closest("dialog")?.querySelector<HTMLElement>("[data-autofocus]")?.focus()
  }, [ended])

  return (
    <Dialog open={s.tool !== null} wide scroll title={m.title(name)} onClose={s.close} actions={<Actions />}>
      <div ref={body} className="flex flex-col gap-3">
        <p>{m.intro(<code className="font-mono text-ink">{s.profile}</code>, name)}</p>
        {notes.length > 0 && (
          <p className="selectable rounded-[0.2rem] border border-warn/40 bg-warn/10 px-3 py-2 text-[0.9rem] leading-snug text-ink">
            {notes.join(" ")}
          </p>
        )}
        {keyring && <KeyringNotice fallback={keyring} />}
        {/* The plan slides away to the live sign-in in the same place (rule 9). */}
        <div key={s.phase === "plan" ? "plan" : "run"} className="step-in">
          {s.phase === "plan" ? <Plan /> : <Stage name={name} />}
        </div>
        <p role="status" className="sr-only">
          {announcement(m.announce, s.phase, s.codes, s.progress?.step === "waiting", s.stopping, s.need?.prompt)}
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
            <Button key={other.id} variant="ghost" onClick={() => useSignIn.setState({ method: other.id })}>
              {m.switchTo(other.id, other.label)}
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
              key={method.id}
              variant="ghost"
              onClick={() => start(tool, profile, onFinish ?? undefined, method.id)}
            >
              {m.switchTo(method.id, method.label)}
            </Button>
          ) : null,
        )}
        <Button variant="secondary" onClick={stop} disabled={stopping}>
          {stopping ? m.stopping : receivingHistory(s) ? m.stopKeep : m.cancel}
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
