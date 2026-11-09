import { reasonOf, tooOldFor } from "@/domain/memory-add"
import { useMessages } from "@/i18n"
import { ReportThis } from "@/shared/ReportThis"
import { Collapse } from "@/ui/Collapse"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { useAddSource } from "./add-store"
import { addMessages } from "./messages-add"

/** The step's last refusal: memo's reasons in the owner's words, anything else in memo's own. */
export function Refusal() {
  const m = useMessages(addMessages)
  const error = useAddSource((s) => s.error)
  const reason = error ? reasonOf(error) : null
  const words = !error ? null : reason ? m.reasons[reason] : tooOldFor(error) ? m.tooOld : `${m.failed} ${error}`
  return (
    <Collapse open={error !== null}>
      {words && (
        <ErrorNotice inline action={reason ? undefined : <ReportThis what="Adding to memory" error={error ?? ""} />}>
          {words}
        </ErrorNotice>
      )}
    </Collapse>
  )
}
