import { AlertTriangle, ArrowUpCircle, CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { type CatalogTool, catalogCommand } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { AccountRemoval, AccountRemoved, Removal, RemovalEntry, RemovalKind } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { AutoHeight } from "@/ui/AutoHeight"
import { BackButton } from "@/ui/BackButton"
import { Button } from "@/ui/Button"
import { Crossfade } from "@/ui/Crossfade"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { type AccountsText, accountsMessages, type DataWhat } from "./messages-accounts"

type Refused = Extract<AccountRemoval, { result: "refused" }>

type Phase =
  | { step: "checking" }
  | { step: "choose" }
  | { step: "planning"; del: boolean }
  | { step: "plan"; del: boolean; removal: Removal }
  | { step: "removing"; del: boolean; removal: Removal }
  | { step: "removed"; removal: Removal }
  | { step: "refused"; del: boolean; answer: Refused }
  /** The installed tool has no `account remove`: today's sign-out, with the update that brings the rest. */
  | { step: "old" }
  | { step: "signingOut" }
  | { step: "signedOut"; result: AccountRemoved }

const dataWhat = (tool: CatalogTool): DataWhat => {
  const what = tool.sync?.what
  if (what === "files" || what === "meetings" || what === "mail") return what
  return tool.id === "gcal" ? "events" : "messages"
}

const failed = (e: unknown): Refused => ({
  result: "refused",
  reason: "failed",
  holder: null,
  message: e instanceof Error ? e.message : String(e),
})

/**
 * Removing one account, only through the tool's own commands. With `account remove` the owner chooses to keep or delete
 * its data, sees the tool's own dry run, then confirms; an older tool only signs out.
 */
export function RemoveAccountDialog(props: {
  tool: CatalogTool
  profile: string
  open: boolean
  onClose: () => void
  /** The sign-out ended the sign-in; the account stays listed. */
  onRemoved: () => void
  /** The tool forgot the account: the row leaves once the dialog is closed. */
  onForgotten: () => void
  onSignIn: () => void
}) {
  const { tool, profile, open, onClose, onRemoved, onForgotten, onSignIn } = props
  const m = useMessages(accountsMessages).remove
  const [phase, setPhase] = useState<Phase>({ step: "checking" })
  // A late answer from an earlier opening, or an earlier step, must not land in this one.
  const run = useRef(0)
  const what = m.what[dataWhat(tool)]

  useEffect(() => {
    const n = ++run.current
    if (!open) return
    setPhase({ step: "checking" })
    platform
      .accountRemoveSupported(tool.id)
      .catch(() => false)
      .then((full) => n === run.current && setPhase({ step: full ? "choose" : "old" }))
  }, [open, tool.id])

  const answered = (n: number, del: boolean, a: AccountRemoval, done: (removal: Removal) => Phase) => {
    if (n !== run.current) return
    if (a.result === "tooOld") setPhase({ step: "old" })
    else if (a.result === "refused") setPhase({ step: "refused", del, answer: a })
    else setPhase(done(a.removal))
  }

  const plan = (del: boolean) => {
    const n = ++run.current
    setPhase({ step: "planning", del })
    platform
      .accountRemovePlan(tool.id, profile, del)
      .catch(failed)
      .then((a) => answered(n, del, a, (removal) => ({ step: "plan", del, removal })))
  }

  const remove = (del: boolean, removal: Removal) => {
    const n = ++run.current
    setPhase({ step: "removing", del, removal })
    platform
      .accountRemove(tool.id, profile, del)
      .catch(failed)
      .then((a) => answered(n, del, a, (done) => ({ step: "removed", removal: done })))
  }

  const signOut = async () => {
    setPhase({ step: "signingOut" })
    let result: AccountRemoved
    try {
      result = await platform.accountSignOut(tool.id, profile)
    } catch (e) {
      result = { result: "failed", message: e instanceof Error ? e.message : String(e) }
    }
    setPhase({ step: "signedOut", result })
    if (result.result === "signedOut") onRemoved()
  }

  const busy = phase.step === "removing" || phase.step === "signingOut"
  const close = () => {
    if (busy) return
    onClose()
    const gone = phase.step === "removed" || (phase.step === "refused" && phase.answer.reason === "unknownProfile")
    if (gone) onForgotten()
  }

  return (
    <Dialog
      open={open}
      title={m.title(profile)}
      onClose={close}
      actions={
        <Actions
          tool={tool}
          profile={profile}
          phase={phase}
          m={m}
          on={{ close, plan, remove, signOut, onSignIn, back: () => setPhase({ step: "choose" }) }}
        />
      }
      wide
    >
      <AutoHeight swap={phase.step}>
        <Crossfade swap={phase.step}>
          <div aria-live="polite" className="flex flex-col gap-3">
            <Body tool={tool} profile={profile} phase={phase} what={what} m={m} onChoose={plan} />
          </div>
        </Crossfade>
      </AutoHeight>
    </Dialog>
  )
}

type Handlers = {
  close: () => void
  plan: (del: boolean) => void
  remove: (del: boolean, removal: Removal) => void
  signOut: () => void
  onSignIn: () => void
  back: () => void
}

function Actions(props: { tool: CatalogTool; profile: string; phase: Phase; m: AccountsText["remove"]; on: Handlers }) {
  const { tool, profile, phase, m, on } = props
  const signOutWords = tool.accountRemove?.signOut ?? null
  const spinner = <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
  switch (phase.step) {
    case "checking":
    case "choose":
    case "planning":
      return (
        <Button variant="secondary" onClick={on.close} autoFocus={phase.step !== "choose"}>
          {m.cancel}
        </Button>
      )
    case "plan":
    case "removing": {
      const label = phase.del ? m.confirmDelete(profile) : m.confirmKeep(profile)
      const running = phase.step === "removing"
      return (
        <>
          <BackButton onClick={on.back} reason={running ? m.removing : undefined} />
          <Button variant="secondary" onClick={on.close} aria-disabled={running || undefined}>
            {m.cancel}
          </Button>
          <Button
            variant="danger"
            aria-disabled={running || undefined}
            onClick={running ? () => undefined : () => on.remove(phase.del, phase.removal)}
          >
            {running && spinner}
            {running ? m.removing : label}
          </Button>
        </>
      )
    }
    case "removed":
      return (
        <Button variant="primary" onClick={on.close} autoFocus>
          {m.finish}
        </Button>
      )
    case "refused":
      return (
        <>
          <BackButton onClick={on.back} />
          <Button variant="ghost" onClick={on.close}>
            {m.close}
          </Button>
          {phase.answer.reason !== "unknownProfile" && (
            <Button variant="secondary" onClick={() => on.plan(phase.del)} autoFocus>
              {m.tryAgain}
            </Button>
          )}
        </>
      )
    case "old":
      return signOutWords ? (
        <>
          <Button variant="secondary" onClick={on.close} autoFocus>
            {m.cancel}
          </Button>
          <Button variant="danger" onClick={on.signOut}>
            {m.confirm}
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={on.close} autoFocus>
          {m.close}
        </Button>
      )
    case "signingOut":
      return (
        <Button variant="danger" aria-disabled onClick={() => undefined}>
          {spinner}
          {m.running}
        </Button>
      )
    case "signedOut":
      return phase.result.result === "signedOut" ? (
        <>
          {tool.setup && (
            <Button
              variant="ghost"
              onClick={() => {
                on.close()
                on.onSignIn()
              }}
            >
              {m.signInAgain}
            </Button>
          )}
          <Button variant="primary" onClick={on.close} autoFocus>
            {m.finish}
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={on.close}>
            {m.close}
          </Button>
          <Button variant="secondary" onClick={on.signOut} autoFocus>
            {m.tryAgain}
          </Button>
        </>
      )
  }
}

function Body(props: {
  tool: CatalogTool
  profile: string
  phase: Phase
  what: string
  m: AccountsText["remove"]
  onChoose: (del: boolean) => void
}) {
  const { tool, profile, phase, what, m, onChoose } = props
  switch (phase.step) {
    case "checking":
      return <Waiting>{m.checking(tool.name)}</Waiting>
    case "choose":
      return (
        <>
          <p>{m.lead(tool.name)}</p>
          <div className="grid gap-2">
            <ChoiceButton
              title={m.keepChoice}
              note={m.keepChoiceNote(what)}
              onClick={() => onChoose(false)}
              autoFocus
            />
            <ChoiceButton
              title={m.deleteChoice}
              note={m.deleteChoiceNote(what)}
              onClick={() => onChoose(true)}
              danger
            />
          </div>
        </>
      )
    case "planning":
      return <Waiting>{m.planning}</Waiting>
    case "plan":
    case "removing":
      return <Plan tool={tool} profile={profile} del={phase.del} removal={phase.removal} what={what} m={m} />
    case "removed":
      return <Removed tool={tool} profile={profile} removal={phase.removal} what={what} m={m} />
    case "refused":
      return <Refusal tool={tool} profile={profile} answer={phase.answer} m={m} />
    case "old":
      return <SignOutChoice tool={tool} profile={profile} m={m} />
    case "signingOut":
      return <Waiting>{m.running}</Waiting>
    case "signedOut":
      return phase.result.result === "signedOut" ? (
        <p className="flex items-start gap-2 text-ink">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
          <span>{phase.result.wasSignedIn ? m.done(profile, tool.name) : m.wasOut(profile)}</span>
        </p>
      ) : (
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
          <span>
            <span className="font-medium text-ink">{m.failed}</span> {phase.result.message}
          </span>
        </p>
      )
  }
}

function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-ink-soft">
      <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
      {children}
    </p>
  )
}

