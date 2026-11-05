import { cx } from "./cx"

type Props = {
  label: string
  /** 0 to 100; null while the work does not say how far it is, and a third of the track slides across instead. */
  value: number | null
  valueText?: string | undefined
  className?: string
  /** `thin` for a line inside a row, under a label that already says what runs. */
  size?: "thin" | "md"
  /** `ok` once the work is done, `bad` once it failed: the bar says how it ended, not only how far it got. */
  tone?: "brand" | "ok" | "bad"
  /**
   * The work goes on between two counts the tool reports. A light passes along the fill, so the bar does not look
   * stalled while it waits for the next real number; the value itself moves only with one.
   */
  busy?: boolean
  /** A bar that only decorates a line which already says the same (the "Still installing" note): no role of its own. */
  decorative?: boolean
}

const fills = { brand: "bg-brand", ok: "bg-ok", bad: "bg-bad" }

export function ProgressBar(props: Props) {
  const { label, value, valueText, className, size = "md", tone = "brand", busy = false, decorative = false } = props
  const a11y = decorative
    ? { "aria-hidden": true }
    : {
        role: "progressbar",
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": value === null ? undefined : Math.round(value),
        "aria-valuetext": valueText,
      }
  return (
    <div
      {...a11y}
      className={cx("overflow-hidden rounded-full bg-app-3", size === "thin" ? "h-1" : "h-1.5", className)}
    >
      {value === null ? (
        <div className={cx("bar-indeterminate h-full rounded-full", fills[tone])} />
      ) : (
        <div
          className={cx(
            "h-full rounded-full motion-safe:transition-[width,background-color] motion-safe:duration-(--motion-progress) motion-safe:ease-out-quart",
            fills[tone],
            busy && value > 0 && value < 100 && "bar-busy",
          )}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      )}
    </div>
  )
}
