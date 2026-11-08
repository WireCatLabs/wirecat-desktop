import { LogIn } from "lucide-react"
import { useState } from "react"
import { type CatalogTool, doctorNeedsProfile, signsInHere, syncNeedsProfile, syncsHere } from "@/domain/catalog"
import { openSettingsAt } from "@/features/config"
import { useMessages } from "@/i18n"
import type { Profile } from "@/platform/schemas"
import { useSignIn } from "@/shared/signin-store"
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
import { SyncButton, SyncFollowUp, SyncStatus, useSyncControl } from "./Sync"
import { useTerminal } from "./terminal-store"

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
  const [removing, setRemoving] = useState(false)
  const syncs = (props.sync ?? true) && syncsHere(tool) && syncNeedsProfile(tool) && p.signedIn !== false

  const signIn = () =>
    signsInHere(tool)
      ? useSignIn.getState().start(tool.id, p.name, onReload)
      : void useTerminal.getState().open(tool.id, p.name)

  const items: MenuItem[] = [
    ...(doctorNeedsProfile(tool)
      ? [{ label: check.running ? m.checking : m.check, disabled: check.running, onSelect: () => check.run(p.name) }]
      : []),
    ...(tool.folderPicker && p.signedIn === true ? [{ label: m.folders, onSelect: () => setFolders(true) }] : []),
    ...(tool.settings?.perProfile ? [{ label: m.settings, onSelect: () => openSettingsAt(tool.id, p.name) }] : []),
    ...(tool.setup && p.signedIn !== true
      ? [{ label: p.signedIn === false ? m.signInAgain : m.signIn, onSelect: signIn }]
      : []),
    { label: m.remove, danger: true, onSelect: () => setRemoving(true) },
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
      </Collapse>
      <RemoveAccountDialog
        tool={tool}
        profile={p.name}
        open={removing}
        onClose={() => setRemoving(false)}
        onRemoved={() => {
          check.clear()
          setFolders(false)
          onReload()
        }}
        onForgotten={() => {
          check.clear()
          setFolders(false)
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
  if (!syncs) {
    return (
      <div className="flex min-h-8 items-center gap-3">
        <span className="min-w-0 truncate font-medium">{p.name}</span>
        {state}
        <span className="flex-1" />
        {signIn}
        {menu}
      </div>
    )
  }
  return (
    <SyncingLine
      tool={tool}
      profile={p.name}
      name={<span className="min-w-0 truncate font-medium">{p.name}</span>}
      state={state}
      menu={menu}
    />
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
  return (
    <section className="flex flex-col gap-1.5" data-place={`sync:${tool.id}`} aria-label={`${tool.name} ${profile}`}>
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-3">
            {name}
            {state}
          </div>
          <SyncStatus c={c} />
        </div>
        <SyncButton c={c} name={`${tool.name} ${profile}`} />
        {menu}
      </div>
      <SyncFollowUp c={c} />
    </section>
  )
}
