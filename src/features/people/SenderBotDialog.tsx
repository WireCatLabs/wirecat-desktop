import { formatWhen } from "@/domain/runs"
import { formatNumber, useLang, useMessages } from "@/i18n"
import type { SenderBot } from "@/platform/bindings"
import { SourceIcon } from "@/shared/SourceIcon"
import { CopyRef } from "@/ui/CopyRef"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Skeleton } from "@/ui/Skeleton"
import { botMessages } from "./messages-bots"
import { usePeople } from "./store"

/** One bot from the Bots tab: what it writes from, whom it sends for, how it reached the owner and who sorted it. */
export function SenderBotDialog() {
  const open = usePeople((s) => s.botOpen)
  const detail = usePeople((s) => (open ? s.bots[open] : undefined))
  const title = detail?.state === "ready" ? (detail.bot.displayName ?? detail.bot.name ?? open) : open
  return (
    <Dialog
      open={open !== null}
      title={title ?? ""}
      titleAside={<CopyRef value={open} />}
      onClose={() => usePeople.getState().reveal(null)}
      wide
      scroll
    >
      {open && <Details key={open} reference={open} />}
    </Dialog>
  )
}

function Details({ reference }: { reference: string }) {
  const m = useMessages(botMessages)
  const detail = usePeople((s) => s.bots[reference])
  const box = "pb-[1.2rem]"
  if (!detail || detail.state === "loading")
    return (
      <div className={box}>
        <Skeleton className="h-[5rem] w-full rounded-control" label={m.loading} />
      </div>
    )
  if (detail.state === "failed")
    return (
      <div className={box}>
        <ErrorNotice raw={detail.error} inline>
          {m.failed}
        </ErrorNotice>
      </div>
    )
  return (
    <div className={`${box} reveal grid gap-[1.4rem]`}>
      <Accounts bot={detail.bot} />
      <Facts bot={detail.bot} />
      <Moves bot={detail.bot} />
    </div>
  )
}

function Accounts({ bot }: { bot: SenderBot }) {
  const m = useMessages(botMessages)
  return (
    <section className="flex min-w-0 flex-col gap-[0.6rem]">
      <div>
        <h3 className="font-medium">{m.accounts}</h3>
        <p className="text-[0.9rem] text-ink-soft">{m.accountsHelp}</p>
      </div>
      <ul className="flex flex-col gap-[0.4rem]">
        {bot.identities.map((i) => (
          <li key={i.identity} className="flex min-w-0 items-center gap-[0.5rem]">
            <SourceIcon provider={i.identity.split(":")[0] ?? ""} className="text-ink-dim" labelled />
            <span className="selectable truncate font-mono text-[0.9rem]">
              {i.username ? `@${i.username.replace(/^@/, "")}` : i.identity.slice(i.identity.indexOf(":") + 1)}
            </span>
            {i.name && <span className="truncate text-[0.9rem] text-ink-soft">{i.name}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Facts({ bot }: { bot: SenderBot }) {
  const m = useMessages(botMessages)
  const lang = useLang()
  const rows: [string, string][] = [
    [m.organization, bot.organization ?? m.noOrganization],
    [m.reach, bot.reach ? (m.reaches[bot.reach] ?? bot.reach) : "—"],
    [m.sortedBy, bot.author === "owner" ? m.sortedByOwner : m.sortedByRules],
    ...(bot.reason ? [[m.why, bot.reason] as [string, string]] : []),
    [m.sent, bot.messagesFrom === null ? "—" : formatNumber(bot.messagesFrom, lang)],
    [m.last, bot.lastContact ? formatWhen(bot.lastContact, new Date(), lang) : "—"],
  ]
  return (
    <dl className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-[1.2rem] gap-y-[0.45rem] text-[0.95rem]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-soft">{label}</dt>
          <dd className="selectable min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Moves({ bot }: { bot: SenderBot }) {
  const m = useMessages(botMessages)
  const lang = useLang()
  if (bot.moves.length === 0) return null
  return (
    <section className="flex flex-col gap-[0.5rem]">
      <h3 className="font-medium">{m.moves}</h3>
      <ul className="flex flex-col gap-[0.3rem] text-[0.9rem] text-ink-soft">
        {bot.moves.map((mv) => (
          <li key={`${mv.identity}-${mv.at}`} className="flex flex-wrap gap-x-[0.8rem]">
            <span className="selectable font-mono">{m.moved(mv.identity, mv.from ?? m.nobody, mv.to ?? m.nobody)}</span>
            <span>{mv.author === "owner" ? m.sortedByOwner : m.sortedByRules}</span>
            <span className="tabular-nums">{formatWhen(mv.at, new Date(), lang)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
