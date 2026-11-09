import { CheckCheck } from "lucide-react"
import { useRef } from "react"
import { crmsOf, crmToOpen, mapColumnsOf, mapDropOf, UNMAPPED, unconfirmedOf } from "@/domain/base-stages"
import { crmToolOf } from "@/domain/catalog"
import type { Kind } from "@/domain/clients"
import { useMessages } from "@/i18n"
import type { CrmStageMap } from "@/platform/bindings"
import { Board, BoardColumn, DragCopy, useBoardDrag, useSlide } from "@/ui/Board"
import { Button } from "@/ui/Button"
import { cx } from "@/ui/cx"
import { Dialog } from "@/ui/Dialog"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Lamp } from "@/ui/Lamp"
import { Segmented } from "@/ui/Segmented"
import { type Based, useBaseEdit, useBoard, useConfirm, useMapSet } from "./api"
import { AddStage, StageTools } from "./BaseStageTools"
import { OutcomeLamp } from "./ClientsBoard"
import { clientMessages } from "./messages"
import { stageMessages } from "./messages-stages"
import { useClients } from "./store"

const message = (e: Error | null) => e?.message ?? ""

/** One CRM's stages as badges on the base set's columns, the unconfirmed ones in Unmapped until the owner places them. */
export function StageMapDialog() {
  const s = useMessages(stageMessages)
  const kind = useClients((st) => st.kind)
  const pipeline = useClients((st) => st.pipeline[kind] ?? null)
  const mapOn = useClients((st) => st.mapOn)
  const { data } = useBoard(kind, pipeline)
  const read = data?.kind === "base" ? data : undefined
  return (
    <Dialog
      open={mapOn !== null && read !== undefined}
      wide="full"
      scroll
      title={s.mapTitle[kind]}
      onClose={() => useClients.getState().openMap(null)}
    >
      {read && <StageMap read={read} kind={kind} asked={mapOn} />}
    </Dialog>
  )
}

