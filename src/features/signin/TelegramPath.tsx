import { useId, useRef } from "react"
import { useMessages } from "@/i18n"
import { Crossfade } from "@/ui/Crossfade"
import { MOTION } from "@/ui/motion"
import { Stepper, type StepState } from "@/ui/Stepper"
import { telegramMessages } from "./messages-telegram"
import { isPassword, type SignInView } from "./Stages"

/** The step of the method's path the tool is on; null while it says nothing that places it (starting, checking). */
function stepOf(s: SignInView): number | null {
  const steps = s.method === "phone" ? ["phone", "code", "password"] : ["scan", "password"]
  if (s.phase === "scan") return steps.indexOf("scan")
  if (s.phase === "answer" && s.need) {
    const at = steps.indexOf(isPassword(s.need) ? "password" : s.need.field)
    return at === -1 ? null : at
  }
  if (s.phase === "done") return steps.length
  return null
}

/**
 * Which way in this is, and where on it the sign-in is. A switch fades one path into the other, so the change of
 * method is plain to see, not only the button's label.
 */
export function TelegramPath({ s }: { s: SignInView }) {
  const method = s.method ?? "qr"
  return (
    <Crossfade swap={method} ms={MOTION.swap}>
      <Path s={s} method={method} />
    </Crossfade>
  )
}

function Path({ s, method }: { s: SignInView; method: string }) {
  const tm = useMessages(telegramMessages)
  const id = useId()
  const labels = tm.path[method] ?? []
  // Between the tool's steps (an answer being checked, a stop) the last step it was on stays lit.
  const last = useRef({ run: s.run, at: -1 })
  const now = stepOf(s)
  if (last.current.run !== s.run) last.current = { run: s.run, at: -1 }
  if (now !== null) last.current.at = now
  const at = last.current.at
  const state = (i: number): StepState =>
    i < at ? "done" : i > at ? "todo" : s.phase === "failed" ? "failed" : "active"
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-[1.15rem] font-semibold text-ink">
        {tm.method[method]}
      </h3>
      <Stepper steps={labels.map((label, i) => ({ label, state: state(i) }))} />
    </section>
  )
}
