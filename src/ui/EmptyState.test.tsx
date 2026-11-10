import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { EmptyState } from "./EmptyState"

it("says why nothing shows, and what to do next", () => {
  render(
    <EmptyState title="No memory yet" action={<button type="button">Open Agents</button>}>
      An agent saves what it learns here.
    </EmptyState>,
  )
  expect(screen.getByText("No memory yet")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Open Agents" })).toBeInTheDocument()
})
