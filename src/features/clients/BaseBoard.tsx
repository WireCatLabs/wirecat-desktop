import { useRef, useState } from "react"
import { baseColumnsOf, columnOf, dropOf, type Refusal, UNSORTED } from "@/domain/base-stages"
import { amountsOf, type Kind, sumsOf } from "@/domain/clients"
import { useLang, useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { Board, BoardColumn, DragCopy, DropLine, useBoardDrag, useSlide } from "@/ui/Board"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { type Based, useCardMove } from "./api"
import { Card, CardBody, OutcomeLamp } from "./ClientsBoard"
import { clientMessages } from "./messages"
import { stageMessages } from "./messages-stages"
import { ProfilePicker } from "./ProfilePicker"
import { StagePicker } from "./StagePicker"
import { useClients } from "./store"

/** The base set as columns, every pipeline's cards under the base stage their own stage points to. */
export function BaseBoard({
  read,
  kind,
  cards,
  filtered,
}: {
  read: Based
  kind: Kind
  cards: CrmCard[]
  filtered: boolean
}) {
  const m = useMessages(clientMessages)
  const s = useMessages(stageMessages)
  const lang = useLang()
  const asked = useClients((st) => st.pipeline[kind] ?? null)
  const refused = useClients((st) => st.refused)
  const move = useCardMove(
    kind,
    asked,
    read.pipelines,
    (pipeline, stage) => read.mapping.find((x) => x.pipeline === pipeline && x.name === stage)?.externalId ?? null,
  )
  const [note, setNote] = useState("")
  const pipes = new Map(read.pipelines.map((p) => [p.ref, p]))
  const byRef = new Map(cards.map((c) => [c.ref, c]))
  const columns = baseColumnsOf(read.base, cards)
  const ids = [UNSORTED, ...read.base.map((b) => b.ref)]
  const nameOf = (id: string) => (id === UNSORTED ? s.unsorted : (read.base.find((b) => b.ref === id)?.name ?? id))
  const several = new Set(cards.map((c) => c.pipeline)).size > 1
  const verdict = (ref: string, to: string) => {
    const c = byRef.get(ref)
    return c
      ? dropOf(c, to, read, pipes.get(c.pipeline)?.movable.kind === "yes")
      : ({ kind: "refuse", why: "unmapped" } as const)
  }
  const board = useRef<HTMLDivElement>(null)
  useSlide(board, cards.map((c) => `${c.ref}:${c.stage}`).join())
  const { drag, held, said, shown, onPointerDown, onClick, onKeyDown } = useBoardDrag<string>({
    columns: ids,
    cardsIn: (id) => columns.get(id) ?? [],
    columnOf: (ref) => {
      const c = byRef.get(ref)
      return c ? columnOf(c) : undefined
    },
    canDrop: (ref, to) => {
      const d = verdict(ref, to)
      return d.kind === "refuse" ? s.refusal[d.why] : true
    },
    onRefuse: (ref, to) => {
      const d = verdict(ref, to)
      if (d.kind === "refuse") useClients.getState().refuse(ref, d.why)
    },
    onDrop: ({ key, to }) => {
      const d = verdict(key, to)
      const c = byRef.get(key)
      if (d.kind === "move" && c) move.run(c, d.stage)
      if (d.kind === "choose" && c)
        useClients.getState().pick({ ref: key, pipeline: c.pipeline, base: to, stages: d.stages })
    },
    onOpen: (ref) => useClients.getState().setOpen(ref),
    words: {
      picked: m.picked,
      place: (id, at, of) => m.place(nameOf(id), at, of),
      dropped: (ref, id) => m.dropped(ref, nameOf(id)),
      putBack: m.putBack,
    },
  })
  const dragged = drag ? byRef.get(drag.key) : undefined
  const badge = (c: CrmCard) => {
    const entry = read.mapping.find((x) => x.pipeline === c.pipeline && x.name === c.stage)
    const pipeline = several ? pipes.get(c.pipeline)?.name : undefined
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-[0.35rem]">
        <Pill>{pipeline ? s.badge(c.stage, pipeline) : c.stage}</Pill>
        {entry && !entry.confirmed && entry.base && <Pill tone="warn">{s.suggested(entry.base.name)}</Pill>}
      </span>
    )
  }
  return (
    <>
      <p className="sr-only" id="clients-drag-hint">
        {m.dragHint}
      </p>
      <Board columns={ids.length} boardRef={board}>
        {ids.map((id) => {
          const refs = shown(id)
          const b = read.base.find((x) => x.ref === id)
          const here = (columns.get(id) ?? []).flatMap((r) => byRef.get(r) ?? [])
          // memo counts an open column's open rows across every pipeline; a filter, closed columns (capped to the
          // newest) and Unsorted count what the page shows. Sums are always the shown cards'.
          const counted = b && b.outcome === "open" && !filtered
          const amounts = amountsOf(here)
          const items = counted ? b.open : here.length
          return (
            <BoardColumn
              key={id}
              id={id}
              label={m.column(nameOf(id), items)}
              lamp={b ? <OutcomeLamp outcome={b.outcome} /> : <Lamp tone="warn" size="sm" />}
              name={nameOf(id)}
              count={items}
              aside={
                id === UNSORTED ? (
                  <Button size="sm" variant="ghost" onClick={() => useClients.getState().setView("stages")}>
                    {s.mapStages}
                  </Button>
                ) : amounts.length ? (
                  sumsOf(amounts, lang)
                ) : undefined
              }
              target={drag?.to === id}
              empty={refs.length === 0 && !drag ? (id === UNSORTED ? s.unsortedEmpty : m.emptyColumn) : undefined}
            >
              {refs.map((ref) => {
                const c = byRef.get(ref)
                if (!c) return null
                const movable = pipes.get(c.pipeline)?.movable.kind === "yes"
                const why = refused[ref]
                return (
                  <li key={ref} className="contents">
                    {drag && drag.to === id && drag.before === ref && <DropLine />}
                    <Card
                      card={c}
                      movable={movable}
                      ghost={drag?.key === ref}
                      held={held?.key === ref}
                      badge={badge(c)}
                      notice={why && <Refused why={why} />}
                      onPointerDown={movable ? (e) => onPointerDown(e, ref) : undefined}
                      onKeyDown={(e) => {
                        if (movable || e.key === "Enter") onKeyDown(e, ref)
                      }}
                      onOpen={() => onClick(ref)}
                    />
                  </li>
                )
              })}
              {drag && drag.to === id && drag.before === null && (
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
          <CardBody card={dragged} badge={badge(dragged)} />
        </DragCopy>
      )}
      <StagePicker
        base={read.base}
        cards={byRef}
        onMove={(ref, stage) => {
          const c = byRef.get(ref)
          if (c) move.run(c, stage)
        }}
        onCancel={(ref) => setNote(m.putBack(ref))}
      />
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

function Refused({ why }: { why: Refusal }) {
  const m = useMessages(clientMessages)
  const s = useMessages(stageMessages)
  const mappable = why === "unmapped" || why === "unconfirmed"
  return (
    <ErrorNotice inline>
      {m.notMoved(s.refusal[why])}
      {mappable && (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            useClients.getState().setView("stages")
          }}
        >
          {s.mapStages}
        </Button>
      )}
    </ErrorNotice>
  )
}
