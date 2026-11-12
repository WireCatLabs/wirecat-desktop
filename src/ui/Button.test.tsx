import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { Button } from "./Button"

it("busy, says so, ignores presses, keeps focus and shows a spinner hidden from screen readers", () => {
  const onClick = vi.fn()
  render(
    <Button busy onClick={onClick} icon={<svg data-testid="own" />}>
      Save
    </Button>,
  )
  const button = screen.getByRole("button", { name: "Save" })
  expect(button).toHaveAttribute("aria-busy", "true")
  expect(button).toHaveAttribute("aria-disabled", "true")
  expect(button).not.toBeDisabled()
  button.focus()
  fireEvent.click(button)
  expect(onClick).not.toHaveBeenCalled()
  expect(button).toHaveFocus()
  expect(screen.queryByTestId("own")).toBeNull()
  const spinner = button.querySelector("svg")
  expect(spinner).toHaveAttribute("aria-hidden", "true")
  expect(spinner?.getAttribute("class")).toContain("motion-safe:animate-spin")
})

it("not busy, presses and shows its own icon", () => {
  const onClick = vi.fn()
  render(
    <Button onClick={onClick} icon={<svg data-testid="own" />}>
      Save
    </Button>,
  )
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
  expect(onClick).toHaveBeenCalled()
  expect(screen.getByTestId("own")).toBeInTheDocument()
  expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy")
})
