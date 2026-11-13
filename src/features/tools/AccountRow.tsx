import { LogIn } from "lucide-react"
import { useId, useState } from "react"
import { type CatalogTool, doctorNeedsProfile, syncNeedsProfile, syncSchedules, syncsHere } from "@/domain/catalog"
import { advice } from "@/domain/sync"
import { useMessages } from "@/i18n"
import type { Profile } from "@/platform/schemas"
import { ACCOUNT_NAME_MAX, nameOf, useAccountNames } from "@/shared/account-names-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Pill } from "@/ui/Pill"
import { Skeleton } from "@/ui/Skeleton"
import { type MenuItem, SplitButton } from "@/ui/SplitButton"
import { CheckPanel, useCheck } from "./CheckResult"
import { DriveFoldersSettings } from "./DriveFoldersSettings"
import { MailRules } from "./MailRules"
import { toolsMessages } from "./messages"
import { accountsMessages } from "./messages-accounts"
import { mailRulesMessages } from "./messages-mail-rules"
import { RemoveAccountDialog } from "./RemoveAccount"
import { reconnect } from "./SignInLost"
import { SyncButton, SyncFollowUp, SyncStatus, SyncStatusLoading, useSyncControl } from "./Sync"
import { ScheduleLoading, SyncSchedule } from "./SyncSchedule"

const ROW_BOX = "flex flex-col gap-1.5 px-3 py-2"

/**
 * One account of a tool, the same wherever accounts are listed: its name and state, Sync where the tool syncs per
 * profile, and "⋯" with the rest. What an action answers opens under the row it came from.
 */
export function AccountRow(props: {
  tool: CatalogTool
  profile: Profile
  onReload: () => void
  /** Off on the setup's sign-in step, which leads to the sync itself. */
  sync?: boolean | undefined
  /** The tool forgot this account: the row folds away before the list reloads. */
  leaving?: boolean
  onForgotten?: () => void
}) {
  const { tool, profile: p, onReload, leaving = false, onForgotten = onReload } = props
  const m = useMessages(accountsMessages).row
  const check = useCheck(tool)
  const [folders, setFolders] = useState(false)
  const [rules, setRules] = useState(false)
  const rulesWords = useMessages(mailRulesMessages)
  const [removing, setRemoving] = useState<"remove" | "signOut" | null>(null)
  const [renaming, setRenaming] = useState(false)
  const syncs = (props.sync ?? true) && syncsHere(tool) && syncNeedsProfile(tool) && p.signedIn !== false

  const signIn = () => reconnect(tool, p.name, onReload)

  const items: MenuItem[] = [
    ...(doctorNeedsProfile(tool)
      ? [{ label: check.running ? m.checking : m.check, disabled: check.running, onSelect: () => check.run(p.name) }]
      : []),
    ...(tool.folderPicker && p.signedIn === true ? [{ label: m.folders, onSelect: () => setFolders(true) }] : []),
    ...(tool.mailRules && p.signedIn !== false ? [{ label: rulesWords.menu, onSelect: () => setRules(true) }] : []),
    ...(tool.setup
      ? [
          {
            label: p.signedIn === false ? m.signInAgain : p.signedIn === true ? m.signInFresh : m.signIn,
            onSelect: signIn,
          },
        ]
      : []),
    { label: m.rename, onSelect: () => setRenaming(true) },
    ...(tool.accountRemove?.signOut && p.signedIn !== false
      ? [{ label: m.signOut, onSelect: () => setRemoving("signOut") }]
      : []),
    { label: m.remove, danger: true, onSelect: () => setRemoving("remove") },
  ]

  return (
    <li
      className={cx("transition-colors duration-(--motion-slow)", leaving && "border-transparent")}
      aria-label={m.region(tool.name, p.name)}
    >
      <Collapse open={!leaving} className={ROW_BOX}>
        <RowLine tool={tool} profile={p} syncs={syncs} items={items} onSignIn={signIn} />
        <Collapse open={check.shown}>
          <CheckPanel tool={tool} c={check} onClose={check.clear} />
        </Collapse>
        <Collapse open={folders}>
          <DriveFoldersSettings tool={tool} profile={p.name} onClose={() => setFolders(false)} />
        </Collapse>
        <Collapse open={rules}>
          {rules && <MailRules tool={tool} profile={p.name} onClose={() => setRules(false)} />}
        </Collapse>
        <Collapse open={renaming}>
          {renaming && <Rename tool={tool.id} profile={p.name} onClose={() => setRenaming(false)} />}
        </Collapse>
      </Collapse>
      <RemoveAccountDialog
        tool={tool}
        profile={p.name}
        open={removing !== null}
        signOutOnly={removing === "signOut"}
        onClose={() => setRemoving(null)}
        onRemoved={() => {
          check.clear()
          setFolders(false)
          setRules(false)
          onReload()
        }}
        onForgotten={() => {
          check.clear()
          setFolders(false)
          setRules(false)
          useAccountNames.getState().forget(tool.id, p.name)
          onForgotten()
        }}
        onSignIn={signIn}
      />
    </li>
  )
}

function RowLine(props: {
  tool: CatalogTool
  profile: Profile
  syncs: boolean
  items: MenuItem[]
  onSignIn: () => void
}) {
  const { tool, profile: p, syncs, items, onSignIn } = props
  const m = useMessages(accountsMessages).row
  const health = useMessages(toolsMessages).health
  const menu = <SplitButton compact items={items} menuLabel={m.menu(p.name)} moreLabel={m.more} />
  const state = (
    <>
      {p.signedIn === true && <Pill tone="brand">{health.signedIn}</Pill>}
      {p.signedIn === false && <Pill tone="warn">{health.notSignedIn}</Pill>}
    </>
  )
  const signIn = p.signedIn === false && tool.setup && (
    <Button size="sm" onClick={onSignIn} icon={<LogIn className="size-4" aria-hidden />}>
      {m.signInAgain}
    </Button>
  )
  const name = <AccountName tool={tool.id} profile={p.name} />
  if (!syncs) return <PlainLine name={name} state={state} action={signIn} menu={menu} />
  return <SyncingLine tool={tool} profile={p.name} name={name} state={state} menu={menu} />
}

