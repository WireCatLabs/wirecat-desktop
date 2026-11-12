import { accountLabel, contactOf, fullerName, handleOf, personName } from "@/domain/people"
import { useMessages } from "@/i18n"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/**
 * A person by name, "You" for the owner; a name with no letters falls back to a handle, phone or address, and to
 * "No name yet" only when the person has none of these.
 */
export function usePersonName() {
  const m = useMessages(peopleMessages)
  const known = useKnownName()
  const identifier = useIdentifier()
  return (ref: string, listedName?: string | null) => known(ref, listedName) ?? identifier(ref) ?? m.noName
}

/**
 * A person's phone, address or handle for a name. Kept out of `useKnownName`: comparing two people by a phone shown as
 * their name would call them namesakes.
 */
export function useIdentifier() {
  const people = usePeople((s) => s.people)
  const details = usePeople((s) => s.details)
  return (ref: string): string | null => {
    const listed = people.find((p) => p.ref === ref)
    const row = listed?.phone ?? listed?.email ?? (listed?.username ? `@${listed.username}` : null)
    if (row) return row
    const detail = details[ref]
    if (detail?.state !== "ready") return null
    const { identities } = detail.person
    return identities.map(accountLabel).find(Boolean) ?? contactOf(identities)?.value ?? null
  }
}

/** A person's real name for comparing two sides: `null` for "No name yet" and for the owner's "You". */
export function useComparableName() {
  const m = useMessages(peopleMessages)
  const known = useKnownName()
  return (ref: string) => {
    const name = known(ref)
    return name === m.you ? null : name
  }
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
    const named = personName({
      displayName: listedName === undefined ? (listed?.displayName ?? person?.displayName) : null,
      name: listedName ?? listed?.name ?? person?.name,
      contact: listed?.contact,
    })
    if (!person) return named
    // A phone or address stands in only for a missing name, so an account's name goes before it.
    const real = named && named === listed?.contact?.trim() ? null : named
    return (
      fullerName(
        real,
        person.identities.map((i) => i.name),
      ) ??
      named ??
      handleOf(person.identities)
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
