import { CopyButton } from "./CopyButton"
import { cx } from "./cx"

/** `wrap`: a command that must be read whole before it runs wraps instead of being cut short. */
export function CopyField({ value, label, wrap = false }: { value: string; label: string; wrap?: boolean }) {
  // Several lines are commands to read before running them, so none is cut short.
  const lines = wrap || value.includes("\n")
  return (
    <div
      className={cx(
        "flex gap-2 rounded-[0.4rem] border border-line bg-app-2 py-1 pr-1 pl-3",
        lines ? "items-start" : "items-center",
      )}
    >
      <code
        className={cx(
          "selectable min-w-0 flex-1 font-mono text-[0.875rem] text-ink",
          lines ? "py-1 whitespace-pre-wrap wrap-anywhere" : "truncate",
        )}
      >
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  )
}
