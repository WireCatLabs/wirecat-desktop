import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { EmptyState } from "./EmptyState"
import { ErrorNotice } from "./ErrorNotice"

it("says why nothing shows, and what to do next", () => {
  render(
    <EmptyState title="No memory yet" action={<button type="button">Open Agents</button>}>
      An agent saves what it learns here.
    </EmptyState>,
  )
  expect(screen.getByText("No memory yet")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Open Agents" })).toBeInTheDocument()
})

it("announces a warning politely and an error at once", () => {
  render(
    <>
      <ErrorNotice tone="warn">Read from the work profile</ErrorNotice>
      <ErrorNotice>Could not read memory</ErrorNotice>
    </>,
  )
  expect(screen.getByRole("status")).toHaveTextContent("Read from the work profile")
  expect(screen.getByRole("alert")).toHaveTextContent("Could not read memory")
})
