import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import type { CatalogTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { OWN } from "@/platform/mock-community"
import { render, screen, waitFor, within } from "@/testing/render"
import { RemoveOwn } from "./RemoveOwn"

const tool = { ...OWN, source: "own" } as unknown as CatalogTool

afterEach(() => vi.restoreAllMocks())

it("offers to uninstall first, while the tool is still listed, and removes nothing then", async () => {
  const remove = vi.spyOn(platform, "ownToolRemove").mockResolvedValue()
  const onUninstall = vi.fn()
  render(<RemoveOwn tool={tool} installed onUninstall={onUninstall} />)
  await userEvent.click(screen.getByRole("button", { name: "Remove from WireCat" }))
  await userEvent.click(await screen.findByRole("button", { name: "Uninstall it first" }))
  expect(onUninstall).toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it("removes the entry and reads the tool list again, with no restart", async () => {
  const remove = vi.spyOn(platform, "ownToolRemove").mockResolvedValue()
  const extra = vi.spyOn(platform, "extraTools").mockResolvedValue({ tools: [], rejected: [] })
  render(<RemoveOwn tool={tool} installed={false} onUninstall={vi.fn()} />)
  await userEvent.click(screen.getByRole("button", { name: "Remove from WireCat" }))
  const dialog = await screen.findByRole("dialog")
  expect(within(dialog).queryByRole("button", { name: "Uninstall it first" })).not.toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole("button", { name: "Remove from WireCat" }))
  expect(remove).toHaveBeenCalledWith("acmecrm")
  await waitFor(() => expect(extra).toHaveBeenCalled())
  expect(screen.queryByRole("button", { name: "Restart now" })).not.toBeInTheDocument()
})
