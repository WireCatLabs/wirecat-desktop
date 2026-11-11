import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { FilterMenu } from "./FilterMenu"

const COMMANDS = Array.from({ length: 10 }, (_, i) => ({ value: `c${i}`, label: `command ${i}` }))

function Commands() {
  const [picked, setPicked] = useState(["c7"])
  return <FilterMenu label="Command" empty="All 10" options={COMMANDS} selected={picked} onChange={setPicked} />
}

describe("a long FilterMenu", () => {
  it("lists what was chosen first, and a tick does not move a row while it is open", async () => {
    const user = userEvent.setup()
    render(<Commands />)
    await user.click(screen.getByRole("button", { name: "Command: command 7" }))
    const names = () => screen.getAllByRole("option").map((o) => o.textContent)
    expect(names()[0]).toBe("command 7")
    await user.click(screen.getByRole("option", { name: "command 3" }))
    expect(names()[0]).toBe("command 7")
    expect(names()[4]).toBe("command 3")
    await user.type(screen.getByRole("combobox", { name: "Find command" }), "5")
    expect(names()).toEqual(["command 5"])
  })
})
