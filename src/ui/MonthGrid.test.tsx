import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@/testing/render"
import { MonthGrid } from "./MonthGrid"

const DAYS = Array.from({ length: 42 }, (_, i) => {
  const d = new Date(2026, 9, 26 + i)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
})

function Harness({ onPage = vi.fn(), onOpen = vi.fn() }) {
  const [active, setActive] = useState("2026-11-13")
  return (
    <MonthGrid
      label="Month"
      days={DAYS}
      month="2026-11"
      today="2026-11-13"
      weekdays={["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]}
      active={active}
      onMove={setActive}
      onPage={onPage}
      onDay={vi.fn()}
      dayNumber={(d) => d.slice(8)}
      dayLabel={(d) => `day ${d}`}
      cellName={(d) => d}
      renderCell={(d) =>
        d === "2026-11-13" ? (
          <button type="button" tabIndex={-1} onClick={() => onOpen("board")}>
            Board
          </button>
        ) : null
      }
    />
  )
}

describe("MonthGrid", () => {
  it("moves by day and week, to the week's ends and the month's ends, and pages by month", async () => {
    const user = userEvent.setup()
    const onPage = vi.fn()
    render(<Harness onPage={onPage} />)
    await user.tab()
    expect(screen.getByRole("gridcell", { name: "2026-11-13" })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("gridcell", { name: "2026-11-14" })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("gridcell", { name: "2026-11-21" })).toHaveFocus()
    await user.keyboard("{Home}")
    expect(screen.getByRole("gridcell", { name: "2026-11-16" })).toHaveFocus()
    await user.keyboard("{End}")
    expect(screen.getByRole("gridcell", { name: "2026-11-22" })).toHaveFocus()
    await user.keyboard("{Control>}{Home}{/Control}")
    expect(screen.getByRole("gridcell", { name: "2026-11-01" })).toHaveFocus()
    await user.keyboard("{Control>}{End}{/Control}")
    expect(screen.getByRole("gridcell", { name: "2026-11-30" })).toHaveFocus()
    await user.keyboard("{PageDown}")
    expect(onPage).toHaveBeenCalledWith(1)
  })

  it("goes into a cell with Enter, round its buttons with Tab, and back out with Escape", async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    render(<Harness onOpen={onOpen} />)
    await user.tab()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("button", { name: "day 2026-11-13" })).toHaveFocus()
    await user.keyboard("{Tab}")
    expect(screen.getByRole("button", { name: "Board" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onOpen).toHaveBeenCalledWith("board")
    await user.keyboard("{Escape}")
    expect(screen.getByRole("gridcell", { name: "2026-11-13" })).toHaveFocus()
  })
})
