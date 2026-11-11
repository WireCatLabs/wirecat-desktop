import { reasonOf } from "@/domain/people"
import { useMessages } from "@/i18n"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { peopleMessages } from "./messages"

/** memo's known refusals in the owner's words; anything else folded under "Could not do it". */
export function Refusal({ error }: { error: string }) {
  const m = useMessages(peopleMessages)
  const reason = reasonOf(error)
  return (
    <ErrorNotice inline raw={reason ? null : error}>
      {reason ? m.reasons[reason] : m.writeFailed}
    </ErrorNotice>
  )
}
