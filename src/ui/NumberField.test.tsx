import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { clampStep, NumberField, parseTyped } from "./NumberField"

function Held({ start = 1 }: { start?: number }) {
  const [value, setValue] = useState(start)
  return (
    <>
      <NumberField aria-label="Cap" value={value} onChange={setValue} min={0} max={5} step={0.1} prefix="$" />
      <output>{value}</output>
    </>
  )
}

describe("NumberField", () => {
  it("steps with its buttons and the arrow keys", () => {
    render(<Held />)
    fireEvent.click(screen.getByRole("button", { name: "More" }))
    expect(screen.getByRole("status").textContent).toBe("1.1")
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Cap" }), { key: "ArrowDown" })
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Cap" }), { key: "ArrowDown" })
    expect(screen.getByRole("status").textContent).toBe("0.9")
  })

  it("reads a typed value on Enter and holds it inside min and max", () => {
    render(<Held />)
    const field = screen.getByRole("spinbutton", { name: "Cap" })
    fireEvent.change(field, { target: { value: "2,5" } })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(screen.getByRole("status").textContent).toBe("2.5")
    fireEvent.change(field, { target: { value: "80" } })
    fireEvent.blur(field)
    expect(screen.getByRole("status").textContent).toBe("5")
    expect((field as HTMLInputElement).value).toBe("5")
  })

  it("puts back the last value when the typed text is not a number", () => {
    render(<Held start={2} />)
    const field = screen.getByRole("spinbutton", { name: "Cap" })
    fireEvent.change(field, { target: { value: "abc" } })
    fireEvent.blur(field)
    expect((field as HTMLInputElement).value).toBe("2")
  })

  it("cannot go below its minimum", () => {
    render(<Held start={0} />)
    expect((screen.getByRole("button", { name: "Less" }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("rounds to the step's decimals", () => {
    expect(clampStep(0.1 + 0.2, 0, 5, 0.1)).toBe(0.3)
    expect(parseTyped(" ")).toBeNull()
  })
})
