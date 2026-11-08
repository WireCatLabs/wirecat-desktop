import { Check, CheckCheck, LayoutGrid } from "lucide-react"
import { Fragment, useRef } from "react"
import { mapColumnsOf, mapDropOf, UNMAPPED, unconfirmedOf } from "@/domain/base-stages"
import type { Kind } from "@/domain/clients"
import { useMessages } from "@/i18n"
import type { CrmPipeline, CrmStageMap } from "@/platform/bindings"
import { Board, BoardColumn, cardClass, DragCopy, DropLine, useBoardDrag, useSlide } from "@/ui/Board"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Pill } from "@/ui/Pill"
import { type Based, useBaseEdit, useConfirm, useMapSet } from "./api"
import { AddStage, StageTools } from "./BaseStageTools"
import { OutcomeLamp } from "./ClientsBoard"
import { clientMessages } from "./messages"
import { stageMessages } from "./messages-stages"
import { useClients } from "./store"

const message = (e: Error | null) => e?.message ?? ""

/** Every pipeline's stages as cards on the base set's columns: drag one to remap it, confirm memo's suggestions. */
export function StageMap({ read, kind }: { read: Based; kind: Kind }) {
  const m = useMessages(clientMessages)
  const s = useMessages(stageMessages)
  const asked = useClients((st) => st.pipeline[kind] ?? null)
  const set = useMapSet(kind, asked)
  const confirm = useConfirm(kind, asked)
  const edit = useBaseEdit(kind, asked)
  const byRef = new Map(read.mapping.map((x) => [x.ref, x]))
  const pipes = new Map(read.pipelines.map((p) => [p.ref, p]))
  const columns = mapColumnsOf(read.base, read.mapping, read.pipelines)
  const ids = [...read.base.map((b) => b.ref), UNMAPPED]
  const nameOf = (id: string) => (id === UNMAPPED ? s.unmapped : (read.base.find((b) => b.ref === id)?.name ?? id))
  const pending = unconfirmedOf(read.mapping, read.pipelines)
  const total = pending.reduce((n, p) => n + p.count, 0)
  const mapTo = (stage: string, to: string) => {
    const b = read.base.find((x) => x.ref === to)
    if (b) set.mutate({ stage, base: { ref: b.ref, name: b.name } })
  }
  const board = useRef<HTMLDivElement>(null)
  useSlide(board, read.mapping.map((x) => `${x.ref}:${x.base?.ref}`).join())
  const { drag, held, said, shown, onPointerDown, onClick, onKeyDown } = useBoardDrag<string>({
    columns: ids,
    cardsIn: (id) => columns.get(id) ?? [],
    columnOf: (ref) => (byRef.has(ref) ? (byRef.get(ref)?.base?.ref ?? UNMAPPED) : undefined),
    canDrop: (_ref, to) => mapDropOf(to) === true || s.refusal.toUnmapped,
    onDrop: ({ key, to }) => mapTo(key, to),
    words: {
      picked: (ref) => m.picked(byRef.get(ref)?.name ?? ref),
      place: (id, at, of) => m.place(nameOf(id), at, of),
      dropped: (ref, id) => m.dropped(byRef.get(ref)?.name ?? ref, nameOf(id)),
      putBack: (ref, reason) => m.putBack(byRef.get(ref)?.name ?? ref, reason),
    },
  })
  const busy = edit.isPending || confirm.isPending
  const dragged = drag ? byRef.get(drag.key) : undefined
  const failed = set.error ?? confirm.error ?? edit.error
  return (
    <>
      <div className="flex flex-col gap-[0.7rem]">
        <p className="max-w-[80ch] text-[0.95rem] text-ink-soft">{s.mapIntro}</p>
        <div className="flex flex-wrap items-center gap-[0.6rem]">
          {pending.map((p) => (
            <Button
              key={p.pipeline}
              size="sm"
              disabled={busy}
              icon={<Check className="size-4" aria-hidden />}
              onClick={() => confirm.mutate([p.pipeline])}
            >
              {s.confirmPipeline(pipes.get(p.pipeline)?.name ?? p.pipeline, p.count)}
            </Button>
          ))}
          {total > 0 ? (
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              icon={<CheckCheck className="size-4" aria-hidden />}
              onClick={() => confirm.mutate(pending.map((p) => p.pipeline))}
            >
              {s.confirmAll(total)}
            </Button>
          ) : (
            <span className="text-[0.9rem] text-ink-soft">{s.allConfirmed}</span>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-[0.6rem]">
            <AddStage base={read.base} busy={busy} onEdit={(e) => edit.mutate(e)} />
            <Button
              size="sm"
              variant="ghost"
              icon={<LayoutGrid className="size-4" aria-hidden />}
              onClick={() => useClients.getState().setView("board")}
            >
              {s.backToBoard}
            </Button>
          </span>
        </div>
        {failed && <ErrorNotice inline>{s.failed(message(failed))}</ErrorNotice>}
      </div>
      <p className="sr-only" id="clients-map-hint">
        {m.dragHint}
      </p>
      <Board columns={ids.length} boardRef={board}>
        {ids.map((id) => {
          const refs = shown(id)
          const b = read.base.find((x) => x.ref === id)
          return (
            <BoardColumn
              key={id}
              id={id}
              label={s.stageColumn(nameOf(id), refs.length)}
              lamp={b ? <OutcomeLamp outcome={b.outcome} /> : <Lamp tone="warn" size="sm" />}
              name={nameOf(id)}
              count={refs.length}
              aside={b && <StageTools stage={b} base={read.base} busy={busy} onEdit={(e) => edit.mutate(e)} />}
              target={drag?.to === id}
              empty={refs.length === 0 && !drag ? (b ? s.noStages : s.unmappedEmpty) : undefined}
            >
              {refs.map((ref, i) => {
                const x = byRef.get(ref)
                if (!x) return null
                const first = byRef.get(refs[i - 1] ?? "")?.pipeline !== x.pipeline
                return (
                  <Fragment key={ref}>
                    {first && <PipelineLine pipeline={pipes.get(x.pipeline)} />}
                    <li className="contents">
                      {drag && drag.to === id && drag.before === ref && <DropLine />}
                      {/* biome-ignore lint/a11y/useSemanticElements: the card holds its own Confirm button */}
                      <div
                        role="button"
                        tabIndex={0}
                        data-card={ref}
                        aria-label={s.stageCard(x.name, pipes.get(x.pipeline)?.name ?? x.pipeline)}
                        aria-roledescription={m.draggable}
                        aria-describedby="clients-map-hint"
                        aria-pressed={held?.key === ref || undefined}
                        onPointerDown={(e) => onPointerDown(e, ref)}
                        onKeyDown={(e) => onKeyDown(e, ref)}
                        onClick={() => onClick(ref)}
                        className={cardClass(drag?.key === ref, held?.key === ref)}
                      >
                        <StageCard
                          stage={x}
                          kind={kind}
                          onConfirm={x.base ? () => mapTo(x.ref, x.base?.ref ?? "") : undefined}
                        />
                      </div>
                    </li>
                  </Fragment>
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
          <StageCard stage={dragged} kind={kind} />
        </DragCopy>
      )}
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
    </>
  )
}

function PipelineLine({ pipeline }: { pipeline: CrmPipeline | undefined }) {
  const m = useMessages(clientMessages)
  if (!pipeline) return null
  return (
    <li className="truncate border-line border-b bg-app-2 px-[0.9rem] py-[0.3rem] text-[0.85rem] text-ink-soft">
      {pipeline.name} · {pipeline.account ? pipeline.account.account : m.ownAccount}
    </li>
  )
}

function StageCard({
  stage,
  kind,
  onConfirm,
}: {
  stage: CrmStageMap
  kind: Kind
  onConfirm?: (() => void) | undefined
}) {
  const s = useMessages(stageMessages)
  return (
    <div className="flex flex-col gap-[0.35rem] px-[0.9rem] py-[0.6rem]">
      <p className="flex min-w-0 items-center gap-[0.5rem] text-[0.95rem] font-medium">
        <OutcomeLamp outcome={stage.outcome} />
        <span className="min-w-0 truncate">{stage.name}</span>
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-[0.4rem] text-[0.85rem] text-ink-soft">
        <span>{s.items(kind, stage.items)}</span>
        {!stage.confirmed && stage.base && <Pill tone="warn">{s.suggestedShort}</Pill>}
        {!stage.confirmed && stage.base && onConfirm && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation()
              onConfirm()
            }}
          >
            {s.confirm}
          </Button>
        )}
      </div>
    </div>
  )
}