function ChoiceButton(props: {
  title: string
  note: string
  onClick: () => void
  danger?: boolean
  autoFocus?: boolean
}) {
  const { title, note, onClick, danger = false, autoFocus } = props
  return (
    <button
      type="button"
      onClick={onClick}
      data-autofocus={autoFocus || undefined}
      className={cx(
        "flex flex-col gap-1 rounded-[0.45rem] border border-line bg-app px-3 py-2.5 text-left transition-colors duration-(--motion-fast)",
        "hover:border-brand/50 hover:bg-brand-soft/40 focus-visible:border-brand",
        danger && "hover:border-bad/50 hover:bg-bad/5 focus-visible:border-bad",
      )}
    >
      <span className={cx("font-medium", danger ? "text-bad" : "text-ink")}>{title}</span>
      <span className="text-[0.9rem] text-ink-soft">{note}</span>
    </button>
  )
}

/** Entries of one kind together, in the order the tool listed the kinds. */
const grouped = (entries: RemovalEntry[]) => {
  const groups = new Map<RemovalKind, RemovalEntry[]>()
  for (const e of entries) groups.set(e.kind, [...(groups.get(e.kind) ?? []), e])
  return [...groups]
}

function Plan(props: {
  tool: CatalogTool
  profile: string
  del: boolean
  removal: Removal
  what: string
  m: AccountsText["remove"]
}) {
  const { tool, profile, del, removal, what, m } = props
  const src = tool.accountRemove?.remove
  const command = src && catalogCommand(tool, [...(del ? src.deleteData : src.keepData), src.confirm], { profile })
  return (
    <>
      <div className="grid gap-x-6 gap-y-3 text-[0.9rem] sm:grid-cols-2">
        <Entries head={m.removesHead} entries={removal.removed} removal={removal} what={what} m={m} />
        {removal.kept.length > 0 && (
          <Entries head={m.keepsHead} entries={removal.kept} removal={removal} what={what} m={m} kept />
        )}
      </div>
      {command && (
        <p className="text-[0.85rem] text-ink-soft">
          {m.runs} <code className="selectable break-all font-mono text-ink">{command}</code>
        </p>
      )}
    </>
  )
}

