import { useId, useRef } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { zoomNeedsClientId } from "@/domain/signin-failure"
import { useMessages } from "@/i18n"
import { APP_KEYS } from "@/shared/signin-store"
import { Crossfade } from "@/ui/Crossfade"
import { MOTION } from "@/ui/motion"
import { Stepper, type StepState } from "@/ui/Stepper"
import { wizardMessages } from "./messages-wizard"
import { isKeys, isPassword, type SignInView } from "./Stages"
import { type WizardStep, wizardPath } from "./wizard"

/** The step the window shows; null while the tool says nothing that places it (starting, checking an answer). */
function stepOf(s: SignInView, path: WizardStep[]): WizardStep | null {
  if (s.phase === "plan") return "intro"
  if (isKeys(s)) return "keys"
  if (s.phase === "failed" && s.tool && s.failure && zoomNeedsClientId(s.tool, s.failure.message)) return "app"
  if (s.phase === "scan" || s.phase === "pair") return "scan"
  if (s.phase === "browser") return "browser"
  if (s.phase === "answer" && s.need) {
    if (APP_KEYS.has(s.need.field)) return "keys"
    if (isPassword(s.need)) return path.includes("password") ? "password" : null
    if (s.need.field === "redirect") return "browser"
    const field = s.need.field as WizardStep
    return path.includes(field) ? field : null
  }
  if (s.phase === "progress" && s.progress) {
    if (s.progress.step === "history" || s.progress.step === "waiting") return "history"
    if (s.progress.step === "check" && path.includes("check")) return "check"
  }
  if (s.phase === "done") return "done"
  return null
}

/**
 * The whole way in, from what the owner needs at hand to the end, and where on it the sign-in is. A switch of method
 * fades one path into the other, so the change is plain to see, not only the button's label.
 */
export function SignInPath({ s }: { s: SignInView }) {
  const method = s.method ?? ""
  return (
    <Crossfade swap={method} ms={MOTION.swap}>
      <Path s={s} />
    </Crossfade>
  )
}

function Path({ s }: { s: SignInView }) {
  const m = useMessages(wizardMessages)
  const id = useId()
  const tool = s.tool ? findTool(s.tool) : undefined
  const name = tool?.name ?? s.tool ?? ""
  const path = wizardPath(s.tool ?? "", s.method)
  // Between the tool's steps (an answer being checked, a stop) the last step it was on stays lit; once it runs, the
  // intro is behind it.
  const last = useRef({ run: s.run, at: 0 })
  if (last.current.run !== s.run) last.current = { run: s.run, at: 0 }
  const now = stepOf(s, path)
  last.current.at = s.phase === "plan" ? 0 : Math.max(last.current.at, now ? path.indexOf(now) : -1, 1)
  const at = last.current.at
  const done = s.phase === "done"
  const state = (i: number): StepState =>
    done || i < at ? "done" : i > at ? "todo" : s.phase === "failed" && now !== "app" ? "failed" : "active"
  // A method is named only where there is another to switch to; the plan names it in its own heading.
  const named = tool && !tool.signIn?.pick && signInMethods(tool).length > 1 && s.phase !== "plan"
  return (
    <section aria-labelledby={named ? id : undefined} aria-label={named ? undefined : m.progress(at + 1, path.length)}>
      {named && (
        <h3 id={id} className="mb-3 text-[1.15rem] font-semibold text-ink">
          {m.method[s.method ?? ""]}
        </h3>
      )}
      <Stepper steps={path.map((step, i) => ({ label: m.steps[step](name), state: state(i) }))} />
    </section>
  )
}
