import { cx } from "./cx"

type Props = {
  label: string
  /** 0 to 100; null while the work does not say how far it is, and a third of the track slides across instead. */
  value: number | null
  valueText?: string | undefined
  className?: string
}

export function ProgressBar({ label, value, valueText, className }: Props) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-valuetext={valueText}
      className={cx("h-1.5 overflow-hidden rounded-full bg-app-3", className)}
    >
      {value === null ? (
        <div className="bar-indeterminate h-full rounded-full bg-brand" />
      ) : (
        <div
          className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-150 motion-safe:ease-out-quart"
          style={{ width: `${value}%` }}
        />
      )}
    </div>
  )
}
