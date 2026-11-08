import { type KeyboardEvent, type PointerEvent, useRef } from "react"
import { amountsOf, canDrop, columnsOf, type Kind, moneyOf, ownerOf, sumsOf } from "@/domain/clients"
import { useLang, useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { Board, BoardColumn, cardClass, DragCopy, DropLine, useBoardDrag, useSlide } from "@/ui/Board"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp, type LampTone } from "@/ui/Lamp"
import { type Ready, useMove } from "./api"
import { clientMessages } from "./messages"
import { useClients } from "./store"

const TONE: Record<string, LampTone> = { open: "idle", won: "ok", lost: "off" }

export const OutcomeLamp = ({ outcome }: { outcome: string }) => <Lamp tone={TONE[outcome] ?? "idle"} size="sm" />

/** One pipeline's stages as columns. Cards move only when the pipeline is the owner's own (or, later, its CRM's). */
export function ClientsBoard({ read, kind, cards }: { read: Ready; kind: Kind; cards: CrmCard[] }) {
  const m = useMessages(clientMessages)
  const lang = useLang()
  const asked = useClients((s) => s.pipeline[kind] ?? null)
  const filtered = useClients((s) => s.query.trim() !== "")
  const move = useMove(kind, asked)
  const movable = read.movable.kind === "yes"
  const byRef = new Map(cards.map((c) => [c.ref, c]))
  const columns = columnsOf(read.stages, cards)
  const names = read.stages.map((s) => s.name)
  const board = useRef<HTMLDivElement>(null)
  useSlide(board, cards.map((c) => `${c.ref}:${c.stage}`).join())
  const { drag, held, said, shown, onPointerDown, onClick, onKeyDown } = useBoardDrag<string>({
    columns: names,
    cardsIn: (stage) => columns.get(stage) ?? [],
    columnOf: (ref) => byRef.get(ref)?.stage,
    canDrop: (ref, to) => movable && canDrop(byRef.get(ref), read.pipeline, read.stages, to),
    onDrop: ({ key, to }) => move.mutate({ ref: key, stage: to }),
    onOpen: (ref) => useClients.getState().setOpen(ref),
    words: { picked: m.picked, place: m.place, dropped: m.dropped, putBack: m.putBack },
  })
  const dragged = drag ? byRef.get(drag.key) : undefined
  return (
    <>
      <p className="sr-only" id="clients-drag-hint">
        {m.dragHint}
      </p>
      <Board columns={read.stages.length} boardRef={board}>
        {read.stages.map((s) => {
          const refs = shown(s.name)
          // While a filter hides cards, the header speaks for the cards shown; memo's count stays as "of".
          const here = filtered ? (columns.get(s.name) ?? []).flatMap((r) => byRef.get(r) ?? []) : []
          const amounts = filtered ? amountsOf(here) : s.amounts
          return (
            <BoardColumn
              key={s.name}
              id={s.name}
              label={filtered ? m.columnOf(s.name, here.length, s.items) : m.column(s.name, s.items)}
              lamp={<OutcomeLamp outcome={s.outcome} />}
              name={s.name}
              count={filtered ? m.of(here.length, s.items) : s.items}
              aside={amounts.length ? sumsOf(amounts, lang) : undefined}
              target={drag?.to === s.name}
              empty={refs.length === 0 && !drag ? m.emptyColumn : undefined}
            >
              {refs.map((ref) => {
                const c = byRef.get(ref)
                if (!c) return null
                return (
                  <li key={ref} className="contents">
                    {drag && drag.to === s.name && drag.before === ref && <DropLine />}
                    <Card
                      card={c}
                      movable={movable}
                      ghost={drag?.key === ref}
                      held={held?.key === ref}
                      onPointerDown={movable ? (e) => onPointerDown(e, ref) : undefined}
                      onKeyDown={(e) => {
                        if (movable || e.key === "Enter") onKeyDown(e, ref)
                      }}
                      onOpen={() => onClick(ref)}
                    />
                  </li>
                )
              })}
              {drag && drag.to === s.name && drag.before === null && (
                <li aria-hidden className="contents">
                  <DropLine />
                </li>
              )}
            </BoardColumn>
          )
        })}
      </Board>
      {drag && dragged && (
        <DragCopy drag={drag}>
          <CardBody card={dragged} />
        </DragCopy>
      )}
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
    </>
  )
}

function Card(props: {
  card: CrmCard
  movable: boolean
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
      <CardBody card={card} />
      {failed && (
        <div className="px-[0.9rem] pb-[0.6rem]">
          <ErrorNotice inline>{m.notMoved(failed)}</ErrorNotice>
        </div>
      )}
    </div>
  )
}

function CardBody({ card }: { card: CrmCard }) {
  const m = useMessages(clientMessages)
  const lang = useLang()
  const owner = ownerOf(card)
  return (
    <div className="flex flex-col gap-[0.35rem] px-[0.9rem] py-[0.7rem]">
      <p className="line-clamp-3 text-[0.95rem] leading-snug font-medium">{card.title}</p>
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
