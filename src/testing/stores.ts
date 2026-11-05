import { act } from "@testing-library/react"
import { useLanguage } from "@/i18n"
import { created } from "./registry"

/** Every store back to its first state, the language to English, saved settings gone. */
export function resetStores() {
  act(() => {
    for (const store of created) store.setState(store.getInitialState() as never, true)
    useLanguage.setState({ choice: "en" })
  })
  localStorage.clear()
}
