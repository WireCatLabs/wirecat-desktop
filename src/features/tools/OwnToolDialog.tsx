import { AlertTriangle, CheckCircle2, LoaderCircle, RotateCw } from "lucide-react"
import { type ReactNode, useEffect, useId, useState } from "react"
import { entryProblem } from "@/domain/catalog"
import { applyInstallEvent } from "@/domain/install-progress"
import type { InstallSession } from "@/domain/status"
import { useLang, useMessages } from "@/i18n"
import type { OwnRefusal, OwnReview, OwnUpdate } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { ownToolsDocs } from "@/shared/own-tools-docs"
import { useTools } from "@/shared/tools-store"
import { AutoHeight } from "@/ui/AutoHeight"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { InfoTip } from "@/ui/InfoTip"
import { failureWords, useFailureMessages } from "./failure-words"
import { InstallProgress } from "./InstallProgress"
import { type OwnText, ownMessages } from "./messages-own"
import { refusalWords } from "./own-refusal"
import { useOwnDialog } from "./own-store"

type Step =
  | { kind: "name" }
  | { kind: "reading"; pkg: string }
  | { kind: "refused"; pkg: string; refusal: OwnRefusal | { kind: "entry"; problem: string } }
  | { kind: "review"; review: OwnReview; accepted: boolean }
  | { kind: "confirm"; review: OwnReview }
  | { kind: "installing"; review: OwnReview; session: InstallSession }
  | { kind: "uninstalling"; review: OwnReview; done: boolean }

const field =
  "h-9 w-full min-w-0 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.95rem] text-ink placeholder:font-sans placeholder:text-ink-dim focus-visible:border-brand"

const startSession = (): InstallSession => ({
  operation: "install",
  step: "check",
  log: [],
  outcome: null,
  began: { check: Date.now() },
})

/**
 * Name → npm read → review → Add → "Install and run?" → install → done, on one surface. Nothing of the package runs
 * before the second confirmation: npm's install scripts are its first run.
 */
