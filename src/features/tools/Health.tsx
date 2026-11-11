import { CheckCircle2, QrCode, RefreshCw, Stethoscope, Terminal } from "lucide-react"
import { type ReactNode, useRef, useState } from "react"
import {
  type CatalogTool,
  doctorNeedsProfile,
  isValidProfile,
  setupCommand,
  signsInHere,
  syncNeedsProfile,
  usesProfiles,
} from "@/domain/catalog"
import { useMessages } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import { ReportThis } from "@/shared/ReportThis"
import { useSignIn } from "@/shared/signin-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { CopyField } from "@/ui/CopyField"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { focusInPlace, MOTION, PANEL_MS, reducedMotion } from "@/ui/motion"
import { Skeleton } from "@/ui/Skeleton"
import { AccountRow } from "./AccountRow"
import { useProfiles } from "./api"
import { BotList } from "./BotList"
import { CheckPanel, useCheck } from "./CheckResult"
import { toolsMessages } from "./messages"
import { accountsMessages } from "./messages-accounts"
import { SyncControl } from "./Sync"
import { useTerminal } from "./terminal-store"
import { toolText } from "./tool-text"

export function Health({ tool }: { tool: CatalogTool }) {
  const { profiles, error: profilesError, loading: reloading, reload } = useProfiles(tool.id)
  // The tool's own check, for a tool whose doctor takes no profile; a profile's check opens under its row.
  const check = useCheck(tool)
  const t = useMessages(toolsMessages)
  const m = t.health
  const note = toolText(t, tool).syncNote
  const toolWide = !usesProfiles(tool) || !doctorNeedsProfile(tool)

  return (
    <section
      aria-label={m.section(tool.name)}
      data-place={`accounts:${tool.id}`}
      className="flex min-w-0 flex-col gap-3"
    >
      <h4 className="text-[1.02rem] font-semibold text-ink">{usesProfiles(tool) ? m.accounts : m.health}</h4>

      {toolWide && (
        <div className="flex flex-col gap-2">
          <div>
            <Button
              size="sm"
              onClick={() => check.run(null)}
              disabled={check.running}
              icon={<Stethoscope className="size-4" aria-hidden />}
            >
              {check.running ? m.checking : m.checkHealth}
            </Button>
          </div>
          <Collapse open={check.shown}>
            <CheckPanel tool={tool} c={check} onClose={check.clear} />
          </Collapse>
        </div>
      )}

      {usesProfiles(tool) && (
        <ProfileList tool={tool} profiles={profiles} error={profilesError} onReload={reload} reloading={reloading} />
      )}

      {tool.sync && !syncNeedsProfile(tool) && tool.sync.run && <SyncControl tool={tool} profile={null} />}
      {note && <p className="text-[0.875rem] text-ink-soft">{withCode(note)}</p>}
    </section>
  )
}

function ProfileList(props: {
  tool: CatalogTool
  profiles: Profile[] | null | undefined
  error: string | null
  onReload: () => void
  reloading: boolean
}) {
  const { tool, profiles, error, onReload, reloading } = props
  const m = useMessages(toolsMessages).health
  if (error) {
    return (
      <ErrorNotice inline action={<ReportThis what={`Listing ${tool.name} profiles`} tool={tool.id} error={error} />}>
        {m.profilesFailed(error)}
      </ErrorNotice>
    )
  }
  return (
    <div className="@container flex flex-col gap-2">
      <div
        className={cx("grid items-start gap-x-8 gap-y-2", tool.bot && "@4xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]")}
      >
        <div className="flex min-w-0 flex-col gap-2">
          {profiles === undefined ? (
            <ul className="divide-y divide-line overflow-hidden rounded-[0.45rem] border border-line bg-app">
              {[0, 1].map((n) => (
                // A profile row with its sync line is taller, so the placeholder takes that height.
                <li
                  key={n}
                  className={cx(
                    "flex box-content flex-col justify-center gap-[0.4rem] px-3 py-2",
                    syncNeedsProfile(tool) ? "h-[3.4rem]" : "h-8",
                  )}
                >
                  <Skeleton className="h-4 w-28" label={n === 0 ? m.loadingProfiles : ""} />
                  {syncNeedsProfile(tool) && <Skeleton className="h-4 w-44" />}
                </li>
              ))}
            </ul>
          ) : profiles && profiles.length > 0 ? (
            <AccountList tool={tool} profiles={profiles} onReload={onReload} />
          ) : (
            <p className="text-[0.95rem] font-medium text-ink">
              {tool.setup
                ? signsInHere(tool)
                  ? m.noAccountHere(tool.name)
                  : m.noAccountTerminal(tool.name)
                : m.noAccount}
            </p>
          )}
          {tool.setup && <NewProfile tool={tool} onCheck={onReload} />}
        </div>
        {tool.bot && <BotList tool={tool} />}
      </div>
      {tool.setup && <TerminalStatus tool={tool} profiles={profiles} onCheck={onReload} checking={reloading} />}
      {!tool.setup && <ManualSetup tool={tool} onCheck={onReload} checking={reloading} />}
    </div>
  )
}

