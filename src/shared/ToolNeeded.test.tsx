import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { render, screen } from "@/testing/render"
import { ToolNeeded } from "./ToolNeeded"

describe("ToolNeeded", () => {
  it("says the tool is not installed, names the others that would do, and opens its row on Tools", async () => {
    const user = userEvent.setup()
    render(<ToolNeeded gap={{ kind: "missing", tool: "memo", others: ["tg"] }} />)
    expect(screen.getByText(/reads Memo, which is not installed\. Telegram would do as well\./)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Install Memo" }))
    expect(useNav.getState().active).toBe("tools")
    expect(useTools.getState().expanded).toBe("memo")
  })

  it("updates a tool that is too old and shows its row", async () => {
    const user = userEvent.setup()
    const install = vi.fn(async () => {})
    useTools.setState({ install })
    render(<ToolNeeded gap={{ kind: "old", tool: "memo", version: "0.131.2", need: "0.131.72" }} />)
    expect(screen.getByText(/needs Memo 0\.131\.72 or newer; this computer has 0\.131\.2/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update Memo" }))
    expect(install).toHaveBeenCalledWith("memo")
    expect(useTools.getState().expanded).toBe("memo")
  })

  it("says 'this' inside a panel and closes what would stay over the Tools page", async () => {
    const user = userEvent.setup()
    useTools.setState({ install: vi.fn(async () => {}) })
    const close = vi.fn()
    render(<ToolNeeded inline gap={{ kind: "old", tool: "memo", version: "0.131.2", need: null }} onGo={close} />)
    expect(screen.getByText("This needs a newer Memo than 0.131.2.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update Memo" }))
    expect(close).toHaveBeenCalled()
    expect(useNav.getState().active).toBe("tools")
  })

  it("sends a signed-out tool's owner to its accounts", async () => {
    const user = userEvent.setup()
    render(<ToolNeeded gap={{ kind: "signedOut", tool: "bitrix" }}>Your own deals still work.</ToolNeeded>)
    expect(screen.getByText("Your own deals still work.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Sign in to Bitrix24" }))
    expect(useNav.getState().active).toBe("tools")
    expect(useTools.getState().expanded).toBe("bitrix")
  })
})
