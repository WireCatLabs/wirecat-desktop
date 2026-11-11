import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { parseQuery } from "@/domain/runs"
import { render, screen } from "@/testing/render"
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
  it("keeps the id in the box as typed and names it in a muted line under it", () => {
    render(<Bar start="invoice from:6034997871" />)
    const bar = screen.getByRole("combobox", { name: "Search" })
    expect(bar).toHaveValue("invoice from:6034997871")
    expect(bar).toHaveAccessibleDescription(/Names in this search: from:6034997871 Милочка/)
    expect(screen.queryByRole("button", { name: /Edit|Remove/ })).not.toBeInTheDocument()
  })

  it("edits and deletes the id as plain text", async () => {
    const user = userEvent.setup()
    render(<Bar start="from:6034997871" />)
    const bar = screen.getByRole("combobox", { name: "Search" }) as HTMLInputElement
    await user.click(bar)
    bar.setSelectionRange(15, 15)
    await user.keyboard("{Backspace}")
    expect(bar).toHaveValue("from:603499787")
    expect(bar).not.toHaveAccessibleDescription(/Names in this search/)
  })

  it("names nothing where the page gives no names, as in Logs", () => {
    render(<Bar start="from:6034997871" named={false} />)
    expect(screen.getByRole("combobox", { name: "Search" })).not.toHaveAccessibleDescription(/Names/)
  })
})
