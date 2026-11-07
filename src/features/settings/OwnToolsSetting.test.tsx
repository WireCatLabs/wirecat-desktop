import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { render, screen } from "@/testing/render"
import { OwnToolsSetting } from "./OwnToolsSetting"

afterEach(() => vi.restoreAllMocks())

it("turns on only after its warning is confirmed", async () => {
  vi.spyOn(platform, "ownToolsStatus").mockResolvedValue({ allowed: false, flag: false, added: 0 })
  const save = vi.spyOn(platform, "setOwnToolsAllowed").mockResolvedValue()
  render(<OwnToolsSetting />)
  const box = await screen.findByRole("switch", { name: "Allow tools WireCat has not checked" })
  await vi.waitFor(() => expect(box).toBeEnabled())

  await userEvent.click(box)
  expect(screen.getByText(/access to all your personal data/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(save).not.toHaveBeenCalled()
  expect(box).not.toBeChecked()

  await userEvent.click(box)
  await userEvent.click(screen.getByRole("button", { name: "Allow" }))
  expect(save).toHaveBeenCalledWith(true)
  expect(box).toBeChecked()
})

it("opens the docs section on adding your own tool", async () => {
  vi.spyOn(platform, "ownToolsStatus").mockResolvedValue({ allowed: false, flag: false, added: 0 })
  const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
  render(<OwnToolsSetting />)
  await userEvent.click(await screen.findByRole("button", { name: "How it works" }))
  expect(open).toHaveBeenCalledWith("https://wirecat.dev/en/docs/desktop#add-your-own-tool")
})
