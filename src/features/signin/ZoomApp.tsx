import { type FormEvent, type ReactNode, useEffect, useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { openTool, useSync } from "@/features/tools"
import { useMessages } from "@/i18n"
import type { ZoomScope } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { OpenLink } from "@/shared/OpenLink"
import { keptAnswer, type Need, useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { CopyButton } from "@/ui/CopyButton"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { AnswerForm } from "./AnswerForm"
import { signinMessages } from "./messages"
import { setupMessages } from "./messages-setup"
import { wizardMessages } from "./messages-wizard"
import { ZOOM_APP } from "./wizard"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

type AppValues = {
  marketplace: string
  guide: string | null
  redirect: string
  scopes: ZoomScope[]
}

const BUILT_IN: AppValues = {
  marketplace: ZOOM_APP.marketplace,
  guide: null,
  redirect: ZOOM_APP.redirect,
  scopes: ZOOM_APP.scopes.map((scope) => ({ scope, required: true, purpose: "" })),
}

/** zm's own list when it has `zm app` (zoom-cli PR #337); the window's built-in one before it, or while it answers. */
function useAppValues(tool: string | null): AppValues {
  const [values, setValues] = useState(BUILT_IN)
  useEffect(() => {
    if (!tool || !findTool(tool)?.signIn?.appSetup) return
    let live = true
    platform.zoomAppSetup(tool).then(
      (answer) => {
        if (!live || answer.state !== "ready") return
        const { setup } = answer
        setValues({
          marketplace: setup.marketplaceUrl,
          guide: setup.guideUrl,
          redirect: setup.redirectUrl,
          scopes: setup.scopes,
        })
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [tool])
  return values
}

/**
 * Zoom signs in only through an app of the owner's own. Each screen of making it is a step to tick, with the values
 * to copy beside it. A zm that asks for the Public Client ID (`need`) gets the answer on its stdin; an older one fails
 * without it, and the ID is then saved with zm's own `config set` and the sign-in starts again.
 */
export function ZoomAppSetup({ need }: { need?: Need | undefined }) {
  const wm = useMessages(wizardMessages)
  const sm = useMessages(setupMessages)
  const tool = useSignIn((s) => s.tool)
  const values = useAppValues(tool)
  const steps = wm.zoom.steps
  const [ticked, setTicked] = useState<boolean[]>(() => steps.map(() => false))
  const count = ticked.filter(Boolean).length
  const extra: Record<number, ReactNode> = {
    0: (
      <div className="self-start">
        <OpenLink url={values.marketplace}>{wm.zoom.openMarketplace}</OpenLink>
      </div>
    ),
    3: <CopyField value={values.redirect} label={wm.zoom.copyRedirect} />,
    4: <Scopes scopes={values.scopes} />,
  }
  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[1.15rem] font-semibold text-ink">{need ? sm.zoom.askTitle : wm.zoom.title}</h3>
          <p role="status" className="text-body text-ink-soft tabular-nums">
            {wm.zoom.done(count, steps.length)}
          </p>
        </div>
        <p className="text-body leading-snug text-ink-soft">{need ? sm.zoom.askLead : wm.zoom.lead}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {steps.map((text, i) => (
          <Step
            key={text}
            n={i + 1}
            text={text}
            checked={ticked[i] ?? false}
            onChange={(on) => setTicked((t) => t.map((v, j) => (j === i ? on : v)))}
          >
            {extra[i]}
          </Step>
        ))}
      </ol>
      {need ? <ClientIdAnswer need={need} /> : <ClientIdForm />}
      <GuideLink url={values.guide} />
      <NoApp />
    </div>
  )
}

function Step({
  n,
  text,
  checked,
  onChange,
  children,
}: {
  n: number
  text: string
  checked: boolean
  onChange: (on: boolean) => void
  children?: ReactNode
}) {
  const id = useId()
  return (
    <li className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onChange={onChange} className="mt-[0.2rem]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <label
          htmlFor={id}
          className={cx(
            "cursor-pointer text-body leading-snug transition-colors duration-(--motion-fast)",
            checked ? "text-ink-soft" : "text-ink",
          )}
        >
          <span className="mr-1.5 font-mono text-ink-dim tabular-nums">{n}.</span>
          {text}
        </label>
        {children && <div className="max-w-[30rem]">{children}</div>}
      </div>
    </li>
  )
}

/** The scopes sync needs, to copy; the ones only other zm features use are listed apart, never in "copy all". */
function Scopes({ scopes }: { scopes: ZoomScope[] }) {
  const wm = useMessages(wizardMessages)
  const sm = useMessages(setupMessages)
  const required = scopes.filter((s) => s.required)
  const optional = scopes.filter((s) => !s.required)
  const all = sm.zoom.copyRequired(required.length)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 rounded-[0.4rem] border border-line bg-app-2 py-1 pr-1 pl-3">
        {required.map(({ scope, purpose }) => (
          <div key={scope} className="flex items-center gap-2" title={purpose || undefined}>
            <code className="selectable min-w-0 flex-1 truncate font-mono text-[0.875rem] text-ink">{scope}</code>
            <CopyButton value={scope} label={wm.zoom.copyScope(scope)} />
          </div>
        ))}
        <div className="flex items-center justify-end gap-2 border-line border-t pt-1">
          <span className="text-[0.85rem] text-ink-soft">{all}</span>
          <CopyButton value={required.map((s) => s.scope).join("\n")} label={all} />
        </div>
      </div>
      {optional.length > 0 && (
        <Disclosure summary={sm.zoom.optional(optional.length)}>
          <ul className="flex flex-col gap-1">
            {optional.map(({ scope, purpose }) => (
              <li key={scope} className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <code className="selectable truncate font-mono text-[0.85rem] text-ink">{scope}</code>
                  <span className="text-[0.8rem] text-ink-soft">{purpose}</span>
                </span>
                <CopyButton value={scope} label={wm.zoom.copyScope(scope)} />
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  )
}

/** zm asked for the ID in the window: the answer goes to its stdin, and zm saves it only once the sign-in works. */
function ClientIdAnswer({ need }: { need: Need }) {
  const { sent, answer } = useSignIn()
  return (
    <div className="border-line border-t pt-4">
      <AnswerForm need={need} sent={sent} onAnswer={answer} initial={keptAnswer(need.field)} />
    </div>
  )
}

function GuideLink({ url }: { url: string | null }) {
  const wm = useMessages(wizardMessages)
  const catalogGuide = useSignIn((s) => (s.tool ? findTool(s.tool)?.signIn?.guide : undefined))
  const guide = url ?? catalogGuide
  if (!guide) return null
  return (
    <div className="self-start">
      <OpenLink url={guide} variant="ghost">
        {wm.zoom.guide}
      </OpenLink>
    </div>
  )
}

function ClientIdForm() {
  const id = useId()
  const m = useMessages(signinMessages)
  const { tool, profile, start, onFinish, method } = useSignIn()
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tool || !profile) return
    if (!value.trim()) {
      setError(m.clientIdEmpty)
      document.getElementById(id)?.focus()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await platform.settingsSet(tool, null, false, "zoom.client_id", value.trim())
      start(tool, profile, onFinish ?? undefined, method ?? undefined)
    } catch (err) {
      setError(errorText(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-line border-t pt-4 [&>*]:max-w-[26rem]">
      <label htmlFor={id} className="text-[1.1rem] font-medium text-ink">
        {m.clientId}
      </label>
      <input
        id={id}
        spellCheck={false}
        autoComplete="off"
        value={value}
        disabled={saving}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        aria-invalid={error !== null}
        aria-describedby={`${id}-error`}
        className={FIELD}
      />
      <p id={`${id}-error`} role={error ? "alert" : undefined} className="min-h-[1.3rem] text-body text-bad">
        {error}
      </p>
      <Button type="submit" variant="primary" disabled={saving} className="self-start" data-autofocus>
        {saving ? m.saving : m.saveAndSignIn}
      </Button>
    </form>
  )
}

/** zoom-cli's `source files`: each sync reads .vtt transcripts from a folder, with no Zoom app and no sign-in. */
function NoApp() {
  const id = useId()
  const wm = useMessages(wizardMessages)
  const { tool, profile } = useSignIn()
  const [folder, setFolder] = useState("")
  const [zone, setZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tool) return
    if (!folder.trim()) {
      setError(wm.noApp.needFolder)
      document.getElementById(`${id}-folder`)?.focus()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await platform.settingsSet(tool, null, false, "files.folder", folder.trim())
      await platform.settingsSet(tool, null, false, "files.timezone", zone.trim())
      await platform.settingsSet(tool, null, false, "source", "files")
      setSaved(folder.trim())
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Disclosure summary={wm.noApp.summary}>
      {saved ? (
        <div className="flex max-w-[30rem] flex-col gap-2">
          <p role="status" className="text-body text-ink">
            {wm.noApp.saved(saved)}
          </p>
          {tool && profile && <SyncNow tool={tool} profile={profile} />}
        </div>
      ) : (
        <form onSubmit={submit} className="flex max-w-[30rem] flex-col gap-2">
          <p className="text-[0.9rem] leading-snug text-ink-soft">{wm.noApp.text}</p>
          <label htmlFor={`${id}-folder`} className="mt-1 text-[0.9rem] font-medium text-ink">
            {wm.noApp.folder}
          </label>
          <input
            id={`${id}-folder`}
            spellCheck={false}
            autoComplete="off"
            value={folder}
            onChange={(e) => {
              setFolder(e.target.value)
              setError(null)
            }}
            aria-invalid={error !== null}
            aria-describedby={`${id}-hint`}
            className={FIELD}
          />
          <p id={`${id}-hint`} className="text-[0.85rem] text-ink-soft">
            {wm.noApp.folderHint}
          </p>
          <label htmlFor={`${id}-zone`} className="mt-1 text-[0.9rem] font-medium text-ink">
            {wm.noApp.timezone}
          </label>
          <input
            id={`${id}-zone`}
            spellCheck={false}
            autoComplete="off"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={FIELD}
          />
          <p role={error ? "alert" : undefined} className="min-h-[1.3rem] text-[0.9rem] text-bad">
            {error}
          </p>
          <Button type="submit" size="sm" variant="secondary" disabled={saving} className="self-start">
            {saving ? wm.noApp.saving : wm.noApp.save}
          </Button>
        </form>
      )}
    </Disclosure>
  )
}

/** Starts the tool's first sync and shows it on the tool's page, where its progress is drawn. */
export function SyncNow({ tool, profile, primary = false }: { tool: string; profile: string; primary?: boolean }) {
  const wm = useMessages(wizardMessages)
  const entry = findTool(tool)
  if (!entry?.sync?.run) return null
  return (
    <Button
      size="sm"
      variant={primary ? "primary" : "secondary"}
      className="self-start"
      onClick={() => {
        useSync.getState().start(tool, profile)
        useSignIn.getState().close()
        openTool(tool)
      }}
    >
      {wm.next.sync}
    </Button>
  )
}
