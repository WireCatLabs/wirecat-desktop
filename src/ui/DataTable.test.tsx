import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { type Column, DataTable } from "./DataTable"

type Fruit = { name: string; count: number }

const COLUMNS: Column<Fruit>[] = [
  { id: "name", head: "Name", width: "minmax(0,1fr)", lead: true, sortBy: (f) => f.name, cell: (f) => f.name },
  { id: "count", head: "Count", width: "4rem", sortBy: (f) => f.count, cell: (f) => String(f.count) },
  { id: "note", head: "Note", hideHead: true, width: "4rem", cell: () => "" },
]

const FRUIT = [
  { name: "pear", count: 2 },
  { name: "apple", count: 3 },
  { name: "fig", count: 1 },
]

const names = () => screen.getAllByRole("row").flatMap((r) => within(r).queryAllByRole("cell").slice(0, 1))

function Table(extra: { rows?: Fruit[]; below?: (f: Fruit) => React.ReactNode; onRowClick?: (f: Fruit) => void }) {
  return (
    <DataTable
      label="Fruit"
      rows={FRUIT}
      rowKey={(f) => f.name}
      columns={COLUMNS}
      leadWidth="10rem"
      minWidth="20rem"
      {...extra}
    />
  )
}

describe("DataTable", () => {
  it("names its columns, the sortable ones by a button that says which is pressed", async () => {
    const user = userEvent.setup()
    render(<Table />)
    expect(screen.getByRole("table", { name: "Fruit" })).toBeInTheDocument()
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Name", "Count", "Note"])
    const count = screen.getByRole("button", { name: "Sort by count" })
    expect(count).toHaveAttribute("aria-pressed", "false")
    await user.click(count)
    expect(count).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Sort by name" })).toHaveAttribute("aria-pressed", "false")
  })

  it("sorts on a click, the other way on a second, and keeps rows in the given order until then", async () => {
    const user = userEvent.setup()
    render(<Table />)
    expect(names().map((c) => c.textContent)).toEqual(["pear", "apple", "fig"])
    await user.click(screen.getByRole("button", { name: "Sort by count" }))
    expect(names().map((c) => c.textContent)).toEqual(["fig", "pear", "apple"])
    await user.click(screen.getByRole("button", { name: "Sort by count" }))
    expect(names().map((c) => c.textContent)).toEqual(["apple", "pear", "fig"])
  })

  it("keeps a sorted row where it is when its value changes, and puts a new row last", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Table />)
    await user.click(screen.getByRole("button", { name: "Sort by count" }))
    rerender(
      <Table rows={[{ name: "pear", count: 9 }, FRUIT[1] as Fruit, FRUIT[2] as Fruit, { name: "kiwi", count: 0 }]} />,
    )
    expect(names().map((c) => c.textContent)).toEqual(["fig", "pear", "apple", "kiwi"])
  })

  it("shows what belongs to a row under it, and marks each row by its key", () => {
    render(<Table below={(f) => (f.name === "fig" ? <p>Not saved</p> : null)} />)
    const fig = document.querySelector('[data-row="fig"]') as HTMLElement
    expect(within(fig).getByText("Not saved")).toBeInTheDocument()
    expect(within(document.querySelector('[data-row="pear"]') as HTMLElement).queryByText("Not saved")).toBeNull()
  })

  it("answers a click anywhere on a row with that row", async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    render(<Table onRowClick={onRowClick} />)
    await user.click(screen.getByRole("cell", { name: "apple" }))
    expect(onRowClick).toHaveBeenCalledWith(FRUIT[1], expect.anything())
  })

  it("shows one page of the sorted rows, so a sort orders every page and not only the one on screen", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Table />)
    rerender(
      <DataTable
        label="Fruit"
        rows={FRUIT}
        rowKey={(f) => f.name}
        columns={COLUMNS}
        minWidth="20rem"
        page={{ index: 1, size: 2 }}
      />,
    )
    expect(names().map((c) => c.textContent)).toEqual(["pear", "apple"])
    await user.click(screen.getByRole("button", { name: "Sort by count" }))
    expect(names().map((c) => c.textContent)).toEqual(["fig", "pear"])
  })
})
