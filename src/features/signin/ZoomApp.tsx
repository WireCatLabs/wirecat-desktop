import { ExternalLink } from "lucide-react"
import { type FormEvent, type ReactNode, useId, useState } from "react"
import { findTool } from "@/domain/catalog"
import { openTool, useSync } from "@/features/tools"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { Checkbox } from "@/ui/Checkbox"
import { CopyButton } from "@/ui/CopyButton"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { Disclosure } from "@/ui/Disclosure"
import { signinMessages } from "./messages"
import { wizardMessages } from "./messages-wizard"
import { ZOOM_APP } from "./wizard"

const FIELD =
  "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 font-mono text-[1rem] text-ink aria-[invalid=true]:border-bad"

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Zoom signs in only through an app of the owner's own. Each screen of making it is a step to tick, with the values
 * to copy beside it; its Public Client ID is then saved with zm's own `config set` and the sign-in starts again.
 */
export function ZoomAppSetup() {
  const wm = useMessages(wizardMessages)
  const steps = wm.zoom.steps
  const [ticked, setTicked] = useState<boolean[]>(() => steps.map(() => false))
  const count = ticked.filter(Boolean).length
  const extra: Record<number, ReactNode> = {
    0: (
      <Button
        size="sm"
        variant="secondary"
        icon={<ExternalLink className="size-4" aria-hidden />}
        onClick={() => platform.openUrl(ZOOM_APP.marketplace)}
      >
        {wm.zoom.openMarketplace}
      </Button>
    ),
    3: <CopyField value={ZOOM_APP.redirect} label={wm.zoom.copyRedirect} />,
    4: <Scopes />,
  }
  return (
    <div className="flex flex-col gap-4 text-left">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[1.15rem] font-semibold text-ink">{wm.zoom.title}</h3>
          <p role="status" className="text-body text-ink-soft tabular-nums">
            {wm.zoom.done(count, steps.length)}
          </p>
        </div>
        <p className="text-body leading-snug text-ink-soft">{wm.zoom.lead}</p>
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
      <ClientIdForm />
      <GuideLink />
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

function Scopes() {
  const wm = useMessages(wizardMessages)
  return (
    <div className="flex flex-col gap-1 rounded-[0.4rem] border border-line bg-app-2 py-1 pr-1 pl-3">
      {ZOOM_APP.scopes.map((scope) => (
        <div key={scope} className="flex items-center gap-2">
          <code className="selectable min-w-0 flex-1 truncate font-mono text-[0.875rem] text-ink">{scope}</code>
          <CopyButton value={scope} label={wm.zoom.copyScope(scope)} />
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 border-line border-t pt-1">
        <span className="text-[0.85rem] text-ink-soft">{wm.zoom.copyScopes}</span>
        <CopyButton value={ZOOM_APP.scopes.join("\n")} label={wm.zoom.copyScopes} />
      </div>
    </div>
  )
}

function GuideLink() {
  const wm = useMessages(wizardMessages)
  const guide = useSignIn((s) => (s.tool ? findTool(s.tool)?.signIn?.guide : undefined))
  if (!guide) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="self-start"
      icon={<ExternalLink className="size-4" aria-hidden />}
      onClick={() => platform.openUrl(guide)}
    >
      {wm.zoom.guide}
    </Button>
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
      setError(message(err))
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
      setError(message(err))
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
