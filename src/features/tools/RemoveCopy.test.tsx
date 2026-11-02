import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useTools } from "./store"
import { ToolDetails } from "./ToolDetails"

const zm = findTool("zm") as NonNullable<ReturnType<typeof findTool>>
const kept = { path: "~/.local/share/pnpm/bin/zm", version: "0.42.0", manager: "pnpm", problem: null }
const extra = { path: "~/.nvm/versions/node/v24.19.0/bin/zm", version: "0.40.0", manager: "npm", problem: null }

beforeEach(() => {
  useTools.setState(useTools.getInitialState(), true)
  useTools.setState({ installs: { zm: [kept, extra] }, latest: { zm: "0.42.0" } })
  vi.restoreAllMocks()
})

it("removes only the unused copy, after a confirmation that names it, and stays open to say so", async () => {
  const remove = vi.spyOn(platform, "removeCopy").mockResolvedValue({
    removed: true,
    refused: null,
    log: ["$ npm uninstall --global @wirecat/zoom-cli"],
    message: null,
    hint: null,
  })
  vi.spyOn(useTools.getState(), "refresh").mockImplementation(async () => {
    useTools.setState({ installs: { zm: [kept] } })
  })
  render(<ToolDetails tool={zm} />)

  fireEvent.click(screen.getByRole("button", { name: "Remove this copy" }))
  const dialog = await screen.findByRole("dialog", { name: "Remove this copy?" })
  expect(dialog).toHaveTextContent(extra.path)
  expect(dialog).toHaveTextContent("nvm exec v24.19.0 npm uninstall --global @wirecat/zoom-cli")
  expect(remove).not.toHaveBeenCalled()

  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))
  expect(await within(dialog).findByText(/^Removed/)).toBeInTheDocument()
  expect(remove).toHaveBeenCalledWith("zm", extra.path)
  expect(await within(dialog).findByText(/One copy is left/)).toHaveTextContent(kept.path)
  expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument()
})

it("shows the reason and the command to run by hand when the removal fails", async () => {
  vi.spyOn(platform, "removeCopy").mockResolvedValue({
    removed: false,
    refused: null,
    log: ["npm error code EACCES"],
    message: "npm could not write to its global folder.",
    hint: null,
  })
  vi.spyOn(useTools.getState(), "refresh").mockResolvedValue()
  render(<ToolDetails tool={zm} />)

  fireEvent.click(screen.getByRole("button", { name: "Remove this copy" }))
  const dialog = await screen.findByRole("dialog", { name: "Remove this copy?" })
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))
  expect(await within(dialog).findByText(/could not write/)).toBeInTheDocument()
  expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  expect(dialog).toHaveTextContent("Run the command yourself instead")
})

it("says in the reader's language why a copy was refused, and offers no button for a copy it cannot remove", async () => {
  useLanguage.setState({ choice: "ru" })
  vi.spyOn(platform, "removeCopy").mockResolvedValue({
    removed: false,
    refused: "runs",
    log: [],
    message: "It is the copy WireCat runs, so it stays.",
    hint: null,
  })
  const bun = { path: "~/.bun/bin/zm", version: "0.39.0", manager: "bun", problem: null }
  useTools.setState({ installs: { zm: [kept, extra, bun] } })
  render(<ToolDetails tool={zm} />)

  expect(screen.getAllByRole("button", { name: "Удалить эту копию" })).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Удалить эту копию" }))
  const dialog = await screen.findByRole("dialog", { name: "Удалить эту копию?" })
  fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }))
  expect(await within(dialog).findByText(/Это копия, которую запускает WireCat/)).toBeInTheDocument()
  useLanguage.setState({ choice: "en" })
})
