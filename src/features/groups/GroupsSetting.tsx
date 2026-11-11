import { Copy, Lock, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  ALL,
  accountName,
  type Change,
  changeOf,
  columnsOf,
  editable,
  type Group,
  type Member,
  nameProblem,
} from "@/domain/groups"
import { gapFromRead } from "@/domain/needs"
import { useMessages } from "@/i18n"
import { ToolNeeded } from "@/shared/ToolNeeded"
import { Board, DragCopy, useBoardDrag, useSlide } from "@/ui/Board"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { cx } from "@/ui/cx"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { fieldFocus } from "@/ui/field"
import { InfoTip } from "@/ui/InfoTip"
import { SectionTitle } from "@/ui/SectionTitle"
import { Skeleton } from "@/ui/Skeleton"
import { GroupCard, Profiles } from "./GroupCard"
import { groupsMessages } from "./messages"
import { useGroups } from "./store"

const SEP = "/"
/** What `groups.rs` answers when memo has no `groups update` yet. */
const OLD_MEMO = "memo.old"
/** A card's key on the board: an account can sit in several columns, so the column is part of it. */
const cardKey = (group: string, source: string) => `${group}${SEP}${source}`
const split = (key: string) => {
  const at = key.indexOf(SEP)
  return { group: key.slice(0, at), source: key.slice(at + 1) }
}

export function GroupsSetting() {
  const m = useMessages(groupsMessages)
  const read = useGroups((s) => s.read)
  const readError = useGroups((s) => s.readError)

  useEffect(() => {
    void useGroups.getState().load()
  }, [])

  return (
    <section aria-labelledby="groups-title" className="flex flex-col gap-4 border-t border-line pt-[1.5rem]">
      <div>
        <SectionTitle id="groups-title">{m.title}</SectionTitle>
        <p className="mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">
          {m.intro}{" "}
          <InfoTip label={m.profilesLabel} className="align-middle">
            {m.profilesTip}
          </InfoTip>
        </p>
      </div>
      {readError ? (
        <ErrorNotice
          action={
            <Button size="sm" onClick={() => void useGroups.getState().load()}>
              {m.retry}
            </Button>
          }
          raw={readError}
        >
          {m.readFailed}
        </ErrorNotice>
      ) : read === null ? (
        <BoardPlaceholder />
      ) : read.kind === "missing" || read.kind === "old" ? (
        <MemoNeeded read={read} />
      ) : (
        <GroupsBoard groups={read.groups} unresolved={read.unresolved} />
      )}
    </section>
  )
}

function MemoNeeded({ read }: { read: { kind: "missing" } | { kind: "old"; version: string | null } }) {
  const gap = gapFromRead(read)
  return gap && <ToolNeeded gap={gap} inline />
}

function BoardPlaceholder() {
  const m = useMessages(groupsMessages)
  return (
    <div className="grid grid-cols-[repeat(3,minmax(13rem,1fr))] gap-[0.75rem] overflow-x-auto overflow-y-hidden">
      {[3, 2, 3].map((cards, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity of their own
        <div key={i} className="rounded-[0.2rem] border border-line-strong bg-app">
          <div className="flex h-[3rem] items-center border-line border-b px-[0.9rem]">
            <Skeleton chars={8} {...(i === 0 ? { label: m.loading } : {})} />
          </div>
          {Array.from({ length: cards }, (_, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity of their own
            <Skeleton key={j} className="m-[0.6rem] h-[3.4rem]" />
          ))}
        </div>
      ))}
    </div>
  )
}

