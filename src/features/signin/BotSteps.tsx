import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { type FormEvent, useEffect, useId, useRef, useState } from "react"
import { botCause, botCommand, botHandle, fieldProblem, tokenProblem } from "@/domain/bot-signin"
import { type CatalogTool, isValidProfile } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { type BotFailure, useBotSignIn } from "@/shared/bot-signin-store"
import { type BotMessages, type BotTool, botMessages } from "@/shared/messages-bot"
import { OpenLink } from "@/shared/OpenLink"
import { AutoHeight } from "@/ui/AutoHeight"
import { CopyField } from "@/ui/CopyField"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { focusInPlace } from "@/ui/motion"
import { SecretField } from "@/ui/SecretField"
import { Tab, TabList, TabPanel, Tabs } from "@/ui/Tabs"

export const NAME_FORM = "bot-name-form"
export const TOKEN_FORM = "bot-token-form"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

const toolKey = (id: string): BotTool => (id === "max" || id === "wa" ? id : "tg")

export function NameStep({ tool }: { tool: CatalogTool }) {
  const m = useMessages(botMessages)
  const s = useBotSignIn()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(s.profile)
  const [tried, setTried] = useState(false)
  const valid = isValidProfile(name)
  const problem = name === "" ? (tried ? m.nameEmpty : null) : valid ? null : m.nameInvalid
  const taken = valid && (s.bots[tool.id] ?? []).some((b) => b.name === name)

  useEffect(() => focusInPlace(input.current), [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid) {
      setTried(true)
      return focusInPlace(input.current)
    }
    s.toToken(name)
  }

  return (
    <form id={NAME_FORM} onSubmit={submit} className="flex max-w-[28rem] flex-col gap-2">
      <label htmlFor={id} className="text-[0.95rem] font-medium text-ink">
        {m.nameLabel}
      </label>
      <input
        ref={input}
        id={id}
        value={name}
        onChange={(e) => setName(e.target.value.trim())}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={problem !== null}
        aria-describedby={`${id}-hint`}
        className={FIELD}
      />
      <p id={`${id}-hint`} className="min-h-[2.6rem] text-[0.9rem] leading-snug">
        {problem ? (
          <span role="alert" className="text-bad">
            {problem}
          </span>
        ) : taken ? (
          <span className="text-warn-ink">{m.replaces(name, tool.name)}</span>
        ) : (
          <span className="text-ink-soft">{m.nameHint(botCommand(tool.bin, valid ? name : m.nameExample))}</span>
        )}
      </p>
    </form>
  )
}

