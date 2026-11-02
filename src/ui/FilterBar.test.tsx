import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { expect, it } from "vitest"
import { FilterBar } from "./FilterBar"

function Bar() {
  const [query, setQuery] = useState("state:open")
  return (
    <FilterBar query={query} onQuery={setQuery} label="Search tasks" placeholder="Search">
      <button type="button">Project</button>
    </FilterBar>
  )
}

it("Clear all empties the field and leaves the keyboard in it", async () => {
  const user = userEvent.setup()
  render(<Bar />)
  await user.click(screen.getByRole("button", { name: "Clear all" }))
  const field = screen.getByRole("searchbox", { name: "Search tasks" })
  expect(field).toHaveValue("")
  expect(field).toHaveFocus()
  expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull()
})