function GroupsBoard({ groups, unresolved }: { groups: Group[]; unresolved: string[] }) {
  const m = useMessages(groupsMessages)
  const drafts = useGroups((s) => s.drafts)
  const refused = useGroups((s) => s.refused)
  const [said, setSaid] = useState("")
  const board = useRef<HTMLDivElement>(null)
  const saved = groups.map((g) => g.name)
  const columns = [
    ...columnsOf(groups),
    ...drafts.filter((d) => !saved.includes(d)).map((name) => ({ name, members: [], suggested: [] })),
  ]
  const all = groups.find((g) => g.name === ALL)?.members ?? []
  const label = (name: string) => (name === ALL ? m.all : name)
  useSlide(board, columns.map((g) => `${g.name}:${g.members.map((x) => x.source).join()}`).join("|"))

  const nameOf = (source: string) => {
    const x = all.find((one) => one.source === source)
    return x ? accountName(x) : source
  }
  const apply = async (change: Change | null) => {
    if (!change || !(await useGroups.getState().change(change))) return
    const who = nameOf(change.source)
    setSaid(
      change.kind === "remove"
        ? m.removed(who, label(change.group))
        : change.kind === "move"
          ? m.moved(who, label(change.to))
          : m.copied(who, label(change.group)),
    )
  }
  const drop = (source: string, from: string, to: string, copy: boolean) =>
    void apply(changeOf(groups, source, from, to, copy))

  const {
    drag,
    said: boardSaid,
    onPointerDown,
  } = useBoardDrag({
    columnOf: (key) => split(key).group,
    copyable: true,
    // Nothing goes into `all`, and a card dropped where it is changes nothing.
    canDrop: (key, to) => (editable(to) ? to !== split(key).group : m.allHoldsEvery),
    onDrop: ({ key, to, copy }) => {
      const { group, source } = split(key)
      drop(source, group, to, copy)
    },
    // Only refusals and Escape: a change is said once memo has made it ("moved to …", "copied to …").
    words: {
      putBack: (key, why) => {
        const who = nameOf(split(key).source)
        return why ? m.putBackWhy(who, why) : m.putBack(who)
      },
    },
  })
  const lifted = drag ? split(drag.key) : null
  const liftedMember = lifted && all.find((x) => x.source === lifted.source)
  const copyDrop = Boolean(drag && lifted && (drag.copy || !editable(lifted.group)))

  return (
    <>
      <p className="sr-only" id="groups-drag-hint">
        {m.dragHint}
      </p>
      <Collapse open={refused !== null}>
        <ErrorNotice
          inline
          action={
            <Button size="sm" variant="ghost" onClick={() => useGroups.getState().dismiss()}>
              {m.dismiss}
            </Button>
          }
        >
          {refused && (refused.message === OLD_MEMO ? m.scopeOld : m.refused(refused.message))}
        </ErrorNotice>
      </Collapse>
      {unresolved.length > 0 && <p className="text-[0.9rem] text-warn-ink">{m.unresolved(unresolved.join(", "))}</p>}
      <Board columns={columns.length + 1} boardRef={board}>
        {columns.map((g) => {
          const target = drag?.to === g.name && editable(g.name) && lifted?.group !== g.name
          return (
            <section
              key={g.name}
              data-column={g.name}
              aria-label={m.column(label(g.name), g.members.length)}
              className={cx(
                "flex min-h-[14rem] min-w-0 flex-col rounded-[0.2rem] border bg-app transition-colors duration-(--motion-fast)",
                target ? "border-brand/60" : "border-line-strong",
              )}
            >
              <h3 className="flex h-[3rem] items-center gap-[0.55rem] border-line border-b px-[0.9rem]">
                {g.name === ALL && <Lock className="size-[0.9rem] text-ink-dim" aria-hidden />}
                <span className="truncate text-[1rem] font-semibold">{label(g.name)}</span>
                <span className="font-mono text-[0.85rem] tabular-nums text-ink-dim">{g.members.length}</span>
              </h3>
              {g.name === ALL && (
                <p className="px-[0.9rem] pt-[0.6rem] text-[0.85rem] text-ink-dim">
                  {m.allNote}
                  {g.members.some((x) => x.scope !== null) && ` ${m.scopeNote}`}
                </p>
              )}
              <ul data-scroller className="scroll-quiet flex max-h-[22rem] min-h-0 flex-1 flex-col overflow-y-auto">
                {g.members.map((x) => (
                  <li key={x.source} className="contents">
                    <GroupCard
                      cardKey={cardKey(g.name, x.source)}
                      group={g.name}
                      member={x}
                      groups={columns.map((c) => c.name).filter(editable)}
                      label={label}
                      ghost={drag?.key === cardKey(g.name, x.source) && !copyDrop}
                      onPointerDown={(e) => onPointerDown(e, cardKey(g.name, x.source))}
                      onChoose={(to, copy) => drop(x.source, g.name, to, copy)}
                      onRemove={() => void apply({ kind: "remove", group: g.name, source: x.source })}
                    />
                  </li>
                ))}
                {g.members.length === 0 && (
                  <li className="px-[0.9rem] py-[1rem] text-[0.9rem] text-ink-dim">
                    {saved.includes(g.name) ? m.empty : m.newEmpty}
                  </li>
                )}
              </ul>
              {g.suggested.length > 0 && (
                <Suggestions group={g.name} sources={g.suggested} all={all} onAdd={(s) => drop(s, ALL, g.name, true)} />
              )}
            </section>
          )
        })}
        <NewGroup taken={columns.map((g) => g.name)} />
      </Board>
      {drag && liftedMember && (
        <DragCopy drag={drag}>
          <div className="flex items-center gap-[0.5rem] px-[0.9rem] py-[0.7rem]">
            <Profiles member={liftedMember} />
            {copyDrop && (
              <span className="ml-auto inline-flex items-center gap-1 text-[0.85rem] text-brand">
                <Copy className="size-[0.85rem]" aria-hidden />
                {m.copy}
              </span>
            )}
          </div>
        </DragCopy>
      )}
      <p aria-live="assertive" className="sr-only">
        {said}
      </p>
      <p aria-live="assertive" className="sr-only">
        {boardSaid}
      </p>
    </>
  )
}

