import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { entryProblem } from "@/domain/catalog"
import { applyInstallEvent } from "@/domain/install-progress"
import type { InstallSession } from "@/domain/status"
import { useMessages } from "@/i18n"
import type { OwnRefusal, OwnReview } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { useOwnDialog } from "@/shared/own-dialog-store"
import { useTools } from "@/shared/tools-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { BackButton } from "@/ui/BackButton"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { reloadAddedTools } from "./community"
import { failureWords, useFailureMessages } from "./failure-words"
import { InstallProgress } from "./InstallProgress"
import { type OwnText, ownMessages } from "./messages-own"
import { type OwnReviewText, ownReviewMessages } from "./messages-own-review"
import { OwnAgentCheck } from "./OwnAgentCheck"
import { Danger, dangerLines, ReviewStep } from "./OwnReview"
import { refusalWords } from "./own-refusal"

type Refusal = OwnRefusal | { kind: "entry"; problem: string } | { kind: "unexpected"; detail: string }

type Step =
  /** `select`: back from a refusal, with the name kept and selected so typing replaces it. */
  | { kind: "name"; select?: boolean }
  | { kind: "reading"; pkg: string }
  | { kind: "refused"; pkg: string; refusal: Refusal }
  | { kind: "review"; review: OwnReview; accepted: boolean }
  | { kind: "check"; review: OwnReview; checked: boolean }
  | { kind: "confirm"; review: OwnReview }
  | { kind: "installing"; review: OwnReview; session: InstallSession }
  | { kind: "uninstalling"; review: OwnReview; done: boolean }

const field =
  "h-9 w-full min-w-0 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.95rem] text-ink placeholder:font-sans placeholder:text-ink-dim focus-visible:border-brand"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const startSession = (): InstallSession => ({
  operation: "install",
  step: "check",
  log: [],
  outcome: null,
  began: { check: Date.now() },
})

/** A retry of these reads the same name again; any other refusal is about the name, so Try again asks for another. */
const RETRY_SAME = new Set<Refusal["kind"]>(["offline", "too_large", "unexpected"])

/**
 * Name → npm read → review → Add → an AI agent's check (or skip) → "Install and run?" → install → done, on one
 * surface. Nothing of the package runs before the second confirmation: npm's install scripts are its first run.
 */
