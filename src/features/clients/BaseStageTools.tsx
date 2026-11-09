import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { nameProblem, removable, stepTo } from "@/domain/base-stages"
import { useMessages } from "@/i18n"
import type { CrmBaseEdit, CrmBaseStage } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { fieldClass } from "@/ui/field"
import { focusInPlace } from "@/ui/motion"
import { Segmented } from "@/ui/Segmented"
import { OutcomeLamp } from "./ClientsBoard"
import { stageMessages } from "./messages-stages"

type Edit = (edit: CrmBaseEdit) => void

/** A base column's own line: rename in place, a step left or right, remove; or why a step cannot be taken. */
export function StageTools({
  stage,
  base,
  busy,
  onEdit,
}: {
  stage: CrmBaseStage
  base: readonly CrmBaseStage[]
  busy: boolean
  onEdit: Edit
}) {
  const s = useMessages(stageMessages)
  const [renaming, setRenaming] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const step = (by: -1 | 1) => {
    const position = stepTo(base, stage.ref, by)
    if (position !== null) onEdit({ op: "move", ref: stage.ref, position })
  }
  if (renaming) {
    return (
      <NameForm
        base={base}
        initial={stage.name}
        except={stage.ref}
        label={s.renameTo(stage.name)}
        submit={s.save}
        onCancel={() => setRenaming(false)}
        onSave={(name) => {
          setRenaming(false)
          if (name !== stage.name) onEdit({ op: "rename", ref: stage.ref, name })
        }}
      />
    )
  }
  const icon = "size-4"
  return (
    <span className="flex flex-col gap-[0.3rem]">
      <span className="flex items-center gap-[0.15rem]">
        <IconButton
          label={s.moveLeft(stage.name)}
          disabled={busy || stepTo(base, stage.ref, -1) === null}
          onClick={() => step(-1)}
        >
          <ChevronLeft className={icon} aria-hidden />
        </IconButton>
        <IconButton
          label={s.moveRight(stage.name)}
          disabled={busy || stepTo(base, stage.ref, 1) === null}
          onClick={() => step(1)}
        >
          <ChevronRight className={icon} aria-hidden />
        </IconButton>
        <IconButton label={s.rename(stage.name)} disabled={busy} onClick={() => setRenaming(true)}>
          <Pencil className={icon} aria-hidden />
        </IconButton>
        <IconButton
          label={s.remove(stage.name)}
          disabled={busy}
          onClick={() =>
            removable(base, stage.ref)
              ? onEdit({ op: "remove", ref: stage.ref })
              : setProblem(s.keepOne(s.outcomes[stage.outcome as Outcome] ?? stage.outcome))
          }
        >
          <Trash2 className={icon} aria-hidden />
        </IconButton>
      </span>
      {problem && <ErrorNotice inline>{problem}</ErrorNotice>}
    </span>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="!px-[0.4rem]"
    >
      {children}
    </Button>
  )
}

type Outcome = "open" | "won" | "lost"
const OUTCOMES: Outcome[] = ["open", "won", "lost"]

/** A new base stage: its name and whether it is open, won or lost. */
export function AddStage({ base, busy, onEdit }: { base: readonly CrmBaseStage[]; busy: boolean; onEdit: Edit }) {
  const s = useMessages(stageMessages)
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>("open")
  if (!open) {
    return (
      <Button size="sm" disabled={busy} icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>
        {s.addStage}
      </Button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-[0.6rem]">
      <Segmented<Outcome>
        label={s.outcome}
        value={outcome}
        onChange={setOutcome}
        labelClass=""
        options={OUTCOMES.map((o) => ({ value: o, label: s.outcomes[o], icon: <OutcomeLamp outcome={o} /> }))}
      />
      <NameForm
        base={base}
        initial=""
        label={s.name}
        submit={s.add}
        onCancel={() => setOpen(false)}
        onSave={(name) => {
          setOpen(false)
          onEdit({ op: "add", name, outcome })
        }}
      />
    </span>
  )
}

function NameForm(props: {
  base: readonly CrmBaseStage[]
  initial: string
  except?: string
  label: string
  submit: string
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const s = useMessages(stageMessages)
  const [name, setName] = useState(props.initial)
  const [tried, setTried] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => focusInPlace(field.current), [])
  const problem = nameProblem(props.base, name, props.except)
  const save = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!problem) props.onSave(name.trim())
  }
  return (
    <form onSubmit={save} className="flex min-w-0 flex-wrap items-center gap-[0.4rem]">
      <input
        aria-label={props.label}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            // Cancels the name only: a dialog holding the field stays open.
            e.preventDefault()
            e.stopPropagation()
            props.onCancel()
          }
        }}
        ref={field}
        className={`${fieldClass} max-w-[14rem]`}
      />
      <Button size="sm" type="submit">
        {props.submit}
      </Button>
      <Button size="sm" variant="ghost" onClick={props.onCancel}>
        {s.cancel}
      </Button>
      {tried && problem && <ErrorNotice inline>{s.nameProblem[problem]}</ErrorNotice>}
    </form>
  )
}
