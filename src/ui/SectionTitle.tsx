import type { HTMLAttributes } from "react"
import { cx } from "./cx"

/** The heading of a block on a page, one size on every page; `h3` when it sits under another section's heading. */
export function SectionTitle({
  as: Tag = "h2",
  className,
  ...rest
}: HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" }) {
  return <Tag {...rest} className={cx("text-[1.08rem] font-semibold leading-tight text-ink", className)} />
}
