import { useId } from "react"
import { useMessages } from "@/i18n"
import { Button } from "@/ui/Button"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { Select } from "@/ui/Select"
import { scheduleEditorMessages } from "./messages-schedule-editor"

/**
 * The panel that opens under a schedule's line (an account's sync, mail sorted by the AI model): how often, then Turn
 * on or Save, Turn off and Cancel. The caller keeps the state and runs the tool's own `schedule command`.
 */
export function ScheduleEditor(props: {
  open: boolean
  /** A schedule runs already: Save and Turn off rather than Turn on. */
  on: boolean
  choices: readonly string[]
  every: string
  onEvery: (every: string) => void
  saving: boolean
  error: string | null
  onSave: () => void
  onOff: () => void
  onCancel: () => void
  hint: string
}) {
  const { open, on, choices, every, onEvery, saving, error, onSave, onOff, onCancel, hint } = props
  const m = useMessages(scheduleEditorMessages)
  const selectId = useId()
  return (
    <Collapse open={open}>
      <div className="flex flex-col gap-2 rounded-pill border border-line bg-app-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={selectId} className="text-[0.9rem] font-medium">
            {m.every}
          </label>
          <Select
            id={selectId}
            size="sm"
            value={every}
            onChange={onEvery}
            options={choices.map((c) => ({ value: c, label: m.duration(c) }))}
          />
          <Button size="sm" variant="primary" disabled={saving} onClick={onSave}>
            {saving ? m.saving : on ? m.save : m.turnOn}
          </Button>
          {on && (
            <Button size="sm" variant="secondary" disabled={saving} onClick={onOff}>
              {m.turnOff}
            </Button>
          )}
          <Button size="sm" variant="secondary" disabled={saving} onClick={onCancel}>
            {m.cancel}
          </Button>
        </div>
        <p className="text-[0.85rem] text-ink-dim">{hint}</p>
        <Collapse open={error !== null}>
          <ErrorNotice inline raw={error}>
            {error && m.failed}
          </ErrorNotice>
        </Collapse>
      </div>
    </Collapse>
  )
}