/** Every profile of a tool, each as the same row; the setup's sign-in step lists them the same way. */
export function AccountList(props: { tool: CatalogTool; profiles: Profile[]; onReload: () => void; sync?: boolean }) {
  const { tool, profiles, onReload, sync } = props
  const m = useMessages(accountsMessages).row
  const list = useRef<HTMLUListElement>(null)
  // Names the tool forgot, until the reload brings a new list: a name it still lists then opens again.
  const [leaving, setLeaving] = useState<{ names: string[]; from: Profile[] }>({ names: [], from: profiles })
  const gone = leaving.from === profiles ? leaving.names : []
  const forget = (name: string) => {
    setLeaving({ names: [...gone, name], from: profiles })
    // After the dialog has closed: while it is open, nothing outside it takes focus.
    setTimeout(
      () => {
        list.current?.focus({ preventScroll: true })
        onReload()
      },
      reducedMotion() ? MOTION.exit : PANEL_MS,
    )
  }
  return (
    <ul
      ref={list}
      tabIndex={-1}
      aria-label={m.list(tool.name)}
      className="divide-y divide-line rounded-[0.45rem] border border-line bg-app outline-none"
    >
      {profiles.map((p) => (
        <AccountRow
          key={p.name}
          tool={tool}
          profile={p}
          onReload={onReload}
          sync={sync}
          leaving={gone.includes(p.name)}
          onForgotten={() => forget(p.name)}
        />
      ))}
    </ul>
  )
}

/** What became of the last sign-in handed to a terminal for this tool: opened, the browser preview, or no terminal. */
export function TerminalStatus({
  tool,
  profiles,
  onCheck,
  checking,
}: {
  tool: CatalogTool
  profiles: Profile[] | null | undefined
  onCheck: () => void
  checking: boolean
}) {
  const m = useMessages(toolsMessages).health
  const opened = useTerminal((s) => s.byTool[tool.id])
  if (!opened) return null
  if (profiles?.some((p) => p.name === opened.profile && p.signedIn === true))
    return (
      <p role="status" className="reveal flex items-center gap-2 text-[0.9rem] text-ink">
        <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />
        {m.signedInNow(opened.profile, tool.name)}
      </p>
    )
  const command = setupCommand(tool, opened.profile) ?? ""
  const code = <code className="font-mono whitespace-nowrap text-ink">{command}</code>
  const check = (
    <Button
      size="sm"
      variant="secondary"
      onClick={onCheck}
      icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
    >
      {checking ? m.checking : m.checkSignIn}
    </Button>
  )
  if (opened.state === "failed") {
    const noTerminal = opened.error.startsWith("Could not open a terminal")
    return (
      <div role="status" className="reveal flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 text-[0.9rem] text-ink-soft">
            {noTerminal ? m.noTerminal : `${m.terminalFailed} ${opened.error}`}
          </p>
          <ReportThis what="Opening a terminal to sign in" tool={tool.id} command={command} error={opened.error} />
        </div>
        {command && <CopyField value={command} label={m.copySetup} />}
        <div>{check}</div>
      </div>
    )
  }
  return (
    <div className="reveal flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[0.35rem] bg-brand-soft/60 px-3 py-2">
      <p role="status" className="min-w-0 flex-1 text-[0.9rem] leading-snug text-ink">
        {opened.state === "preview" ? m.terminalPreview(code) : m.finishInTerminal(code)}
      </p>
      {check}
    </div>
  )
}

