import { act } from "@testing-library/react"
import { useLanguage } from "@/i18n"
import { resetQueryClient } from "@/shared/query"
import { created } from "./registry"

/** Every store back to its first state, a new query client, the language to English, saved settings gone. */
export function resetStores() {
  act(() => {
    for (const store of created) store.setState(store.getInitialState() as never, true)
    useLanguage.setState({ choice: "en" })
    resetQueryClient()
  })
  localStorage.clear()
}
