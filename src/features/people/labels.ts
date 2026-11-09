import { nameOf } from "@/domain/people"
import { useMessages } from "@/i18n"
import { peopleMessages } from "./messages"
import { usePeople } from "./store"

/** A person by name, "You" for the owner, or memo's ref when memo knows no name. */
export function usePersonName() {
  const m = useMessages(peopleMessages)
  const people = usePeople((s) => s.people)
  return (ref: string) => {
    if (people.find((p) => p.ref === ref)?.owner) return m.you
    return nameOf(people, ref) ?? ref
  }
}
