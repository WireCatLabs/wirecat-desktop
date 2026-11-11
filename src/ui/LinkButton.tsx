import type { ButtonHTMLAttributes } from "react"
import { cx } from "./cx"

/** A link inside a sentence that acts in the app; a whole action gets a `Button`, a web page gets `ExtLink`. */
export function LinkButton({ className, type, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        "text-left font-medium text-brand hover:text-brand-hover hover:underline hover:underline-offset-4",
        className,
      )}
      {...rest}
    />
  )
}
