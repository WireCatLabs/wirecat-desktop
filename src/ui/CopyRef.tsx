import { useMessages } from "@/i18n"
import { CopyButton } from "./CopyButton"
import { cx } from "./cx"
import { uiMessages } from "./messages"

/**
 * A small copy button beside a record's label: it copies the record's reference as memo and the CLIs take it
 * (`telegram:1/2`, `task:HRB-14`, `fact:21`), even when the reference is not printed, so the owner can hand it to an
 * agent. Nothing is drawn without a reference.
 */
export function CopyRef({ value, className }: { value: string | null | undefined; className?: string }) {
  const m = useMessages(uiMessages)
  if (!value) return null
  return <CopyButton value={value} label={m.copyRef(value)} className={cx("size-6 [&_svg]:size-3.5", className)} />
}