/** For a tool whose CLI has no interactive sign-in yet: the command to run, which the app never runs itself. */
export function ManualSetup(props: { tool: CatalogTool; onCheck: () => void; checking: boolean }) {
  const { tool, onCheck, checking } = props
  const signIn = tool.signIn
  const m = useMessages(toolsMessages).health
  if (!signIn?.command) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.9rem] leading-snug text-ink-soft">
        {m.manual}{" "}
        {signIn.guide && (
          <a
            href={signIn.guide}
            onClick={(e) => {
              e.preventDefault()
              if (signIn.guide) platform.openUrl(signIn.guide)
            }}
            className="font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4"
          >
            {m.howToSetUp}
          </a>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <CopyField value={signIn.command} label={m.copyAddAccount(tool.name)} />
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCheck}
          disabled={checking}
          icon={<RefreshCw className={cx("size-4", checking && "animate-spin")} aria-hidden />}
        >
          {checking ? m.checking : m.checkAgain}
        </Button>
      </div>
    </div>
  )
}

export function NewProfile(props: { tool: CatalogTool; onCheck: () => void; label?: string }) {
  const m = useMessages(toolsMessages).health
  const { tool, label = m.profileName } = props
  const [name, setName] = useState("")
  const [tried, setTried] = useState(false)
  const valid = isValidProfile(name)
  const problem = name === "" ? (tried ? m.nameEmpty : null) : valid ? null : m.nameInvalid
  const refuse = () => {
    setTried(true)
    focusInPlace(document.getElementById(id))
  }
  const id = `profile-${tool.id}`
  const open = () => useTerminal.getState().open(tool.id, name)

  const here = signsInHere(tool)

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return refuse()
        if (here) useSignIn.getState().start(tool.id, name, props.onCheck)
        else open()
      }}
    >
      <h5 id={`${id}-title`} className="text-[0.9rem] font-medium text-ink">
        {label}
        <span className="sr-only">, {tool.name}</span>
      </h5>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={name}
          onChange={(e) => {
            setName(e.target.value.trim())
            useTerminal.getState().clear(tool.id)
          }}
          aria-label={`${m.accountName}, ${tool.name}`}
          placeholder={m.accountName}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={problem !== null}
          aria-describedby={`${id}-hint`}
          className="h-8 min-w-[9rem] flex-1 rounded-[0.35rem] border border-line-strong bg-app px-2.5 font-mono text-[0.875rem] text-ink aria-[invalid=true]:border-bad"
        />
        {here && (
          <Button size="sm" variant="primary" type="submit" icon={<QrCode className="size-4" aria-hidden />}>
            {m.signInHere}
          </Button>
        )}
        <Button
          size="sm"
          variant={here ? "secondary" : "primary"}
          type={here ? "button" : "submit"}
          onClick={here ? () => (valid ? open() : refuse()) : undefined}
          icon={<Terminal className="size-4" aria-hidden />}
        >
          {here ? m.openTerminal : m.openTerminalToSignIn}
        </Button>
      </div>
      {problem ? (
        <p id={`${id}-hint`} role="alert" className="text-[0.9rem] text-bad">
          {problem}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-[0.9rem] leading-snug text-ink-soft">
          {(here ? m.nameHintHere : m.nameHintTerminal)(
            <code className="font-mono whitespace-nowrap text-ink">{setupCommand(tool, valid ? name : "<name>")}</code>,
          )}
        </p>
      )}
    </form>
  )
}

/** tools.json and its translations mark a command with backticks, as the CLIs' own notes do. */
export function withCode(text: string): ReactNode[] {
  let at = 0
  return text.split("`").map((part, i) => {
    const start = at
    at += part.length + 1
    if (i % 2 === 0) return part
    return (
      <code key={start} className="selectable font-mono text-[0.85rem] text-ink">
        {part}
      </code>
    )
  })
}
