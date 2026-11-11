import { handleOf, personName } from "@/domain/people"
import { useMessages } from "@/i18n"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/**
 * A person by name, "You" for the owner; a name with no letters falls back to a handle once the person's accounts are
 * read, and to "No name yet" until then.
 */
export function usePersonName() {
  const m = useMessages(peopleMessages)
  const known = useKnownName()
  return (ref: string, listedName?: string | null) => known(ref, listedName) ?? m.noName
}

/** As `usePersonName`, but `null` where it would say "No name yet", so a caller can word that case itself. */
export function useKnownName() {
  const m = useMessages(peopleMessages)
  const people = usePeople((s) => s.people)
  const details = usePeople((s) => s.details)
  const seen = usePeople((s) => s.seen)
  return (ref: string, listedName?: string | null): string | null => {
    const listed = people.find((p) => p.ref === ref)
    if (listed?.owner || seen[ref]?.owner) return m.you
    const detail = details[ref]
    const person = detail?.state === "ready" ? detail.person : null
    return (
      personName({
        displayName: listedName === undefined ? listed?.displayName : null,
        name: listedName ?? listed?.name ?? person?.name,
        contact: listed?.contact,
      }) ?? (person ? handleOf(person.identities) : null)
    )
  }
}

/**
 * The person a join came from, by name while memo still lists them. Read by ref, memo answers with the person they
 * went into, so a detail cannot say.
 */
export function useJoinedFromName() {
  const known = useKnownName()
  const people = usePeople((s) => s.people)
  return (ref: string) => (people.some((p) => p.ref === ref) ? known(ref) : null)
}
