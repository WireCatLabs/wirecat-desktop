import { Clock, ExternalLink, FileJson, ShieldCheck } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { findTool, signInMethods } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { type PlanText, planFor, planMessages } from "./messages-plan"
import { telegramMessages } from "./messages-telegram"
import { methodOf, setClientFile, setPassword, useSignIn } from "./store"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

/** Before anything runs: the steps the sign-in will take, how long, and what happens to what the owner shares. */
export function Plan() {
  const { tool, method, planMissing } = useSignIn()
  const m = useMessages(planMessages)
  const tm = useMessages(telegramMessages)
  const plan = tool ? planFor(m, tool, method) : undefined
  const entry = tool ? findTool(tool) : undefined
  const chosen = tool ? methodOf(tool, method) : undefined
  const steps = [
    ...(plan?.appKeys ? tm.appSteps.map((text) => ({ text, once: true })) : []),
    ...(plan?.steps ?? []).map((text) => ({ text, once: false })),
  ]
  const kept = [...(plan?.kept ?? []), m.wirecat]
  return (
    <div className="flex min-h-[19rem] flex-col gap-5 text-left">
      {entry?.signIn?.pick && <Providers />}
      {/* A new provider slides its own steps in (rule 9). */}
      <div key={method ?? ""} className="step-in flex flex-col gap-5">
        {plan && (
          <section className="flex flex-col gap-2.5">
            <h3 className="text-[1rem] font-semibold text-ink">{m.what}</h3>
            <ol className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <li key={step.text} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-[0.1rem] grid size-[1.3rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.8rem] text-brand tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="text-[0.95rem] leading-snug text-ink">
                    {step.once && (
                      <span className="mr-2 inline-block rounded-[0.2rem] bg-app-3 px-1.5 py-px align-[0.08em] text-[0.75rem] font-medium text-ink-soft">
                        {tm.firstTime}
                      </span>
                    )}
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
            {plan.guide && <GuideLink url={plan.guide.url} label={plan.guide.label} />}
            {plan.time && (
              <p className="flex items-center gap-3 text-[0.9rem] text-ink-soft">
                <Clock className="size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
                <span>
                  <span className="sr-only">{m.time}: </span>
                  {plan.time}
                </span>
              </p>
            )}
          </section>
        )}
        {chosen && (chosen.address || chosen.password) && <Typed missing={planMissing} />}
        {plan?.own && chosen && (chosen.clientFile || chosen.clientId) && (
          <OwnApp own={plan.own} kind={chosen.clientFile ? "file" : "id"} m={m} />
        )}
      </div>
      <section className="flex flex-col gap-2 border-line border-t pt-4">
        <h3 className="text-[1rem] font-semibold text-ink">{m.kept}</h3>
        <ul className="flex flex-col gap-1.5">
          {kept.map((line) => (
            <li key={line} className="flex items-start gap-3 text-[0.9rem] leading-snug text-ink-soft">
              <ShieldCheck className="mt-[0.1rem] size-[1.1rem] shrink-0 text-ok" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function GuideLink({ url, label }: { url: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-start"
      icon={<ExternalLink className="size-4" aria-hidden />}
      onClick={() => platform.openUrl(url)}
    >
      {label}
    </Button>
  )
}

/** The first choice for mail: which provider, and so which steps. Nothing is preselected beyond the catalog's first. */
function Providers() {
  const { tool, method } = useSignIn()
  const m = useMessages(planMessages)
  const name = useId()
  const entry = tool ? findTool(tool) : undefined
  if (!entry) return null
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[1rem] font-semibold text-ink">{m.pick}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {signInMethods(entry).map((option) => {
          const text = m.providers[option.id]
          return (
            <label key={option.id} className="relative cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={option.id === method}
                onChange={() => useSignIn.setState({ method: option.id, planMissing: null })}
                className="peer sr-only"
              />
              <span className="flex h-full flex-col gap-0.5 rounded-[0.35rem] border border-line-strong px-3 py-2.5 transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
                <span className="text-[0.95rem] font-medium text-ink">{text?.name ?? option.label}</span>
                {text && <span className="text-[0.8rem] leading-snug text-ink-soft">{text.detail}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** The address and app password; the password lives outside the store and is never shown back. */
function Typed({ missing }: { missing: "address" | "password" | null }) {
  const { tool, method, address, ownFile } = useSignIn()
  const m = useMessages(planMessages)
  const id = useId()
  const [password, setTyped] = useState("")
  // The field and what the run sends stay the same: a provider switched back starts both empty.
  useEffect(() => setPassword(""), [])
  const chosen = tool ? methodOf(tool, method) : undefined
  const askPassword = Boolean(chosen?.password) && !ownFile
  return (
    <section className="flex max-w-[26rem] flex-col gap-2">
      {chosen?.address && (
        <>
          <label htmlFor={`${id}-address`} className="text-[0.9rem] font-medium text-ink">
            {m.address}
          </label>
          <input
            id={`${id}-address`}
            type="email"
            autoComplete="email"
            spellCheck={false}
            value={address}
            onChange={(e) => useSignIn.setState({ address: e.target.value, planMissing: null })}
            aria-invalid={missing === "address"}
            aria-describedby={missing === "address" ? `${id}-missing` : undefined}
            className={FIELD}
          />
        </>
      )}
      {askPassword && (
        <>
          <label htmlFor={`${id}-password`} className="mt-1 text-[0.9rem] font-medium text-ink">
            {m.password}
          </label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={password}
            onChange={(e) => {
              setTyped(e.target.value)
              setPassword(e.target.value)
              useSignIn.setState({ planMissing: null })
            }}
            aria-invalid={missing === "password"}
            aria-describedby={missing === "password" ? `${id}-missing` : undefined}
            className={FIELD}
          />
        </>
      )}
      <p id={`${id}-missing`} role={missing ? "alert" : undefined} className="min-h-[1.3rem] text-[0.9rem] text-bad">
        {missing === "address" ? m.needAddress : missing === "password" ? m.needPassword : null}
      </p>
    </section>
  )
}

/** WC-SECR-25: WireCat's app unless the owner names one; a Google client file, or a Microsoft app id saved first. */
function OwnApp({ own, kind, m }: { own: { text: string; guide?: string }; kind: "file" | "id"; m: PlanText }) {
  const { ownFile, ownId, planError } = useSignIn()
  const id = useId()
  const picker = useRef<HTMLInputElement>(null)
  const [unreadable, setUnreadable] = useState(false)
  const pick = async (file: File | undefined) => {
    setUnreadable(false)
    if (!file) return
    try {
      // Rust checks the shape; this only keeps a large unrelated file out of the window's memory.
      if (file.size > 64 * 1024) throw new Error("too large")
      setClientFile(file.name, await file.text())
      useSignIn.setState({ planMissing: null })
    } catch {
      setUnreadable(true)
    }
  }
  return (
    <Disclosure summary={m.ownApp} openWhen={ownFile !== null || ownId !== "" || planError !== null}>
      <div className="flex max-w-[30rem] flex-col gap-2">
        <p className="text-[0.9rem] leading-snug text-ink-soft">{own.text}</p>
        {own.guide && <GuideLink url={own.guide} label={m.ownGuide} />}
        {kind === "file" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={picker}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                pick(e.target.files?.[0])
                e.target.value = ""
              }}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={<FileJson className="size-4" aria-hidden />}
              onClick={() => picker.current?.click()}
            >
              {ownFile ? m.clientFileOther : m.clientFile}
            </Button>
            {ownFile && (
              <Button size="sm" variant="ghost" onClick={() => setClientFile(null)}>
                {m.clientFileDrop}
              </Button>
            )}
            <p role="status" className={cx("w-full text-[0.9rem]", unreadable ? "text-bad" : "text-ink-soft")}>
              {unreadable ? m.clientFileUnreadable : ownFile ? m.clientFileChosen(ownFile) : planError}
            </p>
          </div>
        ) : (
          <>
            <label htmlFor={id} className="mt-1 text-[0.9rem] font-medium text-ink">
              {m.clientId}
            </label>
            <input
              id={id}
              spellCheck={false}
              autoComplete="off"
              value={ownId}
              onChange={(e) => useSignIn.setState({ ownId: e.target.value, planError: null })}
              aria-invalid={planError !== null}
              aria-describedby={`${id}-hint`}
              className={FIELD}
            />
            <p id={`${id}-hint`} className="text-[0.9rem] text-ink-soft">
              {planError ? (
                <span role="alert" className="text-bad">
                  {planError}
                </span>
              ) : (
                m.clientIdHint
              )}
            </p>
          </>
        )}
      </div>
    </Disclosure>
  )
}
