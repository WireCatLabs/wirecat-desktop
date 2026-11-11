import { useMessages } from "@/i18n"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { memoryMessages } from "./messages"
import { isWorded } from "./store"

export function RowFailed({ failed, label, className = "" }: { failed: string; label?: string; className?: string }) {
  const m = useMessages(memoryMessages)
  return isWorded(failed) ? (
    <ErrorNotice inline className={className}>
      {failed}
    </ErrorNotice>
  ) : (
    <ErrorNotice inline raw={failed} className={className}>
      {label ?? m.writeFailed}
    </ErrorNotice>
  )
}
