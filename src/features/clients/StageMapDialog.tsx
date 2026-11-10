import { Check, CheckCheck } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
import { SplitButton } from "@/ui/SplitButton"
import { type Based, useBaseEdit, useBoard, useConfirm, useMapSet, useStageName } from "./api"
import { AddStage, StageMenu, StageRename } from "./BaseStageTools"
import { OutcomeLamp } from "./Card"
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
  const names = useStageName(kind)
  const pipeline = useClients((st) => st.pipeline[kind] ?? null)
  const set = useMapSet(kind, pipeline)
  const confirm = useConfirm(kind, pipeline)
  const edit = useBaseEdit(kind, pipeline)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [problem, setProblem] = useState<{ ref: string; text: string } | null>(null)
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
  const nameOf = (id: string) => {
    const b = read.base.find((x) => x.ref === id)
    return id === UNMAPPED ? s.unmapped : b ? names.stage(b.name) : id
  }
  const pending = unconfirmedOf(mapping, pipelines)
  const suggestions = pending.reduce((n, p) => n + p.count, 0)
  const layout = mapping.map((x) => `${x.ref}:${x.base?.ref}:${x.confirmed}`).join()
  const root = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLDivElement>(null)
  useSlide(board, layout)
  // Where the keyboard goes once the mapping has changed: the badge or button pressed is gone or drawn anew by then.
  const focusTo = useRef<{ target: string; from: string } | null>(null)
  // A confirm button stays disabled while a write runs, so the target is tried again once it ends.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the target is looked up after each change of the mapping
  useEffect(() => {
    const to = focusTo.current
    const el = to && to.from !== layout ? root.current?.querySelector<HTMLElement>(to.target) : null
    if (!el) return
    el.focus()
    if (document.activeElement === el) focusTo.current = null
  }, [layout, set.isPending, confirm.isPending])
  const waiting = columns.get(UNMAPPED) ?? []
  const badgeOf = (ref: string) => `[data-card="${ref}"]`
  /** After a stage leaves Unmapped, the next one there (its confirm, when memo suggests a place), else the stage. */
  const nextAfter = (ref: string) => {
    const rest = waiting.filter((r) => r !== ref)
    const at = waiting.indexOf(ref)
    const next = at < 0 ? undefined : (rest[at] ?? rest[at - 1])
    if (!next) return badgeOf(ref)
    return byRef.get(next)?.base ? `[data-suggest="${next}"]` : badgeOf(next)
  }
  const mapTo = (stage: string, to: string, focus = badgeOf(stage)) => {
    const b = read.base.find((x) => x.ref === to)
    const x = byRef.get(stage)
    if (!b || (x?.confirmed && x.base?.ref === to)) return
    setProblem(null)
    focusTo.current = { target: focus, from: layout }
    set.mutate({ stage, base: { ref: b.ref, name: b.name } })
  }
  const confirmAll = () => {
    const left = waiting.find((r) => !byRef.get(r)?.base)
    focusTo.current = { target: left ? badgeOf(left) : 'input[type="radio"]:checked', from: layout }
    setProblem(null)
    confirm.mutate(pending.map((p) => p.pipeline))
  }
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
  const onEdit = (e: Parameters<typeof edit.mutate>[0]) => {
    setProblem(null)
    edit.mutate(e)
  }
  const endRename = (ref: string) => {
    setRenaming(null)
    // The field goes, so the keyboard goes back to the menu it came from.
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>(`[data-column="${ref}"] [aria-haspopup="menu"]`)?.focus(),
    )
  }
  const template = [
    ...ids.map((id) => (id === UNMAPPED ? "minmax(20rem, 1.5fr)" : "minmax(13rem, 1fr)")),
    "minmax(12rem, max-content)",
  ].join(" ")
  return (
    <div ref={root} className="flex flex-col gap-[0.9rem] pb-[0.2rem]">
      {/* The dialog starts here, not on the ×: a ring around the × on open read as a warning. */}
      <p data-autofocus tabIndex={-1} className="step-heading max-w-[80ch]">
        {s.mapIntro[kind]}
      </p>
      <div className="flex flex-wrap items-center gap-[0.6rem]">
        <Segmented<string>
          label={s.crm}
          value={key ?? ""}
          onChange={(k) => {
            setProblem(null)
            useClients.getState().openMap(k)
          }}
          labelClass=""
          options={[...crms].map(([k, c]) => ({
            value: k,
            label: `${crmToolOf(c.account.provider)?.name ?? c.account.provider} · ${c.account.account}`,
            icon: <Lamp tone={c.waiting > 0 ? "warn" : "ok"} size="sm" />,
          }))}
        />
        {crm.waiting === 0 && <span className="text-[0.9rem]">{s.allConfirmed}</span>}
      </div>
      {failed && <ErrorNotice inline>{s.failed(message(failed))}</ErrorNotice>}
      <p className="sr-only" id="clients-map-hint">
        {m.dragHint}
      </p>
      <Board columns={ids.length + 1} template={template} boardRef={board}>
        {ids.map((id) => {
          const refs = shown(id)
          const b = read.base.find((x) => x.ref === id)
          const runs = byPipeline(refs, byRef)
          const mixed = new Set(runs.map((r) => r.pipeline)).size > 1
          return (
            <BoardColumn
              key={id}
              id={id}
              label={s.stageColumn(nameOf(id), refs.length)}
              lamp={b ? <OutcomeMark outcome={b.outcome} /> : <Lamp tone="warn" size="sm" />}
              name={nameOf(id)}
              count={refs.length}
              sticky={!b}
              tiles
              menu={
                b && (
                  <StageMenu
                    stage={{ ...b, name: nameOf(b.ref) }}
                    base={read.base}
                    busy={busy}
                    onEdit={onEdit}
                    onRename={() => {
                      setProblem(null)
                      setRenaming(b.ref)
                    }}
                    onProblem={(text) => setProblem({ ref: b.ref, text })}
                  />
                )
              }
              aside={
                b ? (
                  renaming === b.ref ? (
                    <StageRename
                      stage={{ ...b, name: nameOf(b.ref) }}
                      base={read.base}
                      onEdit={onEdit}
                      onDone={() => endRename(b.ref)}
                    />
                  ) : problem?.ref === b.ref ? (
                    <ErrorNotice inline>{problem.text}</ErrorNotice>
                  ) : undefined
                ) : (
                  <span className="flex flex-col items-stretch gap-[0.5rem] pb-[0.3rem]">
                    {s.unmappedHint}
                    {suggestions > 0 && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy}
                        icon={<CheckCheck className="size-4" aria-hidden />}
                        onClick={confirmAll}
                      >
                        {s.acceptAll(suggestions)}
                      </Button>
                    )}
                  </span>
                )
              }
              target={drag?.to === id}
            >
              {refs.length === 0 && b && (
                <li
                  className={cx(
                    "rounded-[0.45rem] border border-dashed px-[0.75rem] py-[1.1rem] text-center text-[0.9rem] transition-colors duration-(--motion-fast)",
                    drag?.to === id ? "border-brand/60 bg-brand-soft/50 text-ink" : "border-line-strong text-ink-dim",
                  )}
                >
                  {s.dropHere}
                </li>
              )}
              {runs.map((g) => (
                <li key={g.key} className="flex flex-col gap-[0.4rem]">
                  {mixed && (
                    <p className="truncate px-[0.2rem] pt-[0.2rem] text-[0.8rem] text-ink-dim">
                      {pipes.get(g.pipeline)?.name}
                    </p>
                  )}
                  <ul className="flex flex-col gap-[0.4rem]">
                    {g.stages.map((x) => {
                      const to = !x.confirmed ? x.base : null
                      return (
                        <li
                          key={x.ref}
                          data-slide={x.ref}
                          className={cx(
                            "rounded-[0.45rem] border bg-app transition-[border-color,box-shadow] duration-(--motion-fast)",
                            drag?.key === x.ref
                              ? "border-line-strong border-dashed bg-app-3 [&>*]:invisible"
                              : "border-line hover:border-line-strong",
                            held?.key === x.ref && "relative z-10 shadow-panel outline-2 outline-brand",
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
                            title={pipelines.length > 1 ? pipes.get(x.pipeline)?.name : undefined}
                            onPointerDown={(e) => onPointerDown(e, x.ref)}
                            onKeyDown={(e) => onKeyDown(e, x.ref)}
                            onClick={() => onClick(x.ref)}
                            className="flex cursor-grab touch-none items-baseline gap-[0.45rem] rounded-[0.45rem] px-[0.7rem] py-[0.5rem] text-[0.95rem] leading-snug text-ink select-none [-webkit-user-select:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                          >
                            <StageBadge stage={x} kind={kind} />
                          </span>
                          {to && (
                            <div className="flex items-center gap-[0.4rem] border-line border-t py-[0.3rem] pr-[0.25rem] pl-[0.7rem]">
                              <span className="text-[0.85rem] text-ink-dim">{s.suggested}</span>
                              <button
                                type="button"
                                aria-label={s.confirmTo(names.stage(to.name))}
                                title={s.confirmTo(names.stage(to.name))}
                                data-suggest={x.ref}
                                disabled={busy}
                                onClick={() => mapTo(x.ref, to.ref, nextAfter(x.ref))}
                                className="inline-flex min-w-0 items-center gap-[0.3rem] rounded-[0.3rem] bg-warn/15 px-[0.5rem] py-[0.15rem] text-[0.875rem] font-medium text-warn-ink transition-colors duration-(--motion-fast) hover:bg-warn/25 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-45"
                              >
                                <Check className="size-[0.9rem] shrink-0" strokeWidth={2.4} aria-hidden />
                                <span className="truncate">{names.stage(to.name)}</span>
                              </button>
                              <SplitButton
                                compact
                                className="ml-auto"
                                disabled={busy}
                                menuLabel={s.chooseOther(x.name)}
                                moreLabel={s.chooseOther(x.name)}
                                items={read.base
                                  .filter((b) => b.ref !== to.ref)
                                  .map((b) => ({
                                    label: names.stage(b.name),
                                    onSelect: () => mapTo(x.ref, b.ref, nextAfter(x.ref)),
                                  }))}
                              />
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </BoardColumn>
          )
        })}
        <div className="self-start">
          <AddStage base={read.base} busy={busy} onEdit={onEdit} />
        </div>
      </Board>
      {drag && dragged && (
        <DragCopy drag={drag}>
          <span className="flex items-baseline gap-[0.45rem] px-[0.7rem] py-[0.5rem] text-[0.95rem] leading-snug text-ink">
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

/** Only a won or lost stage carries a lamp: an open one is the usual kind, and a ring on every badge said nothing. */
function OutcomeMark({ outcome }: { outcome: string }) {
  const s = useMessages(stageMessages)
  if (outcome !== "won" && outcome !== "lost") return null
  return <OutcomeLamp outcome={outcome} label={s.outcomes[outcome]} />
}

/**
 * A column's stages in runs of one pipeline, so each run gets its pipeline's name once. A run is keyed by its pipeline,
 * never its first stage: a run whose first stage leaves would be drawn anew and lose the keyboard's focus.
 */
function byPipeline(refs: readonly string[], byRef: ReadonlyMap<string, CrmStageMap>) {
  const runs: { key: string; pipeline: string; stages: CrmStageMap[] }[] = []
  for (const ref of refs) {
    const x = byRef.get(ref)
    if (!x) continue
    const last = runs.at(-1)
    if (last?.pipeline === x.pipeline) last.stages.push(x)
    else {
      // A badge carried by keyboard can split its pipeline's run in two for a moment.
      const seen = runs.filter((r) => r.pipeline === x.pipeline).length
      runs.push({ key: `${x.pipeline}:${seen}`, pipeline: x.pipeline, stages: [x] })
    }
  }
  return runs
}

function StageBadge({ stage, kind }: { stage: CrmStageMap; kind: Kind }) {
  const s = useMessages(stageMessages)
  return (
    <>
      <span className="shrink-0 self-center empty:hidden">
        <OutcomeMark outcome={stage.outcome} />
      </span>
      <span className="min-w-0 hyphens-auto [overflow-wrap:break-word]">
        {stage.name}
        {stage.open > 0 && (
          <span
            title={s.items(kind, stage.open)}
            className="ml-[0.45rem] font-mono text-[0.8rem] whitespace-nowrap tabular-nums text-ink-dim"
          >
            {stage.open}
          </span>
        )}
      </span>
    </>
  )
}
