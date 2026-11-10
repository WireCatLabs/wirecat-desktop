import { useMessages } from "@/i18n"
import { cx } from "@/ui/cx"
import { isBeta } from "./beta"
import { betaMessages } from "./messages-beta"

/** A quiet β beside a section that is new and lightly tested; renders nothing once its id leaves `BETA` (`shared/beta.ts`). */
export function BetaBadge({ section, className }: { section: string; className?: string }) {
  const m = useMessages(betaMessages)
  if (!isBeta(section)) return null
  return (
    <span
      role="img"
      aria-label={m.label}
      title={m.label}
      className={cx(
        "inline-flex shrink-0 select-none items-center font-sans tracking-normal rounded-[0.3rem] border border-line px-[0.3rem] font-medium text-[0.78rem] text-ink-dim leading-[1.2rem]",
        className,
      )}
    >
      β
    </span>
  )
}
