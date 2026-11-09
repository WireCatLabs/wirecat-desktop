import type { KeyboardEvent, PointerEvent, ReactNode } from "react"
import { moneyOf, ownerOf } from "@/domain/clients"
import { useLang, useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { cardClass } from "@/ui/Board"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { clientMessages } from "./messages"
import { useClients } from "./store"

const TONE: Record<string, LampTone> = { open: "idle", won: "ok", lost: "off" }

export const OutcomeLamp = ({ outcome }: { outcome: string }) => <Lamp tone={TONE[outcome] ?? "idle"} size="sm" />

export function Card(props: {
  card: CrmCard
  movable: boolean
  /** The card's real stage, on a board whose columns are base stages. */
  badge?: ReactNode
  /** Why a drop was refused, with what to do about it. */
  notice?: ReactNode
  ghost: boolean
  held: boolean
  onPointerDown: ((e: PointerEvent<HTMLElement>) => void) | undefined
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
}) {
  const { card, movable } = props
  const m = useMessages(clientMessages)
  const failed = useClients((s) => s.failed[card.ref])
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card holds a refusal's notice, which a button cannot contain
    <div
      role="button"
      tabIndex={0}
      data-card={card.ref}
      aria-label={card.title}
      aria-haspopup="dialog"
      aria-roledescription={movable ? m.draggable : undefined}
      aria-describedby={movable ? "clients-drag-hint" : undefined}
      aria-pressed={props.held || undefined}
      onPointerDown={props.onPointerDown}
      onKeyDown={props.onKeyDown}
      onClick={props.onOpen}
      className={cardClass(props.ghost, props.held, movable)}
    >
      <CardBody card={card} badge={props.badge} />
      {failed && (
        <div className="px-[0.9rem] pb-[0.6rem]">
          <ErrorNotice inline>{m.notMoved(failed)}</ErrorNotice>
        </div>
      )}
      {props.notice && <div className="px-[0.9rem] pb-[0.6rem]">{props.notice}</div>}
    </div>
  )
}

export function CardBody({ card, badge }: { card: CrmCard; badge?: ReactNode | undefined }) {
  const m = useMessages(clientMessages)
  const lang = useLang()
  const owner = ownerOf(card)
  return (
    <div className="flex flex-col gap-[0.35rem] px-[0.9rem] py-[0.7rem]">
      <p className="line-clamp-3 text-[0.95rem] leading-snug font-medium">{card.title}</p>
      {badge}
      {card.organization && <p className="truncate text-[0.9rem] text-ink-soft">{card.organization}</p>}
      <div className="flex min-w-0 items-center gap-[0.5rem] text-[0.9rem] text-ink-soft">
        <span className="min-w-0 truncate">{owner ?? m.nobody}</span>
        {card.amount && card.currency && (
          <span className="ml-auto shrink-0 font-mono tabular-nums text-ink">
            {moneyOf(card.amount, card.currency, lang)}
          </span>
        )}
      </div>
    </div>
  )
}
