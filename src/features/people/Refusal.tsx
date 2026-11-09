import { reasonOf } from "@/domain/people"
import { useMessages } from "@/i18n"
import { ErrorNotice } from "@/ui/ErrorNotice"
import { peopleMessages } from "./messages"

/** memo's known refusals in the owner's words; anything else after "Could not do it:". */
export function Refusal({ error }: { error: string }) {
  const m = useMessages(peopleMessages)
  const reason = reasonOf(error)
  return <ErrorNotice inline>{reason ? m.reasons[reason] : `${m.writeFailed} ${error}`}</ErrorNotice>
}