export function OwnToolDialog() {
  const m = useMessages(ownMessages)
  const r = useMessages(ownReviewMessages)
  const { open, update, read: reading, close } = useOwnDialog()
  const [step, setStep] = useState<Step>({ kind: "name" })
  const [pkg, setPkg] = useState("")
  const [pasted, setPasted] = useState("")

  const read = async (name: string, desktop: string | null) => {
    setStep({ kind: "reading", pkg: name })
    try {
      const found = await platform.ownToolDiscover(name, desktop)
      if (found.outcome === "refused") return setStep({ kind: "refused", pkg: name, refusal: found.refusal })
      const problem = entryProblem(found.review.entry)
      if (problem) return setStep({ kind: "refused", pkg: name, refusal: { kind: "entry", problem } })
      setStep({ kind: "review", review: found.review, accepted: false })
    } catch (e) {
      // Rust reports an unreachable npm as an `offline` refusal; a thrown error is something else.
      setStep({ kind: "refused", pkg: name, refusal: { kind: "unexpected", detail: message(e) } })
    }
  }

  const install = (review: OwnReview) => {
    setStep({ kind: "installing", review, session: startSession() })
    const apply = (f: (s: InstallSession) => InstallSession) =>
      setStep((s) => (s.kind === "installing" ? { ...s, session: f(s.session) } : s))
    platform
      .ownToolAdd(review.token, (e) => apply((s) => applyInstallEvent(s, e)))
      .then(reloadAddedTools)
      .then(() => useTools.getState().refresh(true))
      .catch((e) =>
        apply((s) => ({ ...s, outcome: { event: "failed", reason: "failed", message: String(e), hint: null } })),
      )
  }

  const uninstall = (review: OwnReview) => {
    setStep({ kind: "uninstalling", review, done: false })
    const finish = () => setStep({ kind: "uninstalling", review, done: true })
    platform.ownToolUninstall(review.token, () => undefined).then(finish, finish)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: opening starts a fresh flow; nothing else should
  useEffect(() => {
    if (!open) return
    setPasted("")
    if (update) {
      setPkg(update.pkg)
      void read(update.pkg, null)
    } else if (reading) {
      setPkg(reading)
      void read(reading, null)
    } else {
      setPkg("")
      setStep({ kind: "name" })
    }
  }, [open])

  const busy = step.kind === "reading" || (step.kind === "installing" && !step.session.outcome)
  const done = step.kind === "installing" && step.session.outcome?.event === "done"
  const title = update ? m.updateTitle(update.name) : m.title
  return (
    <Dialog
      open={open}
      title={
        step.kind === "confirm"
          ? m.confirmTitle(step.review.package)
          : step.kind === "check"
            ? r.check.title(step.review.package)
            : title
      }
      onClose={() => !busy && close()}
      wide
      scroll
      actions={
        <Actions
          step={step}
          m={m}
          r={r}
          done={done}
          pkg={pkg}
          pasted={pasted}
          on={{ read, install, uninstall, setStep, close }}
        />
      }
    >
      <AutoHeight swap={step.kind}>
        {step.kind === "name" && (
          <NameStep
            m={m}
            r={r}
            pkg={pkg}
            select={step.select === true}
            setPkg={setPkg}
            onSubmit={() => pkg.trim() && read(pkg.trim(), null)}
          />
        )}
        {step.kind === "reading" && (
          <p role="status" className="flex items-center gap-2 text-[0.95rem] text-ink-soft">
            <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
            {m.reading(step.pkg)}
          </p>
        )}
        {step.kind === "refused" && <Refused step={step} m={m} r={r} pasted={pasted} setPasted={setPasted} />}
        {step.kind === "review" && (
          <ReviewStep
            review={step.review}
            m={m}
            accepted={step.accepted}
            accept={(accepted) => setStep({ ...step, accepted })}
          />
        )}
        {step.kind === "check" && (
          <OwnAgentCheck review={step.review} onRun={() => setStep({ ...step, checked: true })} />
        )}
        {step.kind === "confirm" && <p className="text-[0.95rem]">{m.confirmBody}</p>}
        {step.kind === "installing" && <Installing step={step} m={m} />}
        {step.kind === "uninstalling" &&
          (step.done ? (
            <p className="text-[0.95rem]">{m.uninstalled}</p>
          ) : (
            <LoaderCircle className="size-5 animate-spin text-brand" aria-label={m.uninstall} />
          ))}
      </AutoHeight>
    </Dialog>
  )
}

type On = {
  read(pkg: string, desktop: string | null): void
  install(review: OwnReview): void
  uninstall(review: OwnReview): void
  setStep(step: Step): void
  close(): void
}

function Actions({
  step,
  m,
  r,
  done,
  pkg,
  pasted,
  on,
}: {
  step: Step
  m: OwnText
  r: OwnReviewText
  done: boolean
  pkg: string
  pasted: string
  on: On
}) {
  const cancel = (
    <Button variant="ghost" onClick={on.close}>
      {m.cancel}
    </Button>
  )
  switch (step.kind) {
    case "name":
      return (
        <>
          {cancel}
          <Button variant="primary" disabled={!pkg.trim()} onClick={() => on.read(pkg.trim(), null)}>
            {m.check}
          </Button>
        </>
      )
    case "refused": {
      const same = RETRY_SAME.has(step.refusal.kind)
      const manual = step.refusal.kind === "no_manifest"
      return (
        <>
          {cancel}
          <Button
            variant={manual ? "secondary" : "primary"}
            onClick={() => (same ? on.read(step.pkg, null) : on.setStep({ kind: "name", select: true }))}
          >
            {m.tryAgain}
          </Button>
          {manual && (
            <Button variant="primary" disabled={!pasted.trim()} onClick={() => on.read(step.pkg, pasted)}>
              {m.checkPasted}
            </Button>
          )}
        </>
      )
    }
    case "review":
      return (
        <>
          <BackButton onClick={() => on.setStep({ kind: "name" })} />
          {cancel}
          <Button
            variant="primary"
            disabled={step.review.update?.confirm === true && !step.accepted}
            onClick={() => on.setStep({ kind: "check", review: step.review, checked: false })}
          >
            {step.review.update ? m.update : m.add}
          </Button>
        </>
      )
    case "check":
      return (
        <>
          {cancel}
          <Button
            variant={step.checked ? "primary" : "secondary"}
            onClick={() => on.setStep({ kind: "confirm", review: step.review })}
          >
            {step.checked ? r.check.next : r.check.skip}
          </Button>
        </>
      )
    case "confirm":
      return (
        <>
          <BackButton onClick={() => on.setStep({ kind: "review", review: step.review, accepted: true })} />
          <Button variant="danger" onClick={() => on.install(step.review)}>
            {m.install}
          </Button>
        </>
      )
    case "installing": {
      const outcome = step.session.outcome
      if (!outcome) return <BackButton onClick={on.close} reason={m.backInstalling} />
      if (done)
        return (
          <Button variant="primary" onClick={on.close}>
            {m.close}
          </Button>
        )
      return (
        <>
          <Button variant="ghost" onClick={on.close}>
            {m.close}
          </Button>
          {installedBefore(step.session) ? (
            <Button variant="danger" onClick={() => on.uninstall(step.review)}>
              {m.uninstall}
            </Button>
          ) : (
            // The review was used up by this add; a new one reads npm again rather than reusing what it showed.
            <Button variant="secondary" onClick={() => on.read(step.review.package, null)}>
              {m.tryAgain}
            </Button>
          )}
        </>
      )
    }
    case "uninstalling":
      return step.done ? (
        <Button variant="ghost" onClick={on.close}>
          {m.close}
        </Button>
      ) : null
    default:
      return null
  }
}

/** A failure in the verify step came after npm installed the package, so its program is on the computer. */
const installedBefore = (s: InstallSession) => s.outcome?.event === "failed" && s.began?.verify !== undefined

function NameStep({
  m,
  r,
  pkg,
  select,
  setPkg,
  onSubmit,
}: {
  m: OwnText
  r: OwnReviewText
  pkg: string
  select: boolean
  setPkg(v: string): void
  onSubmit(): void
}) {
  const id = useId()
  const help = useId()
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (select) input.current?.select()
  }, [select])
  return (
    <div className="flex flex-col gap-4">
      <Danger lines={dangerLines(r, false)} m={m} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="font-medium">
          {m.name}
        </label>
        <input
          ref={input}
          id={id}
          data-autofocus
          value={pkg}
          spellCheck={false}
          autoComplete="off"
          aria-describedby={help}
          placeholder={m.namePlaceholder}
          onChange={(e) => setPkg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          className={field}
        />
        <p id={help} className="text-[0.9rem] text-ink-soft">
          {m.nameHelp}
        </p>
      </div>
    </div>
  )
}

