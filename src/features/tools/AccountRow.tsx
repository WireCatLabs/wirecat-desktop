import { LogIn } from "lucide-react"
import { useId, useState } from "react"
import { type CatalogTool, doctorNeedsProfile, syncNeedsProfile, syncsHere } from "@/domain/catalog"
import { advice } from "@/domain/sync"
import { openSettingsAt } from "@/features/config"
import { useMessages } from "@/i18n"
import type { Profile } from "@/platform/schemas"
import { ACCOUNT_NAME_MAX, nameOf, useAccountNames } from "@/shared/account-names-store"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { Pill } from "@/ui/Pill"
import { type MenuItem, SplitButton } from "@/ui/SplitButton"
import { CheckPanel, useCheck } from "./CheckResult"
import { DriveFoldersSettings } from "./DriveFoldersSettings"
import { toolsMessages } from "./messages"
import { accountsMessages } from "./messages-accounts"
import { RemoveAccountDialog } from "./RemoveAccount"
import { reconnect } from "./SignInLost"
import { SyncButton, SyncFollowUp, SyncStatus, useSyncControl } from "./Sync"
import { SyncSchedule } from "./SyncSchedule"

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
  const [removing, setRemoving] = useState<"remove" | "signOut" | null>(null)
  const [renaming, setRenaming] = useState(false)
  const syncs = (props.sync ?? true) && syncsHere(tool) && syncNeedsProfile(tool) && p.signedIn !== false

  const signIn = () => reconnect(tool, p.name, onReload)

  const items: MenuItem[] = [
    ...(doctorNeedsProfile(tool)
      ? [{ label: check.running ? m.checking : m.check, disabled: check.running, onSelect: () => check.run(p.name) }]
      : []),
    ...(tool.folderPicker && p.signedIn === true ? [{ label: m.folders, onSelect: () => setFolders(true) }] : []),
    ...(tool.settings?.perProfile ? [{ label: m.settings, onSelect: () => openSettingsAt(tool.id, p.name) }] : []),
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
      <Collapse open={!leaving} className="flex flex-col gap-1.5 px-3 py-2">
        <RowLine tool={tool} profile={p} syncs={syncs} items={items} onSignIn={signIn} />
        <Collapse open={check.shown}>
          <CheckPanel tool={tool} c={check} onClose={check.clear} />
        </Collapse>
        <Collapse open={folders}>
          <DriveFoldersSettings tool={tool} profile={p.name} onClose={() => setFolders(false)} />
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
          onReload()
        }}
        onForgotten={() => {
          check.clear()
          setFolders(false)
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
    <Button size="sm" variant="primary" onClick={onSignIn} icon={<LogIn className="size-4" aria-hidden />}>
      {m.signInAgain}
    </Button>
  )
  const name = <AccountName tool={tool.id} profile={p.name} />
  if (!syncs) {
    return (
      <div className="flex min-h-8 items-center gap-3">
        {name}
        {state}
        <span className="flex-1" />
        {signIn}
        {menu}
      </div>
    )
  }
  return <SyncingLine tool={tool} profile={p.name} name={name} state={state} menu={menu} />
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
    <section className="flex flex-col gap-1.5" data-place={`sync:${tool.id}`} aria-label={`${tool.name} ${profile}`}>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-3">
            {name}
            {lost ? <Pill tone="warn">{health.notSignedIn}</Pill> : state}
          </div>
          <SyncStatus c={c} />
        </div>
        <SyncButton c={c} name={`${tool.name} ${profile}`} />
        {menu}
      </div>
      <SyncFollowUp c={c} />
      <SyncSchedule tool={tool} profile={profile} />
    </section>
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
          className="h-9 min-w-[14rem] flex-1 rounded-[0.35rem] border border-line-strong bg-app px-3 text-body text-ink"
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
