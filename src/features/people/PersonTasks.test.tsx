import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { useNav } from "@/shared/nav"
import { useTools } from "@/shared/tools-store"
import { render, screen } from "@/testing/render"
import { PersonTasks } from "./PersonTasks"
import { usePeople } from "./store"

describe("A person's tasks", () => {
  it("offers the memo update when memo is too old to list them, and leaves the person for it", async () => {
    vi.spyOn(platform, "taskList").mockResolvedValue({ kind: "old", version: "0.120.0", need: "0.131.0" })
    useTools.setState({ install: vi.fn(async () => {}) })
    const reveal = vi.spyOn(usePeople.getState(), "reveal")
    const user = userEvent.setup()
    render(<PersonTasks reference="person:1" />)
    expect(await screen.findByText(/This needs Memo 0\.131\.0 or newer; this computer has 0\.120\.0/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Update Memo" }))
    expect(reveal).toHaveBeenCalledWith(null)
    expect(useNav.getState().active).toBe("tools")
  })
})
