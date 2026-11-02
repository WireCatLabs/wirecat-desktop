import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Checkbox } from "./Checkbox"

function Labelled() {
  const [on, setOn] = useState(false)
  return (
    <label>
      <Checkbox checked={on} onChange={setOn} />
      Back up first
    </label>
  )
}

describe("Checkbox", () => {
  it("is a real checkbox: its label and the Space key both toggle it", async () => {
    const user = userEvent.setup()
    render(<Labelled />)
    const box = screen.getByRole("checkbox", { name: "Back up first" })
    await user.click(screen.getByText("Back up first"))
    expect(box).toBeChecked()
    box.focus()
    await user.keyboard(" ")
    expect(box).not.toBeChecked()
  })

  it("takes no change while disabled", async () => {
    const user = userEvent.setup()
    let changed = false
    render(<Checkbox checked={false} disabled aria-label="Protect" onChange={() => (changed = true)} />)
    await user.click(screen.getByRole("checkbox", { name: "Protect" }))
    expect(changed).toBe(false)
  })
})
