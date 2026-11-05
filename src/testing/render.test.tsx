import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { AppPreferences } from "@/features/settings/AppPreferences"
import { useScale } from "@/features/settings/scale"
import { useLanguage } from "@/i18n"
import { render, screen } from "./render"

// The two tests share nothing but order: the second fails if the first one leaves state behind.
describe("render helper", () => {
  it("lets a page change a store, the saved settings and the language", async () => {
    const user = userEvent.setup()
    render(<AppPreferences />)
    expect(screen.getByRole("slider", { name: "Interface size" })).toHaveValue("100")
    useScale.getState().set(130)
    useLanguage.setState({ choice: "ru" })
    expect(localStorage.getItem("wirecat.scale")).toContain("130")
    await user.click(document.body)
  })

  it("renders the same page again with none of that state", () => {
    render(<AppPreferences />)
    expect(screen.getByRole("slider", { name: "Interface size" })).toHaveValue("100")
    expect(useScale.getState().percent).toBe(100)
    expect(useLanguage.getState().choice).toBe("en")
    expect(localStorage.getItem("wirecat.scale")).toBeNull()
  })
})
