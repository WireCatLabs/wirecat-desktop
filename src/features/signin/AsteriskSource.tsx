import { FolderOpen, ShieldCheck } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { isRequired, type SourceField, sourceFields, sourceProblem } from "@/domain/asterisk-source"
import { findTool, signInMethods } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { methodOf, setPassword, useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { Checkbox, Radio } from "@/ui/Checkbox"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useFieldError } from "@/ui/FieldError"
import { SecretField } from "@/ui/SecretField"
import { Numbered } from "./MailSteps"
import { type AsteriskText, asteriskMessages } from "./messages-asterisk"

const FIELD =
  "selectable h-10 w-full rounded-control border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

const typeIn = (field: SourceField, value: string) =>
  useSignIn.setState((s) => ({ source: { ...s.source, [field]: value }, planMissing: null, planError: null }))

/** asterisk's plan: where the call records are, saved as its settings when Start is pressed, and a password if needed. */
export function AsteriskSource() {
  const m = useMessages(asteriskMessages)
  const { tool, method, profile, planError } = useSignIn(
    useShallow((s) => ({ tool: s.tool, method: s.method, profile: s.profile, planError: s.planError })),
  )
  const database = Boolean(tool && methodOf(tool, method)?.stdin)
  const kind = database ? "db" : "csv"
  return (
    <div className="flex min-h-[19rem] flex-col gap-5 text-left">
      <Sources m={m} />
      {/* A new source slides its own fields in (rule 9). */}
      <div key={method ?? ""} className="step-in flex flex-col gap-5">
        <section className="flex max-w-[30rem] flex-col gap-3">
          {sourceFields(method).map((field) => (
            <SourceInput key={field} field={field} m={m} />
          ))}
          {database && <Password m={m} />}
          {planError && <ErrorNotice>{planError}</ErrorNotice>}
        </section>
        <section className="flex flex-col gap-2.5">
          <h3 className="text-[1.15rem] font-semibold text-ink">{m.what}</h3>
          <ol className="flex flex-col gap-2">
            {m.steps[kind].map((text, i) => (
              <li key={text} className="flex items-start gap-3">
                <Numbered i={i} />
                <span className="text-body leading-snug text-ink">{text}</span>
              </li>
            ))}
          </ol>
          <p className="text-[0.9rem] leading-snug text-ink-soft">{m.more}</p>
          {profile && <p className="selectable text-[0.9rem] leading-snug text-ink-soft">{m.transcribe(profile)}</p>}
        </section>
      </div>
      <section className="flex flex-col gap-2 border-line border-t pt-4">
        <ul className="flex flex-col gap-1.5">
          {m.kept[kind].map((line) => (
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

function Sources({ m }: { m: AsteriskText }) {
  const { tool, method } = useSignIn(useShallow((s) => ({ tool: s.tool, method: s.method })))
  const name = useId()
  const entry = tool ? findTool(tool) : undefined
  if (!entry) return null
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[1rem] font-semibold text-ink">{m.pick}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {signInMethods(entry).map((option) => {
          const text = m.sources[option.id]
          const id = `${name}-${option.id}`
          return (
            <label
              key={option.id}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-2.5 rounded-control border border-line-strong px-3 py-2.5 has-checked:border-brand has-checked:bg-brand-soft"
            >
              <Radio
                id={id}
                name={name}
                checked={option.id === method}
                onChange={() => useSignIn.setState({ method: option.id, planMissing: null, planError: null })}
                className="mt-[0.2rem]"
              />
              <span className="flex flex-col gap-0.5">
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

function SourceInput({ field, m }: { field: SourceField; m: AsteriskText }) {
  const id = useId()
  const value = useSignIn((s) => s.source[field] ?? "")
  const bad = useSignIn((s) => {
    const problem = s.planMissing === "source" ? sourceProblem(s.method, s.source) : null
    return problem?.field === field ? problem.kind : null
  })
  const said = bad === "port" ? m.portWrong : bad === "empty" ? m.needField : null
  const need = useFieldError(id, { live: { problem: said } })
  const fail = need.fail
  useEffect(() => {
    if (said) fail()
  }, [said, fail])
  const text = m.fields[field]
  if (!text) return null
  if (field === "db_tls")
    return (
      <div className="flex items-start gap-2.5">
        <Checkbox
          id={id}
          checked={value === "true"}
          onChange={(on) => typeIn(field, String(on))}
          className="mt-[0.2rem]"
        />
        <label htmlFor={id} className="flex flex-col gap-0.5">
          <span className="text-[0.9rem] font-medium text-ink">{text.label}</span>
          <span className="text-[0.85rem] text-ink-soft">{text.hint}</span>
        </label>
      </div>
    )
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.9rem] font-medium text-ink">
        {text.label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          spellCheck={false}
          autoComplete="off"
          inputMode={field === "db_port" ? "numeric" : undefined}
          required={isRequired(field)}
          value={value}
          onChange={(e) => typeIn(field, e.target.value)}
          {...need.field}
          aria-describedby={need.field["aria-describedby"] ?? `${id}-hint`}
          className={FIELD}
        />
        {field === "recordings_path" && <PickFolder field={field} label={m.chooseFolder} />}
      </div>
      {need.hint}
      <p id={`${id}-hint`} className="text-[0.85rem] text-ink-soft">
        {text.hint}
      </p>
    </div>
  )
}

function PickFolder({ field, label }: { field: SourceField; label: string }) {
  const [busy, setBusy] = useState(false)
  const pick = async () => {
    setBusy(true)
    try {
      const path = await platform.notesPickFolder()
      if (path !== null) typeIn(field, path)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button
      variant="secondary"
      busy={busy}
      icon={<FolderOpen className="size-4" aria-hidden />}
      onClick={() => void pick()}
      className="shrink-0"
    >
      {label}
    </Button>
  )
}

/** The password stays outside the store and reaches asterisk only on its stdin. */
function Password({ m }: { m: AsteriskText }) {
  const id = useId()
  const missing = useSignIn((s) => s.planMissing === "password")
  const [value, setValue] = useState("")
  const need = useFieldError(id, { live: { problem: missing ? m.needPassword : null } })
  const fail = need.fail
  useEffect(() => {
    if (missing) fail()
  }, [missing, fail])
  // A new try or a switch of source starts with the field and what the run sends both empty.
  useEffect(() => setPassword(""), [])
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.9rem] font-medium text-ink">
        {m.password}
      </label>
      <SecretField
        id={id}
        value={value}
        onChange={(next) => {
          setValue(next)
          setPassword(next)
          useSignIn.setState({ planMissing: null, planError: null })
        }}
        showLabel={m.show}
        hideLabel={m.hide}
        invalid={need.error !== null}
        {...(need.error !== null ? { describedBy: `${id}-error` } : {})}
      />
      {need.hint}
    </div>
  )
}
