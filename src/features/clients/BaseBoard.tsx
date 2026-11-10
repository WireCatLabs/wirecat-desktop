import { useRef, useState } from "react"
import { baseColumnsOf, openCountsOf, placeOf, type Refusal, suggestionOf, UNSORTED } from "@/domain/base-stages"
import { accountKey, type Kind } from "@/domain/clients"
import { useMessages } from "@/i18n"
import type { CrmCard } from "@/platform/bindings"
import { Board, BoardColumn, DragCopy, DropLine, useBoardDrag, useSlide } from "@/ui/Board"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { type Based, useStageName } from "./api"
import { useBaseMove } from "./base-move"
import { Card, CardBody, OutcomeLamp } from "./Card"
import { clientMessages } from "./messages"
import { stageMessages } from "./messages-stages"
import { useClients } from "./store"

/** A column shows this many cards at first and this many more on each «Show more»: a read may hold hundreds. */
export const COLUMN_PAGE = 20

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
  const label = useStageName(kind)
  const refused = useClients((st) => st.refused)
  const move = useBaseMove(read, kind)
  const pipes = new Map(read.pipelines.map((p) => [p.ref, p]))
  const byRef = new Map(cards.map((c) => [c.ref, c]))
  const columns = baseColumnsOf(read.base, cards, read.mapping)
  const counts = openCountsOf(read.base, read.unsorted, read.mapping)
  // A column that cannot be dropped on and holds nothing, loaded or not, only takes room from the stages.
  const unsorted = (columns.get(UNSORTED)?.length ?? 0) > 0 || (!filtered && (counts.get(UNSORTED) ?? 0) > 0)
  const ids = [...(unsorted ? [UNSORTED] : []), ...read.base.map((b) => b.ref)]
  const nameOf = (id: string) => {
    const b = read.base.find((x) => x.ref === id)
    return id === UNSORTED ? s.unsorted : b ? label.stage(b.name) : id
  }
  const several = new Set(cards.map((c) => c.pipeline)).size > 1
  const verdict = (ref: string, to: string) => {
    const c = byRef.get(ref)
    return c ? move.verdict(c, to) : ({ kind: "refuse", why: "unmapped" } as const)
  }
  const board = useRef<HTMLDivElement>(null)
  const [limits, setLimits] = useState<Record<string, number>>({})
  useSlide(board, cards.map((c) => `${c.ref}:${c.stage}`).join())
  const { drag, held, said, shown, onPointerDown, onClick, onKeyDown } = useBoardDrag<string>({
    columns: ids,
    cardsIn: (id) => columns.get(id) ?? [],
    columnOf: (ref) => {
      const c = byRef.get(ref)
      return c ? placeOf(c, read.mapping) : undefined
    },
    canDrop: (ref, to) => {
      const d = verdict(ref, to)
      return d.kind === "refuse" ? s.refusal[d.why] : true
    },
    onRefuse: (ref, to) => {
      const c = byRef.get(ref)
      if (c) move.moveTo(c, to)
    },
    onDrop: ({ key, to }) => {
      const c = byRef.get(key)
      if (c) move.moveTo(c, to)
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
    const suggested = suggestionOf(c, read.mapping)
    const name = several ? pipes.get(c.pipeline)?.name : undefined
    const pipeline = name && label.pipeline(name, c.account !== null)
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-[0.3rem]">
        <Pill size="sm">{label.stage(c.stage, c.account !== null)}</Pill>
        {pipeline && <Pill size="sm">{pipeline}</Pill>}
        {suggested && (
          <button
            type="button"
            title={s.confirmCard(label.stage(suggested.name))}
            aria-label={s.confirmCard(label.stage(suggested.name))}
            className="inline-flex min-w-0 rounded-[0.3rem] focus-visible:outline-2 focus-visible:outline-brand"
            onClick={(e) => {
              e.stopPropagation()
              useClients.getState().openMap(c.account ? accountKey(c.account) : "")
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Pill size="sm" tone="warn">
              {s.unconfirmed}
            </Pill>
          </button>
        )}
      </span>
    )
  }
  return (
    <>
      <p className="sr-only" id="clients-drag-hint">
        {m.dragHint}
      </p>
      <Board columns={ids.length} boardRef={board} fill>
        {ids.map((id) => {
          const all = shown(id)
          const limit = limits[id] ?? COLUMN_PAGE
          // The card carried by keyboard stays on screen wherever it lands.
          const refs = all.filter((ref, at) => at < limit || ref === held?.key)
          const hidden = all.length - refs.length
          const b = read.base.find((x) => x.ref === id)
          const here = (columns.get(id) ?? []).flatMap((r) => byRef.get(r) ?? [])
          // One read holds the newest open cards only; memo counts every open one, so a column says what it is
          // missing. A filter counts what it shows.
          const loaded = here.filter((c) => c.status === "open").length
          const missing = filtered ? 0 : Math.max(0, (counts.get(id) ?? 0) - loaded)
          const items = here.length + missing
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
                  <Button size="sm" variant="ghost" onClick={() => useClients.getState().openMap("")}>
                    {s.mapStages}
                  </Button>
                ) : undefined
              }
              target={drag?.to === id}
              tiles
              footer={missing > 0 ? m.notLoaded(missing) : undefined}
              empty={
                refs.length === 0 && !drag && missing === 0
                  ? id === UNSORTED
                    ? s.unsortedEmpty
                    : m.emptyColumn
                  : undefined
              }
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
                      dragging={drag !== null}
                      badge={badge(c)}
                      pipeline={label.pipeline(pipes.get(c.pipeline)?.name ?? "", c.account !== null) || undefined}
                      notice={why && <Refused why={why} account={accountKey(c.account)} />}
                      onPointerDown={movable ? (e) => onPointerDown(e, ref) : undefined}
                      onKeyDown={(e) => {
                        if (movable || e.key === "Enter") onKeyDown(e, ref)
                      }}
                      onOpen={() => onClick(ref)}
                    />
                  </li>
                )
              })}
              {hidden > 0 && (
                <li className="px-[0.6rem] pb-[0.6rem]">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setLimits((l) => ({ ...l, [id]: limit + COLUMN_PAGE }))}
                  >
                    {m.showMore(Math.min(hidden, COLUMN_PAGE))}
                  </Button>
                </li>
              )}
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
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
    </>
  )
}

export function Refused({ why, account }: { why: Refusal; account: string }) {
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
            useClients.getState().openMap(account)
          }}
        >
          {s.mapStages}
        </Button>
      )}
    </ErrorNotice>
  )
}
