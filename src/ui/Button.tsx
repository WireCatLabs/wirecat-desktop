import { LoaderCircle } from "lucide-react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cx } from "./cx"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type ButtonSize = "lg" | "md" | "sm"

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink border-transparent hover:bg-brand-hover active:bg-brand-hover",
  secondary: "bg-app text-ink border-line-strong hover:bg-app-2 hover:border-ink-dim/60 active:bg-app-3",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-app-3 hover:text-ink active:bg-app-3",
  danger: "bg-app text-bad border-line-strong hover:bg-bad/5 hover:border-bad/60 active:bg-bad/10",
}

const sizes: Record<ButtonSize, string> = {
  lg: "h-[2.9rem] px-[1.6rem] text-[1.02rem] rounded-[0.45rem]",
  md: "h-[2.4rem] px-[1.1rem] text-[0.95rem] rounded-[0.4rem]",
  sm: "h-8 px-3 text-[0.875rem] rounded-[0.35rem]",
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  /** Its own action runs: a spinner in place of the icon, and presses are ignored. */
  busy?: boolean
}

/** The spinner of a busy button, for a control that draws its own button (SplitButton's main action). */
export const busyIcon = <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />

export function Button(props: Props) {
  const { variant = "secondary", size = "md", icon, busy = false, className, children, type, onClick, ...rest } = props
  return (
    <button
      type={type ?? "button"}
      data-variant={variant}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 border font-medium whitespace-nowrap",
        // A press changes colour only: a button that moves under the pointer is a jump (rule 9).
        "transition-[background-color,border-color,color] duration-(--motion-fast) ease-out-quart",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
      // Not disabled: a disabled button drops keyboard focus to the page (UX-67).
      aria-disabled={busy || rest["aria-disabled"]}
      aria-busy={busy || rest["aria-busy"]}
      onClick={(e) => {
        if (!busy) return onClick?.(e)
        e.preventDefault()
      }}
    >
      {busy ? busyIcon : icon}
      {children}
    </button>
  )
}
