import { Plus } from "lucide-react"
import { type FormEvent, useEffect, useRef, useState } from "react"
import { nameProblem, removable, stepTo } from "@/domain/base-stages"
import { useMessages } from "@/i18n"
import type { CrmBaseEdit, CrmBaseStage } from "@/platform/bindings"
import { Button } from "@/ui/Button"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { fieldClass } from "@/ui/field"
import { focusInPlace } from "@/ui/motion"
import { Segmented } from "@/ui/Segmented"
import { SplitButton } from "@/ui/SplitButton"
import { OutcomeLamp } from "./Card"
import { stageMessages } from "./messages-stages"

type Edit = (edit: CrmBaseEdit) => void

/** A base column's menu: a step left or right, rename, remove. A remove the set refuses says why through `onProblem`. */
export function StageMenu({
  stage,
  base,
  busy,
  onEdit,
  onRename,
  onProblem,
}: {
  stage: CrmBaseStage
  base: readonly CrmBaseStage[]
  busy: boolean
  onEdit: Edit
  onRename: () => void
  onProblem: (problem: string) => void
}) {
  const s = useMessages(stageMessages)
  const step = (by: -1 | 1) => {
    const position = stepTo(base, stage.ref, by)
    if (position !== null) onEdit({ op: "move", ref: stage.ref, position })
  }
  return (
    <SplitButton
      compact
      menuLabel={s.columnMenu(stage.name)}
      moreLabel={s.columnMenu(stage.name)}
      disabled={busy}
      items={[
        { label: s.moveLeft, disabled: stepTo(base, stage.ref, -1) === null, onSelect: () => step(-1) },
        { label: s.moveRight, disabled: stepTo(base, stage.ref, 1) === null, onSelect: () => step(1) },
        { label: s.rename, onSelect: onRename },
        {
          label: s.remove,
          danger: true,
          onSelect: () =>
            removable(base, stage.ref)
              ? onEdit({ op: "remove", ref: stage.ref })
              : onProblem(s.keepOne(s.outcomes[stage.outcome as Outcome] ?? stage.outcome)),
        },
      ]}
    />
  )
}

/** A base stage's name, edited in place of its column's header line. */
export function StageRename({
  stage,
  base,
  onEdit,
  onDone,
}: {
  stage: CrmBaseStage
  base: readonly CrmBaseStage[]
  onEdit: Edit
  onDone: () => void
}) {
  const s = useMessages(stageMessages)
  return (
    <NameForm
      base={base}
      initial={stage.name}
      except={stage.ref}
      label={s.renameTo(stage.name)}
      submit={s.save}
      onCancel={onDone}
      onSave={(name) => {
        onDone()
        if (name !== stage.name) onEdit({ op: "rename", ref: stage.ref, name })
      }}
    />
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
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className="flex min-h-[3rem] w-full items-center justify-center gap-[0.45rem] rounded-[0.2rem] border border-line-strong border-dashed px-[0.9rem] text-[0.95rem] font-medium text-ink-soft transition-colors duration-(--motion-fast) hover:bg-app-2 hover:text-ink disabled:opacity-45"
      >
        <Plus className="size-4" aria-hidden />
        {s.addStage}
      </button>
    )
  }
  return (
    <div className="flex flex-col items-start gap-[0.6rem] rounded-[0.2rem] border border-line-strong bg-app p-[0.75rem]">
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
    </div>
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
      <Button size="sm" onClick={props.onCancel}>
        {s.cancel}
      </Button>
      {tried && problem && <ErrorNotice inline>{s.nameProblem[problem]}</ErrorNotice>}
    </form>
  )
}
