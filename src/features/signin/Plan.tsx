import { CircleCheck, Clock, ShieldCheck } from "lucide-react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { ASTERISK } from "@/domain/asterisk-source"
import { findTool, signInMethods } from "@/domain/catalog"
import type { MailWay } from "@/domain/mail-signin"
import { useMessages } from "@/i18n"
import { OpenLink } from "@/shared/OpenLink"
import {
  BITRIX,
  guidedProvider,
  methodOf,
  oauthTooOld,
  setClientFile,
  setPassword,
  useSignIn,
} from "@/shared/signin-store"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { useTools } from "@/shared/tools-store"
import { Disclosure } from "@/ui/Disclosure"
import { useFieldError } from "@/ui/FieldError"
import { AsteriskSource } from "./AsteriskSource"
import { BitrixSteps } from "./BitrixSteps"
import { AppPasswordStep, GoogleClient } from "./MailSteps"
import { mailMessages } from "./messages-mail"
import { type PlanText, planFor, planMessages } from "./messages-plan"
import { telegramMessages } from "./messages-telegram"
import { needFor, wizardMessages } from "./messages-wizard"
import { routeOf } from "./wizard"

const FIELD =
  "selectable h-10 w-full rounded-control border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

/** Before anything runs: the steps the sign-in will take, how long, and what happens to what the owner shares. */
export function Plan() {
  const s = useSignIn()
  const { tool, method, planMissing, planStep, way } = s
  const m = useMessages(planMessages)
  const tm = useMessages(telegramMessages)
  const wm = useMessages(wizardMessages)
  const provider = guidedProvider(s)
  const route = routeOf(s)
  const plan = tool ? planFor(m, tool, method, route) : undefined
  const gmail = tool === "email" && method === "gmail"
  // Gmail's two ways say what each needs on their own cards.
  const need = tool && !gmail ? needFor(wm, tool, method) : []
  const entry = tool ? findTool(tool) : undefined
  const chosen = tool ? methodOf(tool, method) : undefined
  // A refusal is a new run: the step starts again, its field empty.
  if (planStep === "password" && provider) return <AppPasswordStep key={s.run} provider={provider} />
  if (tool === BITRIX) return <BitrixSteps />
  if (tool === ASTERISK) return <AsteriskSource />
  const steps = [
    ...(plan?.appKeys ? tm.appSteps.map((text) => ({ text, once: true })) : []),
    ...(plan?.steps ?? []).map((text) => ({ text, once: false })),
  ]
  const kept = [...(plan?.kept ?? []), m.wirecat]
  const ways = entry && !entry.signIn?.pick ? signInMethods(entry).length : 0
  return (
    <div className="flex min-h-[19rem] flex-col gap-5 text-left">
      {entry?.signIn?.pick && <Providers />}
      {gmail && <Ways own={plan?.own} m={m} />}
      {/* A new provider or way slides its own steps in (rule 9). */}
      <div key={`${method ?? ""}:${gmail ? way : ""}`} className="step-in flex flex-col gap-5">
        {need.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[1.15rem] font-semibold text-ink">{wm.needHeading}</h3>
            <ul className="flex flex-col gap-1.5">
              {need.map((line) => (
                <li key={line} className="flex items-start gap-3 text-body leading-snug text-ink">
                  <CircleCheck className="mt-[0.15rem] size-[1.1rem] shrink-0 text-brand" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {plan && (
          <section className="flex flex-col gap-2.5">
            {/* With two ways in, the heading names the one these steps are for, and changes with it. */}
            <h3 className="text-[1.15rem] font-semibold text-ink">
              {(ways > 1 && method && wm.method[method]) || m.what}
            </h3>
            <ol className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <li key={step.text} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-[0.15rem] grid size-[1.45rem] shrink-0 place-items-center rounded-full bg-brand-soft font-mono text-[0.85rem] text-brand tabular-nums"
                  >
                    {i + 1}
                  </span>
                  <span className="text-body leading-snug text-ink">
                    {step.once && (
                      <span className="mr-2 inline-block rounded-rack bg-app-3 px-1.5 py-px align-[0.08em] text-[0.8rem] font-medium text-ink-soft">
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
              <p className="flex items-center gap-3 text-[0.95rem] text-ink-soft">
                <Clock className="size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
                <span>
                  <span className="sr-only">{m.time}: </span>
                  {plan.time}
                </span>
              </p>
            )}
          </section>
        )}
        {chosen && (chosen.address || chosen.password) && (
          <Typed missing={planMissing === "address" || planMissing === "password" ? planMissing : null} />
        )}
        {!gmail && plan?.own && chosen && (chosen.clientFile || chosen.clientId) && (
          <OwnApp own={plan.own} kind={chosen.clientFile ? "file" : "id"} m={m} />
        )}
      </div>
      <section className="flex flex-col gap-2 border-line border-t pt-4">
        <h3 className="text-[1.15rem] font-semibold text-ink">{m.kept}</h3>
        <ul className="flex flex-col gap-1.5">
          {kept.map((line) => (
            <li key={line} className="flex items-start gap-3 text-[0.95rem] leading-snug text-ink-soft">
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
    <div className="self-start">
      <OpenLink url={url} variant="ghost">
        {label}
      </OpenLink>
    </div>
  )
}

/** The first choice for mail: which provider, and so which steps. Nothing is preselected beyond the catalog's first. */
function Providers() {
  const { tool, method } = useSignIn(useShallow((s) => ({ tool: s.tool, method: s.method })))
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
              <span className="flex h-full flex-col gap-0.5 rounded-control border border-line-strong px-3 py-2.5 transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
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
  const { tool, method, address, ownFile } = useSignIn(
    useShallow((s) => ({ tool: s.tool, method: s.method, address: s.address, ownFile: s.ownFile })),
  )
  const m = useMessages(planMessages)
  const id = useId()
  const [password, setTyped] = useState("")
  const chosen = tool ? methodOf(tool, method) : undefined
  const askPassword = Boolean(chosen?.password) && !ownFile
  const addressNeed = useFieldError(`${id}-address`, {
    live: { problem: missing === "address" ? m.needAddress : null },
  })
  const passwordNeed = useFieldError(`${id}-password`, {
    live: { problem: missing === "password" ? m.needPassword : null },
  })
  const failAddress = addressNeed.fail
  const failPassword = passwordNeed.fail
  // The store says what is missing when Start is pressed; the field shows it, is marked and takes focus.
  useEffect(() => {
    if (missing === "address") failAddress()
    if (missing === "password") failPassword()
  }, [missing, failAddress, failPassword])
  // The field and what the run sends stay the same: a provider switched back starts both empty. Only for a field of
  // its own: the app password step keeps what it was given.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the field appears
  useEffect(() => {
    if (askPassword) setPassword("")
  }, [])
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
            {...addressNeed.field}
            className={FIELD}
          />
          {addressNeed.hint}
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
            {...passwordNeed.field}
            className={FIELD}
          />
          {passwordNeed.hint}
        </>
      )}
    </section>
  )
}

/** WC-SECR-25: WireCat's app unless the owner names one; a Google client file, or a Microsoft app id saved first. */
/**
 * Gmail's ways in, before anything else is asked: Google's own page first, as the owner chose (2026-11-08), with the
 * owner's own client folded inside it, and the app password under "Other ways".
 */
function Ways({ own, m: pm }: { own: { text: string; guide?: string } | undefined; m: PlanText }) {
  const m = useMessages(mailMessages)
  const { way, tool, method } = useSignIn(useShallow((s) => ({ way: s.way, tool: s.tool, method: s.method })))
  const installs = useTools((s) => s.installs)
  const old = oauthTooOld(tool, method, installs)
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[1rem] font-semibold text-ink">{m.ways.legend}</legend>
      <WayOption option="browser" name={name}>
        {old && (
          <div className="pb-2">
            <ToolNeeded inline gap={old} onGo={() => useSignIn.getState().close()}>
              <p>{m.ways.tooOld}</p>
            </ToolNeeded>
          </div>
        )}
        {way === "browser" && own && <OwnApp own={own} kind="file" m={pm} open={Boolean(old)} />}
      </WayOption>
      <fieldset className="flex flex-col gap-1.5 border-0 p-0 pt-1">
        <legend className="mb-1.5 text-[0.85rem] font-medium text-ink-soft">{m.ways.others}</legend>
        <WayOption option="appPassword" name={name} />
      </fieldset>
    </fieldset>
  )
}

function WayOption({ option, name, children }: { option: MailWay; name: string; children?: ReactNode }) {
  const { way } = useSignIn(useShallow((s) => ({ way: s.way })))
  const text = useMessages(mailMessages).ways[option]
  return (
    <div className="rounded-control border border-line-strong transition-colors has-checked:border-brand has-checked:bg-brand-soft">
      <label className="relative block cursor-pointer">
        <input
          type="radio"
          name={name}
          value={option}
          checked={option === way}
          onChange={() => {
            // A client chosen for the browser is not sent with an app password.
            if (option === "appPassword") setClientFile(null)
            useSignIn.setState({ way: option, planMissing: null })
          }}
          className="peer sr-only"
        />
        <span className="flex h-full flex-col gap-1 rounded-control px-3 py-2.5 peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[0.95rem] font-medium text-ink">{text.name}</span>
            {text.badge && (
              <span className="rounded-rack bg-ok/15 px-1.5 py-px text-[0.75rem] font-medium text-ok">
                {text.badge}
              </span>
            )}
          </span>
          <span className="text-[0.85rem] leading-snug text-ink">{text.detail}</span>
          <span className="text-[0.85rem] leading-snug text-ink-soft">{text.needs}</span>
          {text.note && <span className="text-[0.85rem] leading-snug text-ink-soft">{text.note}</span>}
          <span className="mt-auto flex items-center gap-1.5 pt-1 text-[0.8rem] text-ink-dim">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {text.time}
          </span>
        </span>
      </label>
      {children && <div className="px-3 pb-2.5">{children}</div>}
    </div>
  )
}

/** The owner's Google client: a file picked here, or its ID and secret typed. */
function ClientChoice({ m }: { m: PlanText }) {
  const { ownFile, planError } = useSignIn(useShallow((s) => ({ ownFile: s.ownFile, planError: s.planError })))
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
    <>
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
      <GoogleClient
        fileLabel={ownFile ? m.clientFileOther : m.clientFile}
        fileChosen={ownFile ? m.clientFileChosen(ownFile) : null}
        unreadable={unreadable ? m.clientFileUnreadable : planError}
        onPick={() => picker.current?.click()}
      />
    </>
  )
}

function OwnApp({
  own,
  kind,
  m,
  open = false,
}: {
  own: { text: string; guide?: string }
  kind: "file" | "id"
  m: PlanText
  open?: boolean
}) {
  const { ownFile, ownId, planError } = useSignIn(
    useShallow((s) => ({ ownFile: s.ownFile, ownId: s.ownId, planError: s.planError })),
  )
  const id = useId()
  return (
    <Disclosure summary={m.ownApp} openWhen={open || ownFile !== null || ownId !== "" || planError !== null}>
      <div className="flex max-w-[30rem] flex-col gap-2">
        <p className="text-[0.9rem] leading-snug text-ink-soft">{own.text}</p>
        {own.guide && <GuideLink url={own.guide} label={m.ownGuide} />}
        {kind === "file" ? (
          <ClientChoice m={m} />
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
