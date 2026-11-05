import { Eye, EyeOff } from "lucide-react"
import { type Ref, useState } from "react"
import { cx } from "./cx"

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  /** Names the field for the eye button: "Show the bot token". */
  showLabel: string
  hideLabel: string
  invalid?: boolean
  disabled?: boolean
  describedBy?: string
  inputRef?: Ref<HTMLInputElement>
}

/** A masked one-line field with a button that shows what was typed; nothing is autofilled, checked or kept. */
export function SecretField(props: Props) {
  const { id, value, onChange, showLabel, hideLabel, invalid = false, disabled = false, describedBy, inputRef } = props
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type={shown ? "text" : "password"}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cx(
          "selectable h-10 w-full rounded-[0.35rem] border border-line-strong bg-app px-3 pr-10 font-mono text-[1rem] text-ink",
          "disabled:opacity-60 aria-[invalid=true]:border-bad",
        )}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={showLabel}
        title={shown ? hideLabel : showLabel}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-[0.35rem] text-ink-dim hover:text-ink"
      >
        {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  )
}
