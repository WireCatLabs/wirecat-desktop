import { Clock, Info, LoaderCircle, ShieldCheck } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { WEBHOOK_SCOPES, type WebhookProblem, webhookPage } from "@/domain/bitrix-signin"
import { useMessages } from "@/i18n"
import { openTool } from "@/shared/go-tool"
import { OpenLink } from "@/shared/OpenLink"
import { BITRIX, hasPasted, running, setPassword, useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { CopyButton } from "@/ui/CopyButton"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { SecretField } from "@/ui/SecretField"
import { Numbered } from "./MailSteps"
import { type BitrixText, bitrixMessages } from "./messages-bitrix"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

/** Bitrix24's sign-in before b24 runs: the portal, how to make the webhook there, and the field to paste it in. */
export function BitrixSteps() {
  const { planStep } = useSignIn()
  if (planStep === "webhook") return <MakeWebhook />
  if (planStep === "paste") return <PasteWebhook />
  return <Portal />
}

function Heading({ children }: { children: string }) {
  return <h3 className="text-[1.15rem] font-semibold text-ink">{children}</h3>
}

function Portal() {
  const m = useMessages(bitrixMessages).portal
  const { portal, planMissing } = useSignIn()
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
    </div>
  )
}

function MakeWebhook() {
  const m = useMessages(bitrixMessages).webhook
  const { portal } = useSignIn()
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

function PasteWebhook() {
  const m = useMessages(bitrixMessages)
  const s = useSignIn()
  const { portal, planMissing, webhookProblem, comparing, phase } = s
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
