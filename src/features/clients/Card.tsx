import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react"
import { crmToolOf } from "@/domain/catalog"
import { moneyOf, ownerOf } from "@/domain/clients"
import { formatDate, useLang, useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { cardClass } from "@/ui/Board"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { TipPanel, useTip } from "@/ui/Tooltip"
import { useStageName } from "./api"
import { clientMessages } from "./messages"
import { useClients } from "./store"

const TONE: Record<string, LampTone> = { open: "idle", won: "ok", lost: "off" }
/** Long enough that a pointer crossing the board on its way elsewhere opens nothing. */
const TIP_DELAY = 450

export const OutcomeLamp = ({ outcome, label }: { outcome: string; label?: string }) => (
  <Lamp tone={TONE[outcome] ?? "idle"} size="sm" {...(label ? { label } : {})} />
)

export function Card(props: {
  card: CrmCard
  movable: boolean
  /** The card's real stage, on a board whose columns are base stages. */
  badge?: ReactNode
  /** Its pipeline's name, for the details on hover. */
  pipeline?: string | undefined
  /** Why a drop was refused, with what to do about it. */
  notice?: ReactNode
  ghost: boolean
  held: boolean
  /** A card is being carried: no details open. */
  dragging: boolean
  onPointerDown: ((e: PointerEvent<HTMLElement>) => void) | undefined
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  onOpen: () => void
}) {
  const { card, movable } = props
  const m = useMessages(clientMessages)
  const failed = useClients((s) => s.failed[card.ref])
  const root = useRef<HTMLDivElement>(null)
  const tipId = useId()
  const tip = useTip({ delay: TIP_DELAY, keyboardOnly: true, disabled: props.dragging || props.held })
  // A board holds hundreds of cards: a card's details are built on its first open, not with the board.
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (tip.open) setSeen(true)
  }, [tip.open])
  const describedBy = [movable ? "clients-drag-hint" : null, tip.open ? tipId : null].filter(Boolean).join(" ")
  return (
    // biome-ignore lint/a11y/useSemanticElements: a card holds a refusal's notice, which a button cannot contain
    <div
      ref={root}
      role="button"
      tabIndex={0}
      data-card={card.ref}
      aria-label={card.title}
      aria-haspopup="dialog"
      aria-roledescription={movable ? m.draggable : undefined}
      aria-describedby={describedBy || undefined}
      aria-pressed={props.held || undefined}
      onPointerDown={(e) => {
        tip.hide()
        props.onPointerDown?.(e)
      }}
      onKeyDown={props.onKeyDown}
      onClick={props.onOpen}
      {...tip.hover}
      {...tip.focus}
      className={cardClass(props.ghost, props.held, movable, true)}
    >
      <CardBody card={card} badge={props.badge} />
      {failed && (
        <div className="px-[0.9rem] pb-[0.6rem]">
          <ErrorNotice inline>{m.notMoved(failed)}</ErrorNotice>
        </div>
      )}
      {props.notice && <div className="px-[0.9rem] pb-[0.6rem]">{props.notice}</div>}
      {(tip.open || seen) && (
        <TipPanel id={tipId} anchor={root} open={tip.open} side="beside">
          <span className="mb-[0.5rem] block font-medium text-ink">{card.title}</span>
          <CardFacts card={card} pipeline={props.pipeline} compact />
        </TipPanel>
      )}
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

export function StageText({ card }: { card: CrmCard }) {
  const m = useMessages(clientMessages)
  const label = useStageName(useClients((s) => s.kind))
  return (
    <span className="inline-flex items-center gap-[0.5rem]">
      <OutcomeLamp outcome={card.status} />
      {label.stage(card.stage, card.account !== null)} · {m.statusOf[card.status] ?? card.status}
    </span>
  )
}

/**
 * What a card holds, label by label, leaving out what it lacks: the card's dialog and the details on hover read the
 * same list. `stage` replaces the plain stage, for the dialog's picker. `compact` (on hover) leaves out the base stage,
 * which is the column the card stands in.
 */
export function CardFacts({
  card,
  stage,
  pipeline,
  compact = false,
}: {
  card: CrmCard
  stage?: ReactNode
  pipeline?: string | undefined
  compact?: boolean
}) {
  const m = useMessages(clientMessages)
  const lang = useLang()
  const label = useStageName(useClients((s) => s.kind))
  const day = (iso: string | null) =>
    iso ? formatDate(`${iso.slice(0, 10)}T00:00:00`, { day: "numeric", month: "long", year: "numeric" }, lang) : null
  return (
    <dl
      className={cx(
        "grid grid-cols-[max-content_minmax(0,1fr)]",
        compact ? "gap-x-[0.9rem] gap-y-[0.3rem] text-[0.88rem]" : "gap-x-[1.2rem] gap-y-[0.55rem] text-[0.95rem]",
      )}
    >
      <Row label={m.stage}>{stage ?? <StageText card={card} />}</Row>
      {!compact && <Row label={m.baseStage}>{card.baseStage && label.stage(card.baseStage.name)}</Row>}
      <Row label={m.pipeline}>{pipeline && label.pipeline(pipeline, card.account !== null)}</Row>
      <Row label={m.amount}>{card.amount && card.currency ? moneyOf(card.amount, card.currency, lang) : null}</Row>
      <Row label={m.organization}>{card.organization}</Row>
      <Row label={m.people}>
        {card.people.length > 0 ? (
          <ul>
            {card.people.map((p) => (
              <li key={`${p.name}-${p.role}`}>
                {p.name ?? m.nobody} <span className="text-ink-dim">· {m.roles[p.role] ?? p.role}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Row>
      <Row label={m.closeDate}>{day(card.closeDate)}</Row>
      <Row label={m.closedDate}>{day(card.closedDate)}</Row>
      <Row label={m.closedReason}>{card.closedReason}</Row>
      <Row label={m.project}>{card.projectName}</Row>
      <Row label={m.account}>
        {card.account
          ? `${crmToolOf(card.account.provider)?.name ?? card.account.provider} · ${card.account.account}`
          : m.ownAccount}
      </Row>
      <Row label={m.updated}>{day(card.updatedAt)}</Row>
    </dl>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="selectable min-w-0 text-ink">{children}</dd>
    </>
  )
}
