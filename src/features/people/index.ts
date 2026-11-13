import { useNav } from "@/shared/nav"
import { usePeople } from "./store"

export { PeoplePage } from "./PeoplePage"

/** Contacts with this person's card open, from another page; the page reads its list as on any visit. */
export function openPerson(ref: string) {
  usePeople.getState().reveal(ref)
  useNav.getState().go("people")
}