function Refused({
  step,
  m,
  r,
  pasted,
  setPasted,
}: {
  step: Extract<Step, { kind: "refused" }>
  m: OwnText
  r: OwnReviewText
  pasted: string
  setPasted(v: string): void
}) {
  const id = useId()
  const x = step.refusal
  const [what, todo] =
    x.kind === "entry"
      ? m.refusal.entry(x.problem)
      : x.kind === "unexpected"
        ? m.refusal.unexpected(x.detail)
        : x.kind === "not_found"
          ? [r.notFound(step.pkg), m.refusal.not_found[1]]
          : refusalWords(x, m.refusal)
  const title = x.kind === "collision" && x.listed ? r.refusalTitle.listed : r.refusalTitle[x.kind]
  return (
    <div className="flex flex-col gap-4">
      <ErrorNotice detail={`${what} ${todo}`}>
        <span className="font-semibold">{title}</span>
      </ErrorNotice>
      {x.kind === "no_manifest" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="font-medium">
            {m.paste}
          </label>
          <textarea
            id={id}
            value={pasted}
            spellCheck={false}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            className={`${field} h-auto py-2`}
          />
        </div>
      )}
    </div>
  )
}

function Installing({ step, m }: { step: Extract<Step, { kind: "installing" }>; m: OwnText }) {
  const fm = useFailureMessages()
  const outcome = step.session.outcome
  if (!outcome || outcome.event === "removed") return <InstallProgress session={step.session} />
  if (outcome.event === "done")
    return (
      <p role="status" className="flex items-center gap-2 text-[0.95rem]">
        <CheckCircle2 className="size-5 shrink-0 text-ok" aria-hidden />
        {m.done(step.review.name)}
      </p>
    )
  const [what, hint] = failureWords(outcome, "install", fm)
  return (
    <div className="flex flex-col gap-3">
      <ErrorNotice>
        <span className="font-medium">{what}</span> {hint}
      </ErrorNotice>
      {installedBefore(step.session) && (
        <p className="flex items-center gap-2 text-[0.95rem] text-ink-soft">
          <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
          {m.installedRefused}
        </p>
      )}
    </div>
  )
}