/** Paths under the folder they share, so a list of a tool's files reads as names, not as one long prefix each. */
const byFolder = (entries: RemovalEntry[]) => {
  const folders = new Map<string, { name: string; entry: RemovalEntry }[]>()
  for (const entry of entries) {
    const sep = entry.target.includes("/") ? "/" : "\\"
    const parts = entry.target.split(sep)
    const cut = Math.min(4, parts.length - 1)
    const folder = parts.slice(0, cut).join(sep)
    folders.set(folder, [...(folders.get(folder) ?? []), { name: parts.slice(cut).join(sep), entry }])
  }
  return [...folders]
}

const mono = "selectable font-mono text-[0.82rem] [overflow-wrap:anywhere]"

function Entries(props: {
  head: string
  entries: RemovalEntry[]
  removal: Removal
  what: string
  m: AccountsText["remove"]
  kept?: boolean
}) {
  const { head, entries, removal, what, m, kept = false } = props
  return (
    <section className="min-w-0">
      <h3 className="text-[0.85rem] font-medium text-ink-dim">{head}</h3>
      <ul className="mt-1 flex flex-col gap-2">
        {grouped(entries).map(([kind, list]) => (
          <li key={kind} className="min-w-0">
            <span className="font-medium text-ink">{m.kinds[kind](what)}</span>
            {kind === "config" && removal.configFile && (
              <span className="text-ink-soft">
                {` ${m.configIn} `}
                <code className={mono}>{removal.configFile}</code>
              </span>
            )}
            {kind === "file" || kind === "unit" ? (
              <Paths list={list} kept={kept} m={m} />
            ) : (
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {list.map((e) => (
                  <li key={e.target} className="min-w-0 text-ink-soft">
                    {kind === "signIn" ? (
                      <span>{e.target}</span>
                    ) : (
                      kind !== "store" && <code className={mono}>{e.target}</code>
                    )}
                    {kept && <Reason entry={e} m={m} />}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Paths(props: { list: RemovalEntry[]; kept: boolean; m: AccountsText["remove"] }) {
  const { list, kept, m } = props
  return (
    <ul className="mt-0.5 flex flex-col gap-1">
      {byFolder(list).map(([folder, names]) => (
        <li key={folder} className="min-w-0 text-ink-soft">
          <span className="text-[0.85rem] text-ink-dim">
            {`${m.configIn} `}
            <code className={mono}>{folder}</code>
          </span>
          <ul className="flex flex-col gap-0.5 pl-3">
            {names.map(({ name, entry }) => (
              <li key={name} className="min-w-0">
                <code className={mono}>{name}</code>
                {kept && <Reason entry={entry} m={m} />}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

function Reason(props: { entry: RemovalEntry; m: AccountsText["remove"] }) {
  const { entry, m } = props
  const reason = entry.chosen ? (entry.kind === "store" ? m.storeStays : m.keptByChoice) : entry.reason
  if (!reason) return null
  return <span className="block text-[0.85rem] text-ink-dim">{reason}</span>
}

function Removed(props: {
  tool: CatalogTool
  profile: string
  removal: Removal
  what: string
  m: AccountsText["remove"]
}) {
  const { tool, profile, removal, what, m } = props
  const kinds = [...new Set(removal.removed.map((e) => e.kind))]
  return (
    <div className="flex items-start gap-2 text-ink">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
      <div className="flex flex-col gap-1">
        <p>
          {removal.data === "deleted" ? m.doneDelete(profile, tool.name, what) : m.doneKeep(profile, tool.name, what)}
        </p>
        {kinds.length > 0 && (
          <p className="text-[0.9rem] text-ink-soft">{m.doneList(kinds.map((k) => m.short[k](what)).join(", "))}</p>
        )}
        {removal.revoked === true && <p className="text-[0.9rem] text-ink-soft">{m.revoked(tool.name)}</p>}
      </div>
    </div>
  )
}

function Refusal(props: { tool: CatalogTool; profile: string; answer: Refused; m: AccountsText["remove"] }) {
  const { tool, profile, answer, m } = props
  const { reason, holder, message } = answer
  const head = reason === "busy" ? m.busyHead : m.refusedHead(tool.name)
  const detail =
    reason === "busy" && holder ? (
      <p>{m.holders[holder](profile, tool.name)}</p>
    ) : reason === "busy" ? (
      <>
        <p>{m.busyTool}</p>
        <p className="selectable rounded-[0.35rem] bg-app-2 px-2.5 py-1.5 font-mono text-[0.82rem] break-words text-ink">
          {message}
        </p>
      </>
    ) : reason === "unknownProfile" ? (
      <p>{m.unknownProfile(tool.name, profile)}</p>
    ) : reason === "pathOutside" || reason === "folderOutside" ? (
      <p>{m.outside(tool.name)}</p>
    ) : (
      <p className="selectable break-words">{message}</p>
    )
  return (
    <div className="flex items-start gap-2">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-medium text-ink">{head}</p>
        {detail}
      </div>
    </div>
  )
}

function SignOutChoice({ tool, profile, m }: { tool: CatalogTool; profile: string; m: AccountsText["remove"] }) {
  const src = tool.accountRemove
  const signOut = src?.signOut ?? null
  const command = signOut ? catalogCommand(tool, signOut, { profile }) : null
  const update = src?.remove && (
    <p className="flex items-start gap-2 text-[0.9rem] text-ink">
      <ArrowUpCircle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      {m.update(tool.name)}
    </p>
  )
  if (!src || !signOut)
    return (
      <>
        <p>{m.noSignOut(tool.name)}</p>
        {update}
      </>
    )
  return (
    <>
      <p>{m.lead(tool.name)}</p>
      {update}
      <Choice title={m.keepTitle} on>
        <Lists tool={tool} m={m} />
        {command && (
          <p className="mt-2 text-[0.85rem] text-ink-soft">
            {m.runs} <code className="selectable break-all font-mono text-ink">{command}</code>
          </p>
        )}
      </Choice>
      <Choice title={m.deleteTitle} on={false}>
        <p className="text-[0.9rem] text-ink-soft">{m.noDelete(tool.name)}</p>
      </Choice>
    </>
  )
}

function Choice({ title, on, children }: { title: string; on: boolean; children: React.ReactNode }) {
  return (
    <fieldset
      disabled={!on}
      className={cx(
        "rounded-[0.45rem] border px-3 py-2.5",
        on ? "border-brand/50 bg-brand-soft/40" : "border-line bg-app-2/60 text-ink-soft",
      )}
    >
      <legend className={cx("float-left mb-1.5 w-full font-medium", on ? "text-ink" : "text-ink-soft")}>{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  )
}

function Lists({ tool, m }: { tool: CatalogTool; m: AccountsText["remove"] }) {
  const src = tool.accountRemove
  if (!src) return null
  const what = m.what[dataWhat(tool)]
  return (
    <div className="grid gap-x-6 gap-y-2 text-[0.9rem] sm:grid-cols-2">
      <section>
        <h3 className="text-[0.85rem] font-medium text-ink-dim">{m.removesHead}</h3>
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
          {src.removes.map((k) => (
            <li key={k}>{m.removes[k](tool.name)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="text-[0.85rem] font-medium text-ink-dim">{m.keepsHead}</h3>
        <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4">
          {src.keeps.map((k) => (
            <li key={k}>{m.keeps[k](what)}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
