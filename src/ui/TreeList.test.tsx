import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { render, screen } from "@/testing/render"
import { TreeList, type TreeNode } from "./TreeList"

const NODES: TreeNode[] = [
  { id: "all", label: "All", count: "4" },
  {
    id: "a",
    label: "Account",
    count: "3",
    children: [
      { id: "a/p", label: "Projects", children: [{ id: "a/p/x", label: "Acme" }] },
      { id: "a/r", label: "Reviews" },
    ],
  },
]

function Harness() {
  const [selected, setSelected] = useState("all")
  return (
    <>
      <TreeList label="Folders" nodes={NODES} selected={selected} onSelect={setSelected} />
      <output>{selected}</output>
    </>
  )
}

describe("TreeList", () => {
  it("is one tab stop that the arrows move through, opening and closing nodes", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.tab()
    expect(screen.getByRole("treeitem", { name: /All/ })).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    const account = screen.getByRole("treeitem", { name: /Account/ })
    expect(account).toHaveFocus()
    expect(account).toHaveAttribute("aria-expanded", "false")
    await user.keyboard("{ArrowRight}")
    expect(account).toHaveAttribute("aria-expanded", "true")
    await user.keyboard("{ArrowRight}")
    expect(screen.getByRole("treeitem", { name: /Projects/ })).toHaveFocus()
    await user.keyboard("{ArrowLeft}")
    expect(account).toHaveFocus()
    await user.keyboard("{End}")
    expect(screen.getByRole("treeitem", { name: /Reviews/ })).toHaveFocus()
    await user.keyboard("{Home}")
    expect(screen.getByRole("treeitem", { name: /All/ })).toHaveFocus()
  })

  it("chooses with Enter or a click, and opens what it chose", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("treeitem", { name: /Account/ }))
    expect(screen.getByRole("status")).toHaveTextContent("a")
    expect(screen.getByRole("treeitem", { name: /Account/ })).toHaveAttribute("aria-selected", "true")
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}")
    expect(screen.getByRole("status")).toHaveTextContent("a/r")
  })
})
