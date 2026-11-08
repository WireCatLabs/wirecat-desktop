import { useEffect, useId, useRef, useState } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { zoomNeedsClientId } from "@/domain/signin-failure"
import { useMessages } from "@/i18n"
import { APP_KEYS } from "@/shared/signin-store"
import { Collapse } from "@/ui/Collapse"
import { Crossfade } from "@/ui/Crossfade"
import { MOTION } from "@/ui/motion"
import { Stepper, type StepState } from "@/ui/Stepper"
import { wizardMessages } from "./messages-wizard"
import { isKeys, isPassword, type SignInView } from "./Stages"
import { MAIL_SERVER_FIELDS, routeOf, type WizardStep, wizardPath } from "./wizard"

/** The step the window shows; null while the tool says nothing that places it (starting, checking an answer). */
function stepOf(s: SignInView, path: WizardStep[]): WizardStep | null {
  if (s.phase === "plan") return s.planStep === "password" && path.includes("appPassword") ? "appPassword" : "intro"
  if (isKeys(s)) return "keys"
  if (s.phase === "failed" && s.tool && s.failure && zoomNeedsClientId(s.tool, s.failure.message, s.failure.reason))
    return "app"
  if (s.phase === "pair" && path.includes("pair")) return "pair"
  if (s.phase === "scan" || s.phase === "pair") return "scan"
  if (s.phase === "browser") return "browser"
  if (s.phase === "answer" && s.need) {
    if (APP_KEYS.has(s.need.field)) return "keys"
    if (isPassword(s.need))
      return path.includes("appPassword") ? "appPassword" : path.includes("password") ? "password" : null
    if (s.need.field === "redirect") return "browser"
    if (s.need.field === "client_id") return "app"
    if (MAIL_SERVER_FIELDS.has(s.need.field)) return path.includes("server") ? "server" : null
    const field = s.need.field as WizardStep
    return path.includes(field) ? field : null
  }
  if (s.phase === "progress" && s.progress) {
    if (s.progress.step === "history" || s.progress.step === "waiting") return "history"
    if ((s.progress.step === "check" || s.progress.step === "login") && path.includes("check")) return "check"
  }
  if (s.phase === "done") return "done"
  return null
}

/**
 * The whole way in, from what the owner needs at hand to the end, and where on it the sign-in is. A switch of method
 * fades one path into the other, so the change is plain to see, not only the button's label.
 */
export function SignInPath({ s }: { s: SignInView }) {
  const method = `${s.method ?? ""}:${routeOf(s) ?? ""}`
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
  const path = wizardPath(s.tool ?? "", s.method, routeOf(s))
  // Between the tool's steps (an answer being checked, a stop) the last step it was on stays lit; once it runs, the
  // intro is behind it.
  const last = useRef({ run: s.run, at: 0 })
  if (last.current.run !== s.run) last.current = { run: s.run, at: 0 }
  const now = stepOf(s, path)
  last.current.at =
    s.phase === "plan" ? (now ? path.indexOf(now) : 0) : Math.max(last.current.at, now ? path.indexOf(now) : -1, 1)
  const at = last.current.at
  const done = s.phase === "done"
  const [locked, setLocked] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the note belongs to the step on screen
  useEffect(() => setLocked(false), [at, s.run])
  // The plan is the one step that can be undone: what is typed there stays, and the run is stopped. Past the tool's
  // own questions there is no way back, so a click says why.
  const canGoBack = s.phase !== "done" && s.phase !== "progress" && !s.stopping
  const select = (i: number) => {
    if (i >= at || s.phase === "done") return undefined
    return i === 0 && canGoBack ? s.toPlan : () => setLocked(true)
  }
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
      <Stepper
        rail
        steps={path.map((step, i) => {
          const onSelect = select(i)
          return { label: m.steps[step](name), state: state(i), ...(onSelect ? { onSelect } : {}) }
        })}
      />
      <Collapse open={locked}>
        <p role="status" className="mt-3 text-body leading-snug text-ink-soft">
          {m.rail.locked(name)}
        </p>
      </Collapse>
    </section>
  )
}
