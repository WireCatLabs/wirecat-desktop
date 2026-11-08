import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { type CatalogTool, catalogCommand } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { AccountRemoved } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { accountsMessages, type DataWhat } from "./messages-accounts"

type Phase = { step: "confirm" } | { step: "running" } | { step: "result"; result: AccountRemoved }

const dataWhat = (tool: CatalogTool): DataWhat => {
  const what = tool.sync?.what
  if (what === "files" || what === "meetings" || what === "mail") return what
  return tool.id === "gcal" ? "events" : "messages"
}

/**
 * Removing one account, only through the tool's own commands: every CLI today signs the account out and keeps its
 * data, so the choice to delete it too is shown, switched off, with the reason.
 */
export function RemoveAccountDialog(props: {
  tool: CatalogTool
  profile: string
  open: boolean
  onClose: () => void
  onRemoved: () => void
  onSignIn: () => void
}) {
  const { tool, profile, open, onClose, onRemoved, onSignIn } = props
  const m = useMessages(accountsMessages).remove
  const [phase, setPhase] = useState<Phase>({ step: "confirm" })
  const [opened, setOpened] = useState(false)
  if (open !== opened) {
    setOpened(open)
    if (open) setPhase({ step: "confirm" })
  }
  const src = tool.accountRemove
  const signOut = src?.signOut ?? null
  const command = signOut ? catalogCommand(tool, signOut, { profile }) : null

  const run = async () => {
    setPhase({ step: "running" })
    let result: AccountRemoved
    try {
      result = await platform.accountRemove(tool.id, profile, false)
    } catch (e) {
      result = { result: "failed", message: e instanceof Error ? e.message : String(e) }
    }
    setPhase({ step: "result", result })
    if (result.result === "signedOut") onRemoved()
  }
  const close = () => {
    if (phase.step !== "running") onClose()
  }
  const result = phase.step === "result" ? phase.result : null

  const actions = !signOut ? (
    <Button variant="secondary" onClick={onClose} autoFocus>
      {m.close}
    </Button>
  ) : phase.step === "confirm" ? (
    <>
      <Button variant="secondary" onClick={onClose} autoFocus>
        {m.cancel}
      </Button>
      <Button variant="danger" onClick={run}>
        {m.confirm}
      </Button>
    </>
  ) : phase.step === "running" ? (
    <Button variant="danger" aria-disabled onClick={() => undefined}>
      <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
      {m.running}
    </Button>
  ) : result?.result === "signedOut" ? (
    <>
      {tool.setup && (
        <Button
          variant="ghost"
          onClick={() => {
            onClose()
            onSignIn()
          }}
        >
          {m.signInAgain}
        </Button>
      )}
      <Button variant="primary" onClick={onClose} autoFocus>
        {m.finish}
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose}>
        {m.close}
      </Button>
      <Button variant="secondary" onClick={run} autoFocus>
        {m.tryAgain}
      </Button>
    </>
  )

  return (
    <Dialog open={open} title={m.title(profile)} onClose={close} actions={actions} wide>
      <div aria-live="polite" className="flex flex-col gap-3">
        {!src || !signOut ? (
          <p>{m.noSignOut(tool.name)}</p>
        ) : result?.result === "signedOut" ? (
          <p className="flex items-start gap-2 text-ink">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            <span>{result.wasSignedIn ? m.done(profile, tool.name) : m.wasOut(profile)}</span>
          </p>
        ) : result ? (
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-bad" aria-hidden />
            <span>
              <span className="font-medium text-ink">{m.failed}</span> {result.message}
            </span>
          </p>
        ) : (
          <>
            <p>{m.lead(tool.name)}</p>
            <Choice title={m.keepTitle} on>
              <Lists tool={tool} />
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
        )}
      </div>
    </Dialog>
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

function Lists({ tool }: { tool: CatalogTool }) {
  const m = useMessages(accountsMessages).remove
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
