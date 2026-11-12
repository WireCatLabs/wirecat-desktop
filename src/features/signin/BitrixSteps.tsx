import { Clock, Info, LoaderCircle, ShieldCheck } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import {
  APP_HANDLER,
  type AppProblem,
  appGuide,
  WEBHOOK_SCOPES,
  type WebhookProblem,
  webhookPage,
} from "@/domain/bitrix-signin"
import { useLang, useMessages } from "@/i18n"
import { openTool } from "@/shared/go-tool"
import { OpenLink } from "@/shared/OpenLink"
import { BITRIX, BITRIX_APP, hasPasted, methodTooOld, running, setPassword, useSignIn } from "@/shared/signin-store"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { FieldError } from "@/ui/FieldError"
import { SecretField } from "@/ui/SecretField"
import { Numbered } from "./MailSteps"
import { type BitrixText, bitrixMessages } from "./messages-bitrix"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

/**
 * Bitrix24's sign-in before b24 runs: the portal and the way in, then how to make the webhook there and the field to
 * paste it in, or how to make the local application and its id and key.
 */
export function BitrixSteps() {
  const { planStep } = useSignIn(useShallow((s) => ({ planStep: s.planStep })))
  if (planStep === "app") return <LocalApp />
  if (planStep === "webhook") return <MakeWebhook />
  if (planStep === "paste") return <PasteWebhook />
  return <Portal />
}

function Heading({ children }: { children: string }) {
  return <h3 className="text-[1.15rem] font-semibold text-ink">{children}</h3>
}

function Portal() {
  const m = useMessages(bitrixMessages).portal
  const { portal, planMissing, tool, method } = useSignIn(
    useShallow((s) => ({ portal: s.portal, planMissing: s.planMissing, tool: s.tool, method: s.method })),
  )
  const old = planMissing === "update" ? methodTooOld(tool, method) : null
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const missing = planMissing === "portal"
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus on arrival and on each refused Next
  useEffect(() => input.current?.focus(), [missing])
  return (
    <div className="flex min-h-[19rem] flex-col gap-4 text-left">
      <section className="flex flex-col gap-2">
        <Heading>{m.title}</Heading>
        <p className="text-body leading-snug text-ink-soft">{m.lead}</p>
      </section>
      <section className="flex max-w-[26rem] flex-col gap-2">
        <label htmlFor={id} className="text-[1.05rem] font-medium text-ink">
          {m.label}
        </label>
        <input
          ref={input}
          id={id}
          inputMode="url"
          autoComplete="url"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={m.placeholder}
          value={portal}
          onChange={(e) => useSignIn.setState({ portal: e.target.value, planMissing: null })}
          onKeyDown={(e) => {
            if (e.key === "Enter") useSignIn.getState().begin()
          }}
          aria-invalid={missing}
          aria-describedby={`${id}-hint`}
          className={FIELD}
        />
        <p id={`${id}-hint`} className="min-h-[2.75em] text-[0.9rem] leading-snug text-ink-soft">
          {missing ? (
            <span role="alert" className="text-bad">
              {m.missing}
            </span>
          ) : (
            m.hint
          )}
        </p>
      </section>
      <Ways />
      {old && (
        <ToolNeeded inline gap={old} onGo={() => useSignIn.getState().close()}>
          <p>{m.tooOld}</p>
        </ToolNeeded>
      )}
    </div>
  )
}

