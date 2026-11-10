import userEvent from "@testing-library/user-event"
import { useState } from "react"
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

function LiveForm({ send }: { send: () => void }) {
  const [code, setCode] = useState("")
  const problem = code === "" ? "Enter a code" : code.length > 4 ? "Four characters at most" : null
  const need = useFieldError("code", { live: { problem, early: code.length > 4 } })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (problem) return need.fail()
        send()
      }}
    >
      <input id="code" aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} {...need.field} />
      {need.hint}
      <button type="submit">Save</button>
    </form>
  )
}

describe("field error", () => {
  it("in live mode says a mistake while it is typed and, after a failed click, follows the value until it is fixed", async () => {
    const send = vi.fn()
    const user = userEvent.setup()
    render(<LiveForm send={send} />)
    const field = screen.getByRole("textbox", { name: "Code" })
    expect(field).not.toHaveAttribute("aria-invalid")
    await user.type(field, "abcde")
    expect(field).toHaveAccessibleDescription("Four characters at most")
    await user.type(field, "{Backspace}")
    expect(field).not.toHaveAttribute("aria-invalid")
    await user.clear(field)
    expect(field).not.toHaveAttribute("aria-invalid")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(field).toHaveAccessibleDescription("Enter a code")
    expect(field).toHaveFocus()
    await user.type(field, "abcdef")
    expect(field).toHaveAccessibleDescription("Four characters at most")
    await user.clear(field)
    expect(field).not.toHaveAttribute("aria-invalid")
    await user.type(field, "ab")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(send).toHaveBeenCalledTimes(1)
  })

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
