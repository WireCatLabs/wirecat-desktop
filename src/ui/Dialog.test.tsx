import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Dialog } from "./Dialog"

function Opener() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog open={open} title="Details" onClose={() => setOpen(false)}>
        <input aria-label="Note" />
      </Dialog>
    </>
  )
}

const dialog = () => screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement

describe("Dialog", () => {
  it("closes from the × and gives focus back to what opened it", async () => {
    const user = userEvent.setup()
    render(<Opener />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => expect(dialog().open).toBe(false))
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus()
  })

  it("closes on a click outside, but not when a press inside ends outside", async () => {
    const user = userEvent.setup()
    render(<Opener />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    fireEvent.pointerDown(screen.getByRole("textbox", { name: "Note" }))
    fireEvent.click(dialog())
    expect(dialog().open).toBe(true)
    fireEvent.pointerDown(dialog())
    fireEvent.click(dialog())
    await waitFor(() => expect(dialog().open).toBe(false))
  })
})