/** The two ways in, the webhook first: both need the portal, so the choice sits beside it. */
function Ways() {
  const m = useMessages(bitrixMessages).portal
  const { method } = useSignIn(useShallow((s) => ({ method: s.method })))
  const name = useId()
  return (
    <fieldset className="flex max-w-[34rem] flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[1.05rem] font-medium text-ink">{m.way}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["webhook", BITRIX_APP] as const).map((way) => (
          <label key={way} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={way}
              checked={(method ?? "webhook") === way}
              onChange={() => {
                // A webhook pasted before, or a key typed before, never goes to the other way.
                setPassword("")
                useSignIn.setState({ method: way, planMissing: null, webhookProblem: null, appProblem: null })
              }}
              className="peer sr-only"
            />
            <span className="flex h-full flex-col gap-0.5 rounded-[0.35rem] border border-line-strong px-3 py-2.5 transition-colors peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-brand peer-focus-visible:outline-offset-2">
              <span className="text-[0.95rem] font-medium text-ink">{m.ways[way].name}</span>
              <span className="text-[0.8rem] leading-snug text-ink-soft">{m.ways[way].detail}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function MakeWebhook() {
  const m = useMessages(bitrixMessages).webhook
  const { portal } = useSignIn(useShallow((s) => ({ portal: s.portal })))
  const steps = [
    { text: m.steps.open(portal), open: true },
    { text: m.steps.other },
    { text: m.steps.rights, scopes: true },
    { text: m.steps.save(portal) },
  ]
  return (
    <div className="flex min-h-[19rem] flex-col gap-4 text-left">
      <section className="flex flex-col gap-2.5">
        <Heading>{m.title}</Heading>
        <p className="text-body leading-snug text-ink-soft">{m.lead(portal)}</p>
        <ol className="flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li key={step.text} className="flex items-start gap-3">
              <Numbered i={i} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-body leading-snug text-ink">{step.text}</span>
                {step.open && (
                  <div className="self-start">
                    <OpenLink url={webhookPage(portal)}>{m.open}</OpenLink>
                  </div>
                )}
                {step.scopes && <Scopes m={m} />}
              </div>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-3 text-[0.95rem] text-ink-soft">
          <Clock className="size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
          <span>{m.time}</span>
        </p>
      </section>
      <ul className="flex flex-col gap-1.5 border-line border-t pt-3">
        {[m.acts, m.admin].map((line) => (
          <li key={line} className="flex items-start gap-3 text-[0.95rem] leading-snug text-ink-soft">
            <ShieldCheck className="mt-[0.1rem] size-[1.1rem] shrink-0 text-ok" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
        <li className="flex items-start gap-3 text-[0.95rem] leading-snug text-ink-soft">
          <Info className="mt-[0.1rem] size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
          <span>{m.noItem}</span>
        </li>
      </ul>
    </div>
  )
}

/** Each right by Bitrix24's own name and its code, which the rights list's search finds. */
function Scopes({ m }: { m: BitrixText["webhook"] }) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-[0.35rem] border border-line bg-app-2">
      {WEBHOOK_SCOPES.map((code) => (
        <li key={code} className="flex items-center gap-3 py-1 pr-1 pl-3">
          <span className="min-w-0 flex-1 text-[0.95rem] text-ink">{m.scopes[code]}</span>
          <code className="selectable font-mono text-[0.875rem] text-ink-soft">{code}</code>
          <CopyButton value={code} label={m.copyCode(code)} />
        </li>
      ))}
    </ul>
  )
}

function LocalApp() {
  const all = useMessages(bitrixMessages)
  const m = all.app
  const { portal, planMissing, appId, appProblem } = useSignIn(
    useShallow((s) => ({ portal: s.portal, planMissing: s.planMissing, appId: s.appId, appProblem: s.appProblem })),
  )
  const lang = useLang()
  const id = useId()
  const idField = useRef<HTMLInputElement>(null)
  const keyField = useRef<HTMLInputElement>(null)
  const [key, setKey] = useState("")
  const kept = key === "" && hasPasted()
  const steps = [
    {
      text: m.steps.open(portal),
      extra: (
        <div className="self-start">
          <OpenLink url={webhookPage(portal)}>{m.open}</OpenLink>
        </div>
      ),
    },
    { text: m.steps.server, extra: <Handler label={m.copyHandler} /> },
    { text: m.steps.install, extra: null },
    { text: m.steps.rights, extra: <Scopes m={all.webhook} /> },
    { text: m.steps.save, extra: null },
  ]
  useEffect(() => {
    if (planMissing === "appKey") keyField.current?.focus()
    else if (planMissing === "appId" || appProblem) idField.current?.focus()
  }, [planMissing, appProblem])
  return (
    <div className="flex min-h-[19rem] flex-col gap-4 text-left">
      <section className="flex flex-col gap-2.5">
        <Heading>{m.title}</Heading>
        <p className="text-body leading-snug text-ink-soft">{m.lead(portal)}</p>
        <ol className="flex flex-col gap-2.5">
          {steps.map((step, i) => (
            <li key={step.text} className="flex items-start gap-3">
              <Numbered i={i} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-body leading-snug text-ink">{step.text}</span>
                {step.extra}
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.95rem] text-ink-soft">
          <p className="flex items-center gap-3">
            <Clock className="size-[1.1rem] shrink-0 text-ink-dim" aria-hidden />
            <span>{m.time}</span>
          </p>
          <OpenLink url={appGuide(lang)} variant="ghost">
            {m.docs}
          </OpenLink>
        </div>
      </section>
      {appProblem && <AppRefusal problem={appProblem} />}
      <section className="flex max-w-[34rem] flex-col gap-2">
        <label htmlFor={`${id}-id`} className="text-[1.05rem] font-medium text-ink">
          {m.idLabel}
        </label>
        <input
          ref={idField}
          id={`${id}-id`}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={m.idPlaceholder}
          value={appId}
          onChange={(e) => useSignIn.setState({ appId: e.target.value, planMissing: null, appProblem: null })}
          aria-invalid={planMissing === "appId" || appProblem?.kind === "refused"}
          aria-describedby={planMissing === "appId" ? `${id}-id-hint` : undefined}
          className={FIELD}
        />
        <FieldError id={`${id}-id-hint`}>{planMissing === "appId" && m.missingId}</FieldError>
        <label htmlFor={`${id}-key`} className="mt-1 text-[1.05rem] font-medium text-ink">
          {m.keyLabel}
        </label>
        <SecretField
          id={`${id}-key`}
          inputRef={keyField}
          value={key}
          onChange={(next) => {
            setKey(next)
            setPassword(next)
            useSignIn.setState({ planMissing: null, appProblem: null })
          }}
          showLabel={m.show}
          hideLabel={m.hide}
          invalid={planMissing === "appKey" || appProblem?.kind === "refused"}
          describedBy={`${id}-key-hint`}
        />
        <p id={`${id}-key-hint`} className="min-h-[2.75em] text-[0.9rem] leading-snug text-ink-soft">
          {planMissing === "appKey" ? (
            <span role="alert" className="text-bad">
              {m.missingKey}
            </span>
          ) : kept ? (
            m.kept
          ) : (
            m.keyHint
          )}
        </p>
      </section>
      <ul className="flex flex-col gap-1.5 border-line border-t pt-3">
        {[m.browser, m.acts].map((line) => (
          <li key={line} className="flex items-start gap-3 text-[0.95rem] leading-snug text-ink-soft">
            <ShieldCheck className="mt-[0.1rem] size-[1.1rem] shrink-0 text-ok" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The handler path, to copy into the application's form: Bitrix24 sends the browser there, and it returns to b24. */
function Handler({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[0.35rem] border border-line bg-app-2 py-1 pr-1 pl-3">
      <code className="selectable min-w-0 flex-1 break-all font-mono text-[0.875rem] text-ink">{APP_HANDLER}</code>
      <CopyButton value={APP_HANDLER} label={label} />
    </div>
  )
}

function AppRefusal({ problem }: { problem: AppProblem }) {
  const text = useMessages(bitrixMessages).app.problem[problem.kind]
  return (
    <ErrorNotice detail={text.cause} raw={problem.message || null} tone={problem.kind === "scope" ? "warn" : "bad"}>
      <span className="font-medium">{text.title}</span>
    </ErrorNotice>
  )
}

function PasteWebhook() {
  const m = useMessages(bitrixMessages)
  const { portal, planMissing, webhookProblem, comparing, phase } = useSignIn(
    useShallow((s) => ({
      portal: s.portal,
      planMissing: s.planMissing,
      webhookProblem: s.webhookProblem,
      comparing: s.comparing,
      phase: s.phase,
    })),
  )
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const kept = value === "" && hasPasted()
  const checking = comparing || running(phase)
  const missing = planMissing === "webhook"
  // biome-ignore lint/correctness/useExhaustiveDependencies: focus on arrival and on each refusal
  useEffect(() => input.current?.focus(), [missing, webhookProblem])
  return (
    <div className="flex min-h-[19rem] flex-col gap-4 text-left">
      <Heading>{m.paste.title}</Heading>
      {webhookProblem && <Refusal problem={webhookProblem} portal={portal} />}
      <section className="flex max-w-[34rem] flex-col gap-2">
        <label htmlFor={id} className="text-[1.05rem] font-medium text-ink">
          {m.paste.label}
        </label>
        <SecretField
          id={id}
          inputRef={input}
          value={value}
          onChange={(next) => {
            setValue(next)
            setPassword(next)
            useSignIn.setState({ planMissing: null, webhookProblem: null })
          }}
          showLabel={m.paste.show}
          hideLabel={m.paste.hide}
          invalid={missing || (webhookProblem !== null && webhookProblem.kind !== "scope")}
          disabled={checking}
          describedBy={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="min-h-[2.75em] text-[0.9rem] leading-snug text-ink-soft">
          {checking ? (
            <span role="status" className="flex items-center gap-2 text-ink">
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
              {m.paste.checking(portal)}
            </span>
          ) : missing ? (
            <span role="alert" className="text-bad">
              {m.paste.missing}
            </span>
          ) : kept ? (
            m.paste.kept
          ) : (
            m.paste.hint(portal)
          )}
        </p>
      </section>
    </div>
  )
}

function Refusal({ problem, portal }: { problem: WebhookProblem; portal: string }) {
  const m = useMessages(bitrixMessages)
  if (problem.kind === "wrongPortal") {
    const text = m.wrongPortal(problem.host, portal)
    return (
      <ErrorNotice
        detail={text.cause}
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => useSignIn.setState({ portal: problem.host, webhookProblem: null })}
          >
            {m.switchPortal(problem.host)}
          </Button>
        }
      >
        <span className="font-medium">{text.title}</span>
      </ErrorNotice>
    )
  }
  if (problem.kind === "duplicate") {
    const text = m.duplicate(problem.profile)
    return (
      <ErrorNotice
        detail={text.cause}
        raw={problem.message || null}
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              useSignIn.getState().close()
              openTool(BITRIX)
            }}
          >
            {m.manage(problem.profile)}
          </Button>
        }
      >
        <span className="font-medium">{text.title}</span>
      </ErrorNotice>
    )
  }
  const text = m.problem[problem.kind]
  return (
    <ErrorNotice detail={text.cause} raw={problem.message || null} tone={problem.kind === "scope" ? "warn" : "bad"}>
      <span className="font-medium">{text.title}</span>
    </ErrorNotice>
  )
}
