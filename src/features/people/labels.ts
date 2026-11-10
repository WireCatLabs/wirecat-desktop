import { handleOf, personName } from "@/domain/people"
import { useMessages } from "@/i18n"
import type { Merge, PersonDetail } from "@/platform/people-schemas"
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
  const seen = usePeople((s) => s.seen)
  return (ref: string, listedName?: string | null) => {
    const listed = people.find((p) => p.ref === ref)
    if (listed?.owner || seen[ref]?.owner) return m.you
    const detail = details[ref]
    const person = detail?.state === "ready" ? detail.person : null
    return (
      personName({
        displayName: listedName === undefined ? listed?.displayName : null,
        name: listedName ?? listed?.name ?? person?.name,
        contact: listed?.contact,
      }) ??
      (person ? handleOf(person.identities) : null) ??
      m.noName
    )
  }
}

/** Who a join came from. That person is no longer listed or read, so the name falls back to the accounts it brought. */
export function useJoinedFrom() {
  const m = useMessages(peopleMessages)
  const name = usePersonName()
  return (person: PersonDetail, merge: Merge): string | null => {
    const known = name(merge.from)
    if (known !== m.noName) return known
    return (
      person.identities
        .filter((i) => merge.identities.includes(i.identity))
        .map((i) => i.name?.trim())
        .find(Boolean) ?? null
    )
  }
}