function Suggestions(props: { group: string; sources: string[]; all: Member[]; onAdd: (source: string) => void }) {
  const m = useMessages(groupsMessages)
  return (
    <div className="border-line border-t px-[0.9rem] py-[0.6rem]">
      <p className="text-[0.85rem] text-ink-dim">{m.suggested}</p>
      <ul className="mt-[0.4rem] flex flex-col gap-[0.4rem]">
        {props.sources.map((s) => {
          const member = props.all.find((x) => x.source === s)
          const named = member?.profiles.find((p) => p.endsWith(` ${props.group}`))
          return (
            <li
              key={s}
              className="flex items-center gap-[0.5rem] rounded-[0.3rem] border border-dashed border-line-strong p-[0.5rem]"
            >
              <span className="min-w-0 flex-1">
                {member ? <Profiles member={member} /> : <span className="font-mono text-[0.9rem]">{s}</span>}
                {named && <span className="block text-[0.8rem] text-ink-dim">{m.suggestedWhy(named)}</span>}
              </span>
              <Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => props.onAdd(s)}>
                {m.add}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function NewGroup({ taken }: { taken: string[] }) {
  const m = useMessages(groupsMessages)
  const [name, setName] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  const why = { empty: m.nameEmpty, reserved: m.nameReserved, chars: m.nameChars, taken: m.nameTaken }
  const create = () => {
    const p = nameProblem(name, taken)
    if (p) return setProblem(why[p])
    useGroups.getState().draft(name.trim())
    setName("")
    setProblem(null)
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        create()
      }}
      className="flex min-h-[14rem] flex-col gap-[0.6rem] rounded-[0.2rem] border border-dashed border-line-strong p-[0.9rem]"
    >
      <label htmlFor="groups-new" className="text-[1rem] font-semibold">
        {m.newGroup}
      </label>
      <input
        id="groups-new"
        value={name}
        maxLength={64}
        placeholder={m.newName}
        aria-invalid={problem !== null || undefined}
        aria-describedby={problem ? "groups-new-problem" : undefined}
        onChange={(e) => {
          setName(e.target.value)
          setProblem(null)
        }}
        className={cx(
          "selectable h-[2.4rem] w-full rounded-[0.35rem] border bg-app px-[0.625rem] text-[0.95rem] text-ink placeholder:text-ink-dim",
          fieldFocus,
          problem ? "border-bad" : "border-line-strong",
        )}
      />
      <p id="groups-new-problem" className="min-h-[1.3rem] text-[0.85rem] text-bad">
        {problem}
      </p>
      <Button type="submit" size="sm" icon={<Plus className="size-4" aria-hidden />} className="self-start">
        {m.create}
      </Button>
    </form>
  )
}
