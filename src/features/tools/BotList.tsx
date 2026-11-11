import { Bot, KeyRound, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { CatalogTool } from "@/domain/catalog"
import { useMessages } from "@/i18n"
import type { BotProfile } from "@/platform/bot-schemas"
import { useBotSignIn } from "@/shared/bot-signin-store"
import { botMessages } from "@/shared/messages-bot"
import { Button } from "@/ui/Button"
import { Dialog } from "@/ui/Dialog"
import { Disclosure } from "@/ui/Disclosure"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { RefreshButton } from "@/ui/RefreshButton"
import { Skeleton } from "@/ui/Skeleton"

/** The tool's bots beside its accounts: each name, what the messenger says of its token, and the way to fix or drop it. */
export function BotList({ tool }: { tool: CatalogTool }) {
  const m = useMessages(botMessages)
  const bots = useBotSignIn((s) => s.bots[tool.id])
  const checked = useBotSignIn((s) => s.checked[tool.id])
  const [removing, setRemoving] = useState<string | null>(null)
  const hasBots = (bots?.length ?? 0) > 0

  useEffect(() => {
    void useBotSignIn.getState().loadBots(tool.id)
  }, [tool.id])

  useEffect(() => {
    if (hasBots) void useBotSignIn.getState().checkBots(tool.id)
  }, [tool.id, hasBots])

  return (
    <section aria-labelledby={`bots-${tool.id}`} className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h5 id={`bots-${tool.id}`} className="text-[0.9rem] font-medium text-ink">
          {m.bots}
          <span className="sr-only">, {tool.name}</span>
        </h5>
        {hasBots && (
          <RefreshButton
            busy={checked === undefined}
            label={m.checkAgain}
            busyLabel={m.checkingBots}
            onClick={() => void useBotSignIn.getState().checkBots(tool.id)}
          />
        )}
      </div>
      {bots === undefined ? (
        <Skeleton className="h-4 w-28" label={m.bots} />
      ) : bots === null ? (
        <p className="text-[0.9rem] text-ink-soft">{m.botsFailed}</p>
      ) : bots.length === 0 ? (
        <p className="text-[0.9rem] text-ink-soft">{m.noBots}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[0.45rem] border border-line bg-app">
          {bots.map((b) => (
            <BotRow
              key={b.name}
              tool={tool}
              bot={b}
              checked={checked === undefined ? undefined : (checked?.find((c) => c.name === b.name) ?? null)}
              onRemove={() => setRemoving(b.name)}
            />
          ))}
        </ul>
      )}
      <div>
        <Button
          size="sm"
          variant="secondary"
          icon={<Bot className="size-4" aria-hidden />}
          onClick={() => useBotSignIn.getState().open(tool.id)}
        >
          {m.addBot}
        </Button>
      </div>
      <RemoveBotDialog tool={tool} name={removing} onClose={() => setRemoving(null)} />
    </section>
  )
}

function BotRow(props: {
  tool: CatalogTool
  bot: BotProfile
  /** undefined while the messenger is being asked, null when it could not be. */
  checked: BotProfile | null | undefined
  onRemove: () => void
}) {
  const { tool, bot: b, checked, onRemove } = props
  const m = useMessages(botMessages)
  const refused = checked?.problem === "authentication_error"
  const unknown = checked === null || (checked?.problem && !refused)
  // A token from the environment is not this computer's to replace or forget.
  const managed = b.source !== "env"
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2" aria-label={m.botRegion(b.name)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-1 basis-[16rem] flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 truncate font-medium">{b.name}</span>
          {checked?.bot && <span className="min-w-0 truncate text-[0.875rem] text-ink-soft">@{checked.bot}</span>}
          {checked === undefined ? (
            <Skeleton chars={8} label={m.checkingBots} />
          ) : refused ? (
            <Pill tone="warn">{m.statusRefused}</Pill>
          ) : unknown ? (
            <Pill>{m.statusUnknown}</Pill>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[0.875rem] text-ink-soft">
              <Lamp tone="ok" size="sm" />
              {m.statusOk}
            </span>
          )}
          {b.source === "file" && <span className="text-[0.85rem] text-ink-soft">{m.tokenInFile}</span>}
          {b.source === "env" && <span className="text-[0.85rem] text-ink-soft">{m.tokenInEnv}</span>}
        </div>
        {managed && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant={refused ? "primary" : "secondary"}
              aria-label={m.reconnectNamed(b.name)}
              icon={<KeyRound className="size-4" aria-hidden />}
              onClick={() => useBotSignIn.getState().reconnect(tool.id, b.name)}
            >
              {m.reconnect}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-label={m.removeNamed(b.name)}
              icon={<Trash2 className="size-4" aria-hidden />}
              onClick={onRemove}
            >
              {m.remove}
            </Button>
          </div>
        )}
      </div>
      {refused && <p className="text-[0.875rem] text-ink-soft">{m.refusedHelp(tool.name)}</p>}
      {unknown && <p className="text-[0.875rem] text-ink-soft">{m.unknownHelp(tool.name)}</p>}
    </li>
  )
}

function RemoveBotDialog(props: { tool: CatalogTool; name: string | null; onClose: () => void }) {
  const { tool, name, onClose } = props
  const m = useMessages(botMessages)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (name !== null) setError(null)
  }, [name])

  const remove = () => {
    if (name === null || busy) return
    setBusy(true)
    setError(null)
    useBotSignIn
      .getState()
      .removeBot(tool.id, name)
      .then(onClose, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false))
  }

  return (
    <Dialog
      open={name !== null}
      title={m.removeTitle(name ?? "")}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {m.cancel}
          </Button>
          <Button variant="danger" onClick={remove} aria-busy={busy || undefined}>
            {busy ? m.removing : m.removeConfirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p>{m.removeBody(tool.name)}</p>
        {error !== null && (
          <ErrorNotice detail={<Disclosure summary={m.details}>{error}</Disclosure>}>{m.removeFailed}</ErrorNotice>
        )}
      </div>
    </Dialog>
  )
}
