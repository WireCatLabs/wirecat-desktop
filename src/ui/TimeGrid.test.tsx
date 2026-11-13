import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@/testing/render"
import { type Placed, TimeGrid } from "./TimeGrid"

const DAYS = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]
const block = (key: string, startMin: number): Placed => ({
  type: "event",
  key,
  startMin,
  endMin: startMin + 60,
  left: 0,
  width: 1,
})
const PLACED = new Map<string, Placed[]>([
  ["2026-11-09", [block("mon-9", 540), block("mon-14", 840)]],
  ["2026-11-11", [block("wed-13", 780)]],
  ["2026-11-14", [block("sat-8", 480)]],
])

function grid(onOpen = vi.fn()) {
  render(
    <TimeGrid
      label="Week"
      days={DAYS}
      head={(d) => ({ short: d.slice(8), name: d })}
      allDayLabel="all day"
      layout={() => PLACED}
      renderItem={(key) => key}
      itemLabel={(key) => key}
      columnName={(day, n) => `${day}, ${n}`}
      onOpen={onOpen}
      renderMore={() => null}
    />,
  )
  return onOpen
}

describe("TimeGrid", () => {
  it("is one tab stop the arrows move through: down a day, across to the nearest in time, Home and End", async () => {
    const user = userEvent.setup()
    const onOpen = grid()
    await user.tab()
    expect(screen.getByRole("button", { name: "mon-9" })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("button", { name: "mon-14" })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("button", { name: "wed-13" })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("button", { name: "sat-8" })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("button", { name: "sat-8" })).toHaveFocus()
    await user.keyboard("{Home}")
    expect(screen.getByRole("button", { name: "mon-9" })).toHaveFocus()
    await user.keyboard("{End}{Enter}")
    expect(onOpen).toHaveBeenCalledWith("sat-8")
    expect(screen.getAllByRole("button").filter((b) => b.tabIndex === 0)).toHaveLength(1)
  })

  it("names each day's column with its date and how many it holds", () => {
    grid()
    expect(screen.getByRole("group", { name: "2026-11-09, 2" })).toBeInTheDocument()
  })
})