function StageMap({ read, kind, asked }: { read: Based; kind: Kind; asked: string | null }) {
  const m = useMessages(clientMessages)
  const s = useMessages(stageMessages)
  const pipeline = useClients((st) => st.pipeline[kind] ?? null)
  const set = useMapSet(kind, pipeline)
  const confirm = useConfirm(kind, pipeline)
  const edit = useBaseEdit(kind, pipeline)
  const crms = crmsOf(read.pipelines, read.mapping)
  const key = crmToOpen(crms, asked)
  const crm = key ? crms.get(key) : undefined
  const pipelines = read.pipelines.filter((p) => crm?.pipelines.includes(p.ref))
  const mapping = read.mapping.filter((x) => crm?.pipelines.includes(x.pipeline))
  const byRef = new Map(mapping.map((x) => [x.ref, x]))
  const pipes = new Map(pipelines.map((p) => [p.ref, p]))
  const columns = mapColumnsOf(read.base, mapping, pipelines)
  const ids = [...columns.keys()]
  const columnOf = new Map([...columns].flatMap(([id, refs]) => refs.map((ref) => [ref, id] as const)))
  const nameOf = (id: string) => (id === UNMAPPED ? s.unmapped : (read.base.find((b) => b.ref === id)?.name ?? id))
  const pending = unconfirmedOf(mapping, pipelines)
  const suggestions = pending.reduce((n, p) => n + p.count, 0)
  const mapTo = (stage: string, to: string) => {
    const b = read.base.find((x) => x.ref === to)
    const x = byRef.get(stage)
    if (b && !(x?.confirmed && x.base?.ref === to)) set.mutate({ stage, base: { ref: b.ref, name: b.name } })
  }
  const board = useRef<HTMLDivElement>(null)
  useSlide(board, mapping.map((x) => `${x.ref}:${x.base?.ref}:${x.confirmed}`).join())
  const label = (ref: string) => {
    const x = byRef.get(ref)
    return x ? s.stageCard(x.name, pipes.get(x.pipeline)?.name ?? x.pipeline) : ref
  }
  const { drag, held, said, shown, onPointerDown, onClick, onKeyDown } = useBoardDrag<string>({
    columns: ids,
    cardsIn: (id) => columns.get(id) ?? [],
    columnOf: (ref) => columnOf.get(ref),
    canDrop: (_ref, to) => mapDropOf(to) === true || s.refusal.toUnmapped,
    onDrop: ({ key, to }) => mapTo(key, to),
    words: {
      picked: (ref) => m.picked(label(ref)),
      place: (id, at, of) => m.place(nameOf(id), at, of),
      dropped: (ref, id) => m.dropped(label(ref), nameOf(id)),
      putBack: (ref, reason) => m.putBack(label(ref), reason),
    },
  })
  const busy = edit.isPending || confirm.isPending
  const dragged = drag ? byRef.get(drag.key) : undefined
  const failed = set.error ?? confirm.error ?? edit.error

  if (!crm) return <p>{s.noCrm}</p>
  return (
    <div className="flex flex-col gap-[0.9rem] pb-[0.2rem]">
      <p className="max-w-[80ch]">{s.mapIntro}</p>
      <div className="flex flex-wrap items-center gap-[0.6rem]">
        <Segmented<string>
          label={s.crm}
          value={key ?? ""}
          onChange={(k) => useClients.getState().openMap(k)}
          labelClass=""
          options={[...crms].map(([k, c]) => ({
            value: k,
            label: `${crmToolOf(c.account.provider)?.name ?? c.account.provider} · ${c.account.account}`,
            icon: <Lamp tone={c.waiting > 0 ? "warn" : "ok"} size="sm" />,
          }))}
        />
        {suggestions > 0 ? (
          <Button
            size="sm"
            disabled={busy}
            icon={<CheckCheck className="size-4" aria-hidden />}
            onClick={() => confirm.mutate(pending.map((p) => p.pipeline))}
          >
            {s.confirmAll(suggestions)}
          </Button>
        ) : (
          crm.waiting === 0 && <span className="text-[0.9rem]">{s.allConfirmed}</span>
        )}
        <span className="ml-auto">
          <AddStage base={read.base} busy={busy} onEdit={(e) => edit.mutate(e)} />
        </span>
      </div>
      {failed && <ErrorNotice inline>{s.failed(message(failed))}</ErrorNotice>}
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
              aside={
                b ? (
                  <StageTools stage={b} base={read.base} busy={busy} onEdit={(e) => edit.mutate(e)} />
                ) : (
                  s.unmappedHint
                )
              }
              target={drag?.to === id}
              empty={refs.length === 0 && !drag ? s.noStages : undefined}
            >
              {byPipeline(refs, byRef).map((g) => (
                <li key={g.stages[0]?.ref} className="flex flex-col gap-[0.4rem] px-[0.7rem] py-[0.6rem]">
                  {pipelines.length > 1 && (
                    <p className="truncate text-[0.8rem] text-ink-dim">{pipes.get(g.pipeline)?.name}</p>
                  )}
                  <div className="flex flex-wrap gap-[0.35rem]">
                    {g.stages.map((x) => (
                      <span
                        key={x.ref}
                        className={cx(
                          "inline-flex min-w-0 max-w-full flex-wrap items-stretch overflow-hidden rounded-[0.35rem] border bg-app text-[0.9rem] text-ink transition-[background-color,box-shadow] duration-(--motion-fast)",
                          drag?.key === x.ref
                            ? "border-line-strong border-dashed bg-app-3 [&>*]:invisible"
                            : "border-line",
                          held?.key === x.ref && "z-10 shadow-panel outline-2 outline-brand",
                        )}
                      >
                        {/* biome-ignore lint/a11y/useSemanticElements: the board's drag ignores a press that starts on a <button> */}
                        <span
                          role="button"
                          tabIndex={0}
                          data-card={x.ref}
                          aria-label={label(x.ref)}
                          aria-roledescription={m.draggable}
                          aria-describedby="clients-map-hint"
                          aria-pressed={held?.key === x.ref || undefined}
                          onPointerDown={(e) => onPointerDown(e, x.ref)}
                          onKeyDown={(e) => onKeyDown(e, x.ref)}
                          onClick={() => onClick(x.ref)}
                          className="flex min-w-0 cursor-grab touch-none items-center gap-[0.4rem] px-[0.55rem] py-[0.25rem] select-none [-webkit-user-select:none] hover:bg-app-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                        >
                          <StageBadge stage={x} kind={kind} />
                        </span>
                        {!x.confirmed && x.base && (
                          <button
                            type="button"
                            disabled={set.isPending}
                            aria-label={s.confirmTo(x.base.name)}
                            title={s.confirmTo(x.base.name)}
                            onClick={() => mapTo(x.ref, x.base?.ref ?? "")}
                            className="grow bg-warn/15 px-[0.45rem] text-left text-[0.85rem] whitespace-nowrap text-warn-ink transition-colors duration-(--motion-fast) hover:bg-warn/25 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:opacity-45"
                          >
                            {s.suggestion(x.base.name)}
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </BoardColumn>
          )
        })}
      </Board>
      {drag && dragged && (
        <DragCopy drag={drag}>
          <span className="flex items-center gap-[0.4rem] px-[0.55rem] py-[0.25rem] text-[0.9rem] text-ink">
            <StageBadge stage={dragged} kind={kind} />
          </span>
        </DragCopy>
      )}
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
    </div>
  )
}

/** A column's stages in runs of one pipeline, so each run gets its pipeline's name once. */
function byPipeline(refs: readonly string[], byRef: ReadonlyMap<string, CrmStageMap>) {
  const runs: { pipeline: string; stages: CrmStageMap[] }[] = []
  for (const ref of refs) {
    const x = byRef.get(ref)
    if (!x) continue
    const last = runs.at(-1)
    if (last?.pipeline === x.pipeline) last.stages.push(x)
    else runs.push({ pipeline: x.pipeline, stages: [x] })
  }
  return runs
}

function StageBadge({ stage, kind }: { stage: CrmStageMap; kind: Kind }) {
  const s = useMessages(stageMessages)
  return (
    <>
      <OutcomeLamp outcome={stage.outcome} />
      <span className="min-w-0 [overflow-wrap:anywhere]">{stage.name}</span>
      {stage.open > 0 && (
        <span title={s.items(kind, stage.open)} className="font-mono text-[0.8rem] tabular-nums text-ink-dim">
          {stage.open}
        </span>
      )}
    </>
  )
}
