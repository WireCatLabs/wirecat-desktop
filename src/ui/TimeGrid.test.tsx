import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { layoutDay } from "@/domain/meeting-layout"
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
  open: 60,
})
const PLACED = new Map<string, Placed[]>([
  ["2026-11-09", [block("mon-9", 540), block("mon-14", 840)]],
  ["2026-11-11", [block("wed-13", 780)]],
  ["2026-11-14", [block("sat-8", 480)]],
])

function grid(onOpen = vi.fn(), itemTip?: (key: string) => string) {
  render(
    <TimeGrid
      label="Week"
      days={DAYS}
      head={(d) => ({ short: d.slice(8), name: d })}
      allDayLabel="all day"
      layout={() => PLACED}
      renderItem={(key) => key}
      itemLabel={(key) => key}
      {...(itemTip ? { itemTip } : {})}
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

  it("shows a block's tip when the keyboard moves onto it, and Escape hides it", async () => {
    const user = userEvent.setup()
    grid(vi.fn(), (key) => `tip of ${key}`)
    await user.tab()
    await user.keyboard("{ArrowDown}")
    expect(await screen.findByRole("tooltip")).toHaveTextContent("tip of mon-14")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })

  it("names each day's column with its date and how many it holds", () => {
    grid()
    expect(screen.getByRole("group", { name: "2026-11-09, 2" })).toBeInTheDocument()
  })

  it("reaches every one of three overlapping meetings by arrow and Enter, the later ones drawn over the earlier", async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const seg = (key: string, startMin: number, endMin: number) => ({
      key,
      startMin,
      endMin,
      fromBefore: false,
      goesOn: false,
    })
    const day = layoutDay(
      [seg("a", 540, 660), seg("b", 570, 630), seg("c", 600, 720)],
      { block: 0.25, indent: 0.25, more: 0.2 },
      22.5,
    )
    render(
      <TimeGrid
        label="Week"
        days={DAYS}
        head={(d) => ({ short: d.slice(8), name: d })}
        allDayLabel="all day"
        layout={() => new Map([["2026-11-09", day]])}
        renderItem={(key) => key}
        itemLabel={(key) => key}
        columnName={(d, n) => `${d}, ${n}`}
        onOpen={onOpen}
        renderMore={() => null}
      />,
    )
    const [a, b, c] = ["a", "b", "c"].map((k) => screen.getByRole("button", { name: k }))
    expect([a, b, c].map((el) => Math.round(Number.parseFloat(el?.style.left ?? "")))).toEqual([0, 25, 50])
    // Later in the DOM paints on top: the meeting that starts later covers the earlier one.
    expect(a?.compareDocumentPosition(c as Element)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    await user.tab()
    expect(a).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(b).toHaveFocus()
    await user.keyboard("{ArrowDown}{Enter}")
    expect(onOpen).toHaveBeenCalledWith("c")
  })
})