export function TokenStep({ tool }: { tool: CatalogTool }) {
  const m = useMessages(botMessages)
  const s = useBotSignIn()
  const key = toolKey(tool.id)
  const shape = tool.bot?.token ?? "opaque"
  const fields = tool.bot?.fields ?? []
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [token, setToken] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // A refused token is gone from the field: the owner pastes the right one, never edits the wrong one.
  useEffect(() => {
    if (s.failure) focusInPlace(input.current)
  }, [s.failure])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (s.checking) return
    const errors: Record<string, string> = {}
    for (const f of fields) {
      const label = m.fields[f.key] ?? f.key
      const p = fieldProblem(s.fields[f.key] ?? "")
      if (p) errors[f.key] = p === "empty" ? m.fieldEmpty(label) : m.fieldDigits(label)
    }
    setFieldErrors(errors)
    const t = tokenProblem(shape, token)
    const tokenWords = t === "empty" ? m.tokenEmpty : t === "spaces" ? m.tokenSpaces : t ? m.tokenShape[key] : null
    setProblem(tokenWords)
    const first = Object.keys(errors)[0]
    if (first) return focusInPlace(document.getElementById(`${id}-${first}`))
    if (tokenWords) return focusInPlace(input.current)
    const typed = token
    setToken("")
    void s.connect(typed)
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby={`${id}-how`} className="flex flex-col gap-2">
        <h3 id={`${id}-how`} className="text-[0.95rem] font-semibold text-ink">
          {m.howTo}
        </h3>
        {key === "tg" ? <TelegramHow m={m} /> : <Steps steps={m.howSteps[key]} />}
        {tool.bot?.create && (
          <div className="self-start">
            <OpenLink url={tool.bot.create}>{m.create[key]}</OpenLink>
          </div>
        )}
        {key === "wa" && (
          <p className="flex items-start gap-2 rounded-[0.35rem] border border-warn/40 bg-warn/10 px-3 py-2 text-[0.88rem] leading-snug text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
            <span>{m.waWarning}</span>
          </p>
        )}
      </section>

      {s.failure && <Failure failure={s.failure} tool={tool} m={m} />}

      <form id={TOKEN_FORM} onSubmit={submit} className="flex max-w-[28rem] flex-col gap-3" noValidate>
        {fields.map((f) => {
          const fid = `${id}-${f.key}`
          const error = fieldErrors[f.key]
          return (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={fid} className="text-[0.95rem] font-medium text-ink">
                {m.fields[f.key] ?? f.key}
              </label>
              <input
                id={fid}
                inputMode="numeric"
                value={s.fields[f.key] ?? ""}
                onChange={(e) => {
                  s.setField(f.key, e.target.value)
                  setFieldErrors(({ [f.key]: _, ...rest }) => rest)
                }}
                disabled={s.checking}
                spellCheck={false}
                autoComplete="off"
                aria-invalid={error !== undefined}
                aria-describedby={error ? `${fid}-error` : undefined}
                className={FIELD}
              />
              {error && (
                <p id={`${fid}-error`} role="alert" className="text-[0.9rem] text-bad">
                  {error}
                </p>
              )}
            </div>
          )
        })}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-token`} className="text-[0.95rem] font-medium text-ink">
            {m.tokenLabel}
          </label>
          <SecretField
            id={`${id}-token`}
            inputRef={input}
            value={token}
            onChange={(v) => {
              setToken(v)
              setProblem(null)
            }}
            disabled={s.checking}
            invalid={problem !== null}
            describedBy={`${id}-token-hint`}
            showLabel={m.showToken}
            hideLabel={m.hideToken}
          />
          <p id={`${id}-token-hint`} className="min-h-[2.6rem] text-[0.9rem] leading-snug">
            {problem ? (
              <span role="alert" className="text-bad">
                {problem}
              </span>
            ) : s.checking ? (
              <span className="text-ink-soft">{m.checking(tool.name)}</span>
            ) : (
              <span className="text-ink-soft">{m.tokenPrivate(tool.bin)}</span>
            )}
          </p>
        </div>
      </form>
    </div>
  )
}

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[0.93rem] leading-snug text-ink marker:text-ink-dim">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  )
}

type HowTab = "new" | "existing"

// The panel holds only the instructions: the token field sits outside it, so a switch never clears what was pasted.
function TelegramHow({ m }: { m: BotMessages }) {
  const [tab, setTab] = useState<HowTab>("new")
  const tabs: { id: HowTab; label: string }[] = [
    { id: "new", label: m.newBot },
    { id: "existing", label: m.existingBot },
  ]
  return (
    <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as HowTab)} className="flex flex-col gap-2">
      <TabList aria-label={m.howTabs} className="flex gap-5 border-line border-b">
        {tabs.map((t) => (
          <Tab
            key={t.id}
            id={t.id}
            className={({ isSelected }) =>
              cx(
                "relative flex h-[2.4rem] cursor-pointer items-center text-[0.93rem] transition-colors duration-(--motion-fast)",
                isSelected ? "font-semibold text-ink" : "text-ink-soft hover:text-ink",
              )
            }
          >
            {({ isSelected }) => (
              <>
                {t.label}
                <span
                  aria-hidden
                  className={cx(
                    "absolute inset-x-0 bottom-0 h-[2px] rounded-t-full bg-brand transition-transform duration-(--motion-fast)",
                    isSelected ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </>
            )}
          </Tab>
        ))}
      </TabList>
      <TabPanel id={tab}>
        <AutoHeight swap={tab}>
          <Crossfade swap={tab}>
            <Steps steps={tab === "new" ? m.howSteps.tg : m.existingSteps} />
          </Crossfade>
        </AutoHeight>
      </TabPanel>
    </Tabs>
  )
}

function Failure({ failure, tool, m }: { failure: BotFailure; tool: CatalogTool; m: BotMessages }) {
  const cause = botCause(failure)
  const words =
    cause === "refused" || cause === "timeout"
      ? m.causes[cause](tool.name)
      : cause === "update"
        ? m.causes.update(tool.bin)
        : cause === "settings"
          ? m.causes.settings
          : m.causes.other
  return (
    <ErrorNotice detail={cause === "update" ? undefined : failure.message}>
      <span className="selectable">{words}</span>
    </ErrorNotice>
  )
}

export function DoneStep({ tool }: { tool: CatalogTool }) {
  const m = useMessages(botMessages)
  const s = useBotSignIn()
  const key = toolKey(tool.id)
  const handle = (s.connected && botHandle(s.connected)) || s.profile
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-[1.05rem] font-semibold text-ink">{m.connected(handle)}</p>
          <p className="text-[0.95rem] text-ink-soft">{m.connectedAs(s.profile)}</p>
        </div>
      </div>
      <section aria-label={m.nextSteps} className="flex flex-col gap-2 border-line border-t pt-3">
        <h3 className="text-[0.95rem] font-semibold text-ink">{m.nextSteps}</h3>
        <p className="text-[0.93rem] leading-snug text-ink">{m.after[key]}</p>
        <p className="text-[0.9rem] text-ink-soft">{m.tryIt}</p>
        <CopyField value={botCommand(tool.bin, s.profile, "me")} label={m.copyCommand} />
        {tool.bot?.docs && (
          <div className="self-start">
            <OpenLink url={tool.bot.docs} variant="ghost">
              {m.guide}
            </OpenLink>
          </div>
        )}
      </section>
    </div>
  )
}
