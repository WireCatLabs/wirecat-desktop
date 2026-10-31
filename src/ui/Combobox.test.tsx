import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Combobox } from "./Combobox"

function Field() {
  const [value, setValue] = useState("")
  return (
    <>
      <label htmlFor="about">About</label>
      <Combobox id="about" value={value} onChange={setValue} options={["You", "Kai Sample", "Ana Ruiz"]} />
    </>
  )
}

describe("Combobox", () => {
  it("filters as one types, picks with the arrows and Enter, and clears with Escape", async () => {
    const user = userEvent.setup()
    render(<Field />)
    const box = screen.getByRole("combobox", { name: "About" })

    await user.type(box, "a")
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Kai Sample", "Ana Ruiz"])
    await user.keyboard("{ArrowDown}{ArrowDown}")
    expect(box).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Ana Ruiz" }).id)
    await user.keyboard("{Enter}")
    expect(box).toHaveValue("Ana Ruiz")
    expect(box).toHaveAttribute("aria-expanded", "false")

    await user.keyboard("{Escape}")
    expect(box).toHaveValue("")
  })

  it("keeps a typed partial name as the value, so it filters by what is typed", async () => {
    const user = userEvent.setup()
    render(<Field />)
    const box = screen.getByRole("combobox", { name: "About" })
    await user.type(box, "kai")
    await user.tab()
    expect(box).toHaveValue("kai")
    expect(box).toHaveAttribute("aria-expanded", "false")
  })
})
