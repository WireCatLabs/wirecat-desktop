import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { Tab, TabList, TabPanel, Tabs } from "./Tabs"

function Demo({ orientation }: { orientation?: "vertical" }) {
  const [tab, setTab] = useState("a")
  return (
    <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} {...(orientation ? { orientation } : {})}>
      <TabList aria-label="Demo">
        <Tab id="a">Alpha</Tab>
        <Tab id="b">Beta</Tab>
        <Tab id="c">Gamma</Tab>
      </TabList>
      <TabPanel id={tab}>Panel {tab}</TabPanel>
    </Tabs>
  )
}

describe("Tabs", () => {
  it("marks the chosen tab and names the panel after it", () => {
    render(<Demo />)
    expect(screen.getByRole("tablist", { name: "Demo" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "false")
    expect(screen.getByRole("tabpanel", { name: "Alpha" })).toHaveTextContent("Panel a")
  })

  it("moves the choice with the arrow keys, Home and End, and keeps only the chosen tab in the tab order", async () => {
    const user = userEvent.setup()
    render(<Demo />)
    await user.tab()
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus()
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("tabindex", "-1")
    await user.keyboard("{End}")
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveFocus()
    await user.keyboard("{Home}")
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true")
  })

  it("lists vertically with Up and Down", async () => {
    const user = userEvent.setup()
    render(<Demo orientation="vertical" />)
    expect(screen.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical")
    await user.tab()
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true")
  })

  it("selects by click and carries the tab's key for code that must focus it", async () => {
    const user = userEvent.setup()
    render(<Demo />)
    await user.click(screen.getByRole("tab", { name: "Gamma" }))
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel c")
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("data-tab", "c")
  })
})
