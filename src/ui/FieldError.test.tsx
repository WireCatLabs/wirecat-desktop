import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@/testing/render"
import { FieldError, invalidBorder, useFieldError } from "./FieldError"

function Form({ send }: { send: () => void }) {
  const empty = useFieldError("name")
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const value = new FormData(e.currentTarget).get("name")
        if (!value) return empty.fail("Enter a name")
        send()
      }}
    >
      <input
        id="name"
        name="name"
        aria-label="Name"
        {...empty.field}
        className={invalidBorder}
        onChange={empty.clear}
      />
      {empty.hint}
      <button type="submit">Save</button>
    </form>
  )
}

describe("field error", () => {
  it("keeps the button enabled, shows the error at the field, focuses it and clears it on edit", async () => {
    const send = vi.fn()
    const user = userEvent.setup()
    render(<Form send={send} />)
    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeEnabled()
    await user.click(save)
    expect(send).not.toHaveBeenCalled()
    const field = screen.getByRole("textbox", { name: "Name" })
    expect(screen.getByText("Enter a name")).toBeInTheDocument()
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(field).toHaveAccessibleDescription("Enter a name")
    expect(field).toHaveFocus()
    await user.type(field, "x")
    expect(field).not.toHaveAttribute("aria-invalid")
    await user.click(save)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("renders nothing for an empty message", () => {
    render(<FieldError id="e">{null}</FieldError>)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