export function OwnToolDialog() {
  const m = useMessages(ownMessages)
  const { open, update, close } = useOwnDialog()
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
      setStep({ kind: "refused", pkg: name, refusal: { kind: "offline", detail: String(e) } })
    }
  }

  const install = (review: OwnReview) => {
    setStep({ kind: "installing", review, session: startSession() })
    const apply = (f: (s: InstallSession) => InstallSession) =>
      setStep((s) => (s.kind === "installing" ? { ...s, session: f(s.session) } : s))
    platform
      .ownToolAdd(review.token, (e) => apply((s) => applyInstallEvent(s, e)))
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
      title={step.kind === "confirm" ? m.confirmTitle(step.review.package) : title}
      onClose={() => !busy && close()}
      wide
      scroll
      actions={
        <Actions
          step={step}
          m={m}
          done={done}
          pkg={pkg}
          pasted={pasted}
          on={{ read, install, uninstall, setStep, close }}
        />
      }
    >
      <AutoHeight swap={step.kind}>
        {step.kind === "name" && (
          <NameStep m={m} pkg={pkg} setPkg={setPkg} onSubmit={() => pkg.trim() && read(pkg.trim(), null)} />
        )}
        {step.kind === "reading" && (
          <p role="status" className="flex items-center gap-2 text-[0.95rem] text-ink-soft">
            <LoaderCircle className="size-4 animate-spin text-brand" aria-hidden />
            {m.reading(step.pkg)}
          </p>
        )}
        {step.kind === "refused" && <Refused step={step} m={m} pasted={pasted} setPasted={setPasted} />}
        {step.kind === "review" && (
          <ReviewStep
            review={step.review}
            m={m}
            accepted={step.accepted}
            accept={(accepted) => setStep({ ...step, accepted })}
          />
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
  done,
  pkg,
  pasted,
  on,
}: {
  step: Step
  m: OwnText
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
    case "refused":
      return (
        <>
          <Button variant="ghost" onClick={() => on.setStep({ kind: "name" })}>
            {m.back}
          </Button>
          {step.refusal.kind === "no_manifest" ? (
            <Button variant="primary" disabled={!pasted.trim()} onClick={() => on.read(step.pkg, pasted)}>
              {m.checkPasted}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => on.read(step.pkg, null)}>
              {m.tryAgain}
            </Button>
          )}
        </>
      )
    case "review":
      return (
        <>
          {cancel}
          <Button
            variant="primary"
            disabled={step.review.update?.confirm === true && !step.accepted}
            onClick={() => on.setStep({ kind: "confirm", review: step.review })}
          >
            {m.add}
          </Button>
        </>
      )
    case "confirm":
      return (
        <>
          <Button variant="ghost" onClick={() => on.setStep({ kind: "review", review: step.review, accepted: true })}>
            {m.back}
          </Button>
          <Button variant="danger" onClick={() => on.install(step.review)}>
            {m.install}
          </Button>
        </>
      )
    case "installing": {
      const outcome = step.session.outcome
      if (!outcome) return null
      if (done)
        return (
          <>
            <Button variant="ghost" onClick={on.close}>
              {m.close}
            </Button>
            <Button
              variant="primary"
              icon={<RotateCw className="size-4" aria-hidden />}
              onClick={() => platform.restart()}
            >
              {m.restart}
            </Button>
          </>
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
  pkg,
  setPkg,
  onSubmit,
}: {
  m: OwnText
  pkg: string
  setPkg(v: string): void
  onSubmit(): void
}) {
  const id = useId()
  const help = useId()
  return (
    <div className="flex flex-col gap-4">
      <Warning m={m} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="font-medium">
          {m.name}
        </label>
        <input
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

function WarnBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[0.35rem] border border-warn/40 bg-warn/5 px-3.5 py-3 text-[0.95rem] text-ink">
      {children}
    </div>
  )
}

function Warning({ m }: { m: OwnText }) {
  const lang = useLang()
  return (
    <WarnBox>
      <ul className="flex flex-col gap-1">
        {m.warn.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-1 self-start text-brand underline hover:text-brand-hover"
        onClick={() => platform.openUrl(ownToolsDocs(lang))}
      >
        {m.docs}
      </button>
    </WarnBox>
  )
}

function Refused({
  step,
  m,
  pasted,
  setPasted,
}: {
  step: Extract<Step, { kind: "refused" }>
  m: OwnText
  pasted: string
  setPasted(v: string): void
}) {
  const id = useId()
  const r = step.refusal
  const [what, todo] = r.kind === "entry" ? m.refusal.entry(r.problem) : refusalWords(r, m.refusal)
  return (
    <div className="flex flex-col gap-4">
      <ErrorNotice>
        <span className="font-medium">{what}</span> {todo}
      </ErrorNotice>
      {r.kind === "no_manifest" && (
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-1.5">
      <dt className="text-ink-dim">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Commands({ label, list, m }: { label: string; list: string[]; m: OwnText }) {
  return (
    <Row label={label}>
      {list.length === 0 ? (
        <span className="text-ink-soft">{m.nothing}</span>
      ) : (
        <span className="font-mono text-[0.9rem]">{list.join(", ")}</span>
      )}
    </Row>
  )
}

function Changes({ review, m, accepted, accept }: ReviewProps & { review: OwnReview & { update: OwnUpdate } }) {
  const change = review.update
  const id = useId()
  const built = (b: OwnReview["built"]) => (b ? m.builtBy(b.repo) : m.notBuilt)
  const names = (parts: string[]) => parts.map((p) => m.parts[p as keyof OwnText["parts"]] ?? p).join(", ")
  const list = (label: string, items: string[]) =>
    items.length > 0 && (
      <p>
        {label} <span className="font-mono">{items.join(", ")}</span>
      </p>
    )
  if (!change.confirm) return <p className="text-ink-soft">{m.nothingNew(change.fromVersion)}</p>
  return (
    <WarnBox>
      {change.repoChanged && <p>{m.repoChanged(change.fromRepo ?? m.noRepository, review.repo ?? m.noRepository)}</p>}
      {change.provenanceChanged && <p>{m.provenanceChanged(built(change.fromBuilt), built(review.built))}</p>}
      {change.publishersChanged && (
        <p>{m.publishersChanged(change.fromPublishers.join(", "), review.publishers.join(", "))}</p>
      )}
      {list(m.newCommands, change.newCommands)}
      {list(m.newWrites, change.newWrites)}
      {change.newParts.length > 0 && (
        <p>
          {m.newParts} {names(change.newParts)}
        </p>
      )}
      {change.changedParts.length > 0 && (
        <p>
          {m.changedParts} {names(change.changedParts)}
        </p>
      )}
      {review.access.unknown && <p>{m.unknownAccess}</p>}
      <div className="mt-1 flex items-center gap-2">
        <Checkbox checked={accepted} onChange={accept} aria-labelledby={id} />
        <span id={id} className="font-medium">
          {m.acceptChanges}
        </span>
      </div>
    </WarnBox>
  )
}

type ReviewProps = { review: OwnReview; m: OwnText; accepted: boolean; accept(accepted: boolean): void }

function ReviewStep({ review, m, accepted, accept }: ReviewProps) {
  const agent = [review.skill && m.skill, review.mcp && m.mcp].filter(Boolean).join(" · ") || m.noAgent
  const update = review.update
  return (
    <div className="flex flex-col gap-4 text-[0.95rem]">
      {update && <Changes review={{ ...review, update }} m={m} accepted={accepted} accept={accept} />}
      <div>
        <p className="font-semibold text-[1.05rem]">
          {review.name} <span className="font-mono font-normal text-ink-soft">{review.package}</span>
        </p>
        <p className="mt-1 text-ink-soft">{review.summary}</p>
      </div>
      <dl className="divide-y divide-line">
        <Row label={m.publisher}>{review.publishers.join(", ")}</Row>
        <Row label={m.repository}>{review.repo ?? m.noRepository}</Row>
        <Row label={m.version}>
          <span className="font-mono">{review.version}</span>
        </Row>
        <Row label={m.provenance}>
          <span className={review.built ? "" : "text-warn-ink"}>
            {review.built ? m.builtBy(review.built.repo) : m.notBuilt}
          </span>
          <InfoTip label={m.provenanceInfo} className="ml-1 align-middle">
            {m.provenanceHelp}
          </InfoTip>
        </Row>
      </dl>
      <section aria-label={m.asksFor}>
        <h3 className="mb-1 font-medium">{m.asksFor}</h3>
        {review.access.unknown ? (
          <p className="text-warn-ink">{m.unknownAccess}</p>
        ) : (
          <dl className="divide-y divide-line">
            <Commands label={m.reads} list={review.access.reads} m={m} />
            <Commands label={m.changes} list={review.access.changes} m={m} />
            <Commands label={m.writes} list={review.access.writes} m={m} />
          </dl>
        )}
        <ul className="mt-2 flex flex-col gap-0.5 text-ink-soft">
          <li>{review.signIn ? m.signIn(review.signIn.asks, review.signIn.gives) : m.noSignIn}</li>
          <li>{review.syncs ? m.syncs : m.noSync}</li>
          <li>{agent}</li>
        </ul>
      </section>
      <Warning m={m} />
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
