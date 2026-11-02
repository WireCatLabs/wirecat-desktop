import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { parseQuery } from "@/domain/runs"
import { QueryBar } from "./QueryBar"

const NAMES: Record<string, string> = { "from:6034997871": "Милочка" }

function Bar(props: { start: string; named?: boolean }) {
  const [query, setQuery] = useState(props.start)
  return (
    <>
      <QueryBar
        query={query}
        parsed={parseQuery(query)}
        problems={[]}
        problem={null}
        suggest={() => ({ from: 0, to: 0, items: [] })}
        words={{ label: "Search", placeholder: "", hint: "" }}
        docs=""
        onChange={setQuery}
        {...(props.named === false ? {} : { named: (field, value) => NAMES[`${field}:${value}`] ?? null })}
      />
      <output>{query}</output>
    </>
  )
}

describe("QueryBar names", () => {
  it("shows the name over the id, and keeps the id in the box and the query", () => {
    render(<Bar start="invoice from:6034997871" />)
    const chip = screen.getByRole("button", { name: "Edit from: Милочка" })
    expect(chip).toHaveAttribute("title", "from: Милочка\nfrom:6034997871")
    expect(screen.getByRole("combobox", { name: "Search" })).toHaveValue("invoice from:6034997871")
    expect(screen.getByRole("combobox", { name: "Search" })).toHaveAccessibleDescription(/from: Милочка/)
  })

  it("removes the whole term with Backspace after it or Delete before it", async () => {
    const user = userEvent.setup()
    render(<Bar start="from:6034997871 invoice" />)
    const bar = screen.getByRole("combobox", { name: "Search" }) as HTMLInputElement
    await user.click(bar)
    bar.setSelectionRange(0, 0)
    await user.keyboard("{Delete}")
    expect(bar).toHaveValue("invoice")

    await user.clear(bar)
    await user.type(bar, "a from:6034997871")
    await user.keyboard("{Backspace}")
    expect(bar).toHaveValue("a")
  })

  it("edits the id as text once the caret is inside the term", async () => {
    const user = userEvent.setup()
    render(<Bar start="from:6034997871" />)
    const bar = screen.getByRole("combobox", { name: "Search" }) as HTMLInputElement
    await user.click(bar)
    bar.setSelectionRange(14, 14)
    await user.keyboard("{Backspace}")
    expect(bar).toHaveValue("from:603499781")
    expect(screen.queryByRole("button", { name: /Edit from/ })).not.toBeInTheDocument()
  })

  it("draws no names where the page gives none, as in Logs", () => {
    render(<Bar start="from:6034997871" named={false} />)
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument()
  })
})
