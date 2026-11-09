import { GripVertical } from "lucide-react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { toolByBin } from "@/domain/catalog"
import { ALL, accountName, editable, isDuplicate, type Member, profileParts } from "@/domain/groups"
import { useMessages } from "@/i18n"
import { ToolIcon } from "@/shared/ToolIcon"
import { cardClass } from "@/ui/Board"
import { cx } from "@/ui/cx"
import { Pill } from "@/ui/Pill"
import { Select, type SelectOption } from "@/ui/Select"
import { groupsMessages } from "./messages"
import { useGroups } from "./store"

const NONE = ""

/**
 * One account in one column. Drag is the pointer's way; Change is the keyboard's (rule 8), with the same choices: move,
 * copy, or take it out. From `all` every choice is an add, since nothing leaves it.
 */
export function GroupCard(props: {
  cardKey: string
  group: string
  member: Member
  /** Every saved group, this one included. */
  groups: string[]
  label: (group: string) => string
  ghost: boolean
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onChoose: (to: string, copy: boolean) => void
  onRemove: () => void
}) {
  const { group, member } = props
  const m = useMessages(groupsMessages)
  const busy = useGroups((s) => s.busy)
  const duplicate = isDuplicate(group, member)
  const others = props.groups.filter((g) => g !== group && !member.alsoIn.includes(g))
  const choices: SelectOption<string>[] = editable(group)
    ? [
        ...others.map((g) => ({ value: `move:${g}`, label: m.moveTo(props.label(g)) })),
        ...others.map((g) => ({ value: `copy:${g}`, label: m.copyTo(props.label(g)) })),
        { value: "remove", label: m.removeFrom(props.label(group)) },
      ]
    : others.map((g) => ({ value: `copy:${g}`, label: m.addTo(props.label(g)) }))
  const choose = (v: string) => {
    if (v === "remove") return props.onRemove()
    const [verb, to = ""] = v.split(/:(.*)/s)
    props.onChoose(to, verb === "copy")
  }
  return (
    <div
      data-card={props.cardKey}
      aria-describedby="groups-drag-hint"
      onPointerDown={props.onPointerDown}
      className={cx(
        cardClass(props.ghost, false),
        "flex items-center gap-[0.5rem] px-[0.9rem] py-[0.65rem]",
        duplicate && "border-l-[3px] border-l-warn bg-warn/5",
      )}
    >
      <GripVertical
        className="absolute top-1/2 left-[0.05rem] size-[0.85rem] -translate-y-1/2 text-ink-dim opacity-0 group-hover:opacity-100"
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col gap-[0.3rem]">
        <Profiles member={member} />
        {member.alsoIn.length > 0 &&
          (group === ALL ? (
            <span className="text-[0.8rem] text-ink-dim">{m.inGroups(member.alsoIn.join(", "))}</span>
          ) : (
            <span>
              <Pill tone="warn">{m.alsoIn(member.alsoIn.map(props.label).join(", "))}</Pill>
            </span>
          ))}
      </span>
      {choices.length > 0 && (
        <Select<string>
          size="sm"
          aria-label={m.actions(accountName(member))}
          value={NONE}
          placeholder={m.actionsPlaceholder}
          disabled={busy}
          onChange={choose}
          options={choices}
          className="shrink-0"
        />
      )}
    </div>
  )
}

export function Profiles({ member }: { member: Member }) {
  const m = useMessages(groupsMessages)
  if (member.profiles.length === 0)
    return (
      <span className="min-w-0">
        <span className="block truncate font-mono text-[0.9rem]">{member.source}</span>
        <span className="block text-[0.8rem] text-ink-dim">{m.noProfile}</span>
      </span>
    )
  return (
    <span className="flex min-w-0 flex-col gap-[0.2rem]">
      {member.profiles.map((p) => {
        const { app } = profileParts(p)
        return (
          <span key={p} className="flex min-w-0 items-center gap-[0.45rem] text-[0.95rem] font-medium">
            <ToolIcon id={toolByBin(app)?.id ?? app} className="size-4 shrink-0 text-ink-soft" />
            <span className="truncate">{p}</span>
          </span>
        )
      })}
    </span>
  )
}
