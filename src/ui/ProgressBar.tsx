import { cx } from "./cx"

type Props = {
  label: string
  /** 0 to `max`; null while the work does not say how far it is, and a third of the track slides across instead. */
  value: number | null
  /** What the value counts up to, when it is not a percentage (tools read, minutes waited). */
  max?: number
  valueText?: string | undefined
  /** The fill never shows less than this share, so a bar that has just begun still shows it has. */
  minShare?: number
  /** How a null value looks: a light sliding across, or a pulse for work that has no steps at all. */
  unknown?: "slide" | "pulse"
  /** How fast the fill follows the value; `steady` is for a value that only ticks once a minute. */
  pace?: "progress" | "slow" | "fast" | "steady"
  className?: string
  /** `thin` for a line inside a row, under a label that already says what runs. */
  size?: "line" | "thin" | "md"
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
const heights = { line: "h-[0.3rem]", thin: "h-1", md: "h-1.5" }
const paces = {
  progress: "motion-safe:duration-(--motion-progress) motion-safe:ease-out-quart",
  slow: "motion-safe:duration-(--motion-slow) motion-safe:ease-out-quart",
  fast: "motion-safe:duration-(--motion-fast) motion-safe:ease-out-quart",
  steady: "motion-safe:duration-1000 motion-safe:ease-linear",
}

export function ProgressBar(props: Props) {
  const { label, value, valueText, className, size = "md", tone = "brand", busy = false, decorative = false } = props
  const { max = 100, minShare = 0, unknown = "slide", pace = "progress" } = props
  const share = value === null || max <= 0 ? 0 : Math.max(minShare, Math.min(100, (value / max) * 100))
  const a11y = decorative
    ? { "aria-hidden": true }
    : {
        role: "progressbar",
        "aria-label": label,
        "aria-valuemin": 0,
        "aria-valuemax": max,
        "aria-valuenow": value === null ? undefined : Math.round(value),
        "aria-valuetext": valueText,
      }
  return (
    <div {...a11y} className={cx("overflow-hidden rounded-full bg-app-3", heights[size], className)}>
      {value === null ? (
        unknown === "pulse" ? (
          <div className="h-full w-full rounded-full bg-brand/60 motion-safe:animate-pulse" />
        ) : (
          <div className={cx("bar-indeterminate h-full rounded-full", fills[tone])} />
        )
      ) : (
        <div
          className={cx(
            "h-full rounded-full motion-safe:transition-[width,background-color]",
            paces[pace],
            fills[tone],
            busy && value > 0 && value < max && "bar-busy",
          )}
          style={{ width: `${share}%` }}
        />
      )}
    </div>
  )
}
