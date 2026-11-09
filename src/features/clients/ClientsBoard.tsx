import { useRef, useState } from "react"
import { amountsOf, canDrop, columnsOf, type Kind, sumsOf } from "@/domain/clients"
import { useLang, useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { Board, BoardColumn, DragCopy, DropLine, useBoardDrag, useSlide } from "@/ui/Board"
import { type Ready, useCardMove } from "./api"
import { Card, CardBody, OutcomeLamp } from "./Card"
import { clientMessages } from "./messages"
import { ProfilePicker } from "./ProfilePicker"
import { useClients } from "./store"

/** One pipeline's stages as columns. Cards move when the pipeline is the owner's own, or its CRM's CLI can write. */
export function ClientsBoard({ read, kind, cards }: { read: Ready; kind: Kind; cards: CrmCard[] }) {
  const m = useMessages(clientMessages)
  const lang = useLang()
  const asked = useClients((s) => s.pipeline[kind] ?? null)
  const filtered = useClients((s) => s.query.trim() !== "")
  const move = useCardMove(
    kind,
    asked,
    read.pipelines,
    (_, stage) => read.stages.find((x) => x.name === stage)?.externalId ?? null,
  )
  const [note, setNote] = useState("")
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
    canDrop: (ref, to) =>
      !movable ? m.readOnlyShort : canDrop(byRef.get(ref), read.pipeline, read.stages, to) || m.otherPipeline,
    onDrop: ({ key, to }) => {
      const c = byRef.get(key)
      if (c) move.run(c, to)
    },
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
      <ProfilePicker onChoose={move.chosen} onCancel={(ref) => setNote(ref ? m.putBack(ref) : "")} />
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
      <p aria-live="polite" className="sr-only">
        {note}
      </p>
    </>
  )
}
