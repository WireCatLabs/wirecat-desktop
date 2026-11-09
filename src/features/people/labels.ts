import { cleanName, handleOf } from "@/domain/people"
import { useMessages } from "@/i18n"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/**
 * A person by name, "You" for the owner; a name with no letters falls back to a handle once the person's accounts are
 * read, and to "No name yet" until then.
 */
export function usePersonName() {
  const m = useMessages(peopleMessages)
  const people = usePeople((s) => s.people)
  const details = usePeople((s) => s.details)
  return (ref: string, listedName?: string | null) => {
    const listed = people.find((p) => p.ref === ref)
    if (listed?.owner) return m.you
    const detail = details[ref]
    const person = detail?.state === "ready" ? detail.person : null
    return (
      cleanName(listedName ?? listed?.name ?? person?.name) ?? (person ? handleOf(person.identities) : null) ?? m.noName
    )
  }
}
