import { create } from "zustand"
import { platform } from "@/platform/bridge"
import type { Similar } from "@/platform/people-schemas"
import { errorText } from "@/shared/errors"
import { usePeople } from "./store"

/** Shorter names match half the list: the check waits for a second letter. */
const MIN_CHECK = 2

type AddState = {
  /** The name `similar` answers for; a list for an older text is never shown. */
  checked: string
  similar: Similar[]
  checkError: string | null
  adding: boolean
  addError: string | null
  added: { ref: string; name: string } | null
  /** People whose names start like `name`, from memo's `people check`; answers the list, empty on a failure. */
  check(name: string): Promise<Similar[]>
  /** Adds a person by name; true when memo added them. */
  add(name: string): Promise<boolean>
}

let asked = 0

export const useAddPerson = create<AddState>((set) => ({
  checked: "",
  similar: [],
  checkError: null,
  adding: false,
  addError: null,
  added: null,
  async check(name) {
    const typed = name.trim()
    const mine = ++asked
    if (typed.length < MIN_CHECK) {
      set({ checked: typed, similar: [], checkError: null })
      return []
    }
    try {
      const similar = await platform.peopleCheck(typed)
      if (mine === asked) set({ checked: typed, similar, checkError: null })
      return similar
    } catch (e) {
      if (mine === asked) set({ checked: typed, similar: [], checkError: errorText(e) })
      return []
    }
  },
  async add(name) {
    const typed = name.trim()
    set({ adding: true, addError: null, added: null })
    try {
      const ref = await platform.peopleAdd(typed)
      asked++
      set({ adding: false, added: { ref, name: typed }, checked: "", similar: [], checkError: null })
      void usePeople.getState().load()
      return true
    } catch (e) {
      set({ adding: false, addError: errorText(e) })
      return false
    }
  },
}))