/** An account row's line without sync. Its placeholder fills the same slots, so both have one height. `name` is
 * the whole name element: the owner's name and the profile id, or a placeholder in the name's font. */
function PlainLine(props: {
  name: React.ReactNode
  state?: React.ReactNode
  action?: React.ReactNode
  menu: React.ReactNode
}) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      {props.name}
      {props.state}
      <span className="flex-1" />
      {props.action}
      {props.menu}
    </div>
  )
}

/**
 * Where a syncing account row puts its parts. The real row and its placeholder both go through it, so the placeholder
 * cannot drift from the row's height when the row changes.
 */
function SyncingFrame(props: {
  label?: string
  place?: string
  name: React.ReactNode
  state?: React.ReactNode
  status: React.ReactNode
  button: React.ReactNode
  menu: React.ReactNode
  followUp?: React.ReactNode
  schedule: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-1.5" data-place={props.place} aria-label={props.label}>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-3">
            {props.name}
            {props.state}
          </div>
          {props.status}
        </div>
        {props.button}
        {props.menu}
      </div>
      {props.followUp}
      {props.schedule}
    </section>
  )
}

/**
 * An account row while the profiles are read, in the row's own frame: name, status line, Sync, "⋯" and the schedule
 * line where the finished row has them.
 */
export function AccountRowPlaceholder(props: {
  tool: CatalogTool
  label?: string | undefined
  sync?: boolean | undefined
}) {
  const { tool, label, sync = true } = props
  const name = (
    <span className="min-w-0 truncate font-medium">
      <Skeleton chars={8} label={label} />
    </span>
  )
  const menu = <Skeleton className="size-8" />
  const syncs = sync && syncsHere(tool) && syncNeedsProfile(tool)
  return (
    <li>
      <div className={ROW_BOX}>
        {syncs ? (
          <SyncingFrame
            name={name}
            status={<SyncStatusLoading />}
            button={<Skeleton className="h-8 w-28" />}
            menu={menu}
            schedule={syncSchedules(tool) && <ScheduleLoading />}
          />
        ) : (
          <PlainLine name={name} menu={menu} />
        )}
      </div>
    </li>
  )
}

/** The row of a profile that syncs: when it last synced under the name, Sync beside the menu. */
function SyncingLine(props: {
  tool: CatalogTool
  profile: string
  name: React.ReactNode
  state: React.ReactNode
  menu: React.ReactNode
}) {
  const { tool, profile, name, state, menu } = props
  const c = useSyncControl(tool, profile)
  const health = useMessages(toolsMessages).health
  // The row's pill reads a local file, so a sign-in the service just refused would still say "signed in".
  const lost = c.run?.phase === "failed" && c.run.failure && advice(c.run.failure).kind === "signedOut"
  return (
    <SyncingFrame
      label={`${tool.name} ${profile}`}
      place={`sync:${tool.id}`}
      name={name}
      state={lost ? <Pill tone="warn">{health.notSignedIn}</Pill> : state}
      status={<SyncStatus c={c} />}
      button={<SyncButton c={c} name={`${tool.name} ${profile}`} />}
      menu={menu}
      followUp={<SyncFollowUp c={c} />}
      schedule={<SyncSchedule tool={tool} profile={profile} />}
    />
  )
}

/** The owner's name for the account when it has one, with the profile id beside it: commands still use the id. */
function AccountName({ tool, profile }: { tool: string; profile: string }) {
  const m = useMessages(accountsMessages).row
  const name = useAccountNames((s) => nameOf(s.names, tool, profile))
  if (!name) return <span className="min-w-0 truncate font-medium">{profile}</span>
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className="shrink-0 font-mono text-[0.85rem] text-ink-dim" title={m.profileId(profile)}>
        {profile}
      </span>
    </span>
  )
}

/** A name of the owner's own, kept by WireCat; the tool and its profile never change. */
function Rename({ tool, profile, onClose }: { tool: string; profile: string; onClose: () => void }) {
  const m = useMessages(accountsMessages).row
  const id = useId()
  const current = useAccountNames((s) => nameOf(s.names, tool, profile))
  const [value, setValue] = useState(current ?? "")
  const save = (name: string) => {
    useAccountNames.getState().rename(tool, profile, name)
    onClose()
  }
  return (
    <form
      className="flex flex-col gap-1.5 pt-1"
      onSubmit={(e) => {
        e.preventDefault()
        save(value)
      }}
    >
      <label htmlFor={id} className="text-[0.9rem] font-medium text-ink">
        {m.renameLabel(profile)}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          // biome-ignore lint/a11y/noAutofocus: the field is what Rename opened
          autoFocus
          value={value}
          maxLength={ACCOUNT_NAME_MAX}
          placeholder={profile}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
          }}
          aria-describedby={`${id}-hint`}
          className="h-9 min-w-[14rem] flex-1 rounded-control border border-line-strong bg-app px-3 text-body text-ink"
        />
        <Button size="sm" variant="primary" type="submit">
          {m.renameSave}
        </Button>
        {current && (
          <Button size="sm" variant="secondary" onClick={() => save("")}>
            {m.renameReset}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>
          {m.renameCancel}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-[0.85rem] text-ink-soft">
        {m.renameHint(profile)}
      </p>
    </form>
  )
}
