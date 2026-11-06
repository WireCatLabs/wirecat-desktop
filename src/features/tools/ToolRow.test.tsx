import { beforeEach, expect, it, vi } from "vitest"
import { App } from "@/app/App"
import { findTool } from "@/domain/catalog"
import type { InstallSession } from "@/domain/status"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { useTools } from "@/shared/tools-store"
import { fireEvent, render, screen, waitFor, within } from "@/testing/render"
import { ToolRow } from "./ToolRow"

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>

beforeEach(() => {
  useOnboarding.setState({ status: "done", open: false })
  window.getSelection()?.removeAllRanges()
})

it("opens a row on a click and on Enter, but not when a drag over its text ends there", async () => {
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const header = within(list).getByRole("button", { name: /^Telegram/ })
  const row = header.closest("li") as HTMLElement
  await within(row).findByRole("button", { name: "Manage" })

  fireEvent.click(header)
  expect(header).toHaveAttribute("aria-expanded", "true")
  fireEvent.keyDown(header, { key: "Enter" })
  expect(header).toHaveAttribute("aria-expanded", "false")

  const text = within(header).getByText(tg.name).firstChild as Text
  window.getSelection()?.setBaseAndExtent(text, 0, text, 4)
  fireEvent.click(header)
  expect(header).toHaveAttribute("aria-expanded", "false")
})

it("opens a row while the tool check is still running (BUG-24)", async () => {
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const header = within(list).getByRole("button", { name: /^Telegram/ })
  expect(useTools.getState().installs.tg).toBeUndefined()

  fireEvent.click(header)
  expect(header).toHaveAttribute("aria-expanded", "true")
  expect(await within(header.closest("li") as HTMLElement).findByRole("button", { name: "Manage" })).toBeVisible()
})

it("speaks Russian, with the count in its own plural form", () => {
  useLanguage.setState({ choice: "ru" })
  const copy = (path: string) => ({ path, version: "0.89.0", manager: "npm", problem: null })
  useTools.setState({ installs: { tg: [copy("~/a/tg"), copy("~/b/tg"), copy("~/c/tg")] }, latest: { tg: "0.89.0" } })
  render(
    <ul>
      <ToolRow tool={tg} />
    </ul>,
  )
  expect(screen.getByText("3 копии установлены")).toBeInTheDocument()
  expect(screen.getByText("Ваш аккаунт Telegram для терминала и ИИ-агентов")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Управление" })).toBeInTheDocument()
})

it("closes a finished update's panel from Manage, its chevron and the name (the panel used to stay)", async () => {
  const copy = { path: "~/.local/share/pnpm/bin/tg", version: "0.89.0", manager: "pnpm", problem: null }
  const outcome = { event: "done", version: "0.89.0", path: copy.path, shadowedBy: null } as const
  const session: InstallSession = { operation: "install", step: "verify", log: [], outcome }
  useTools.setState({ installs: { tg: [copy] }, latest: { tg: "0.89.0" }, sessions: { tg: session } })
  render(<ToolRow tool={tg} />)
  const manage = screen.getByRole("button", { name: "Manage" })
  const header = screen.getByRole("button", { name: /^Telegram/ })
  expect(manage).toHaveAttribute("aria-expanded", "true")
  expect(header).toHaveAttribute("aria-expanded", "true")

  fireEvent.click(manage)
  expect(manage).toHaveAttribute("aria-expanded", "false")
  expect(header).toHaveAttribute("aria-expanded", "false")
  expect(useTools.getState().sessions.tg).toBeUndefined()
})

it("asks before an update that stops other tools, and updates the one that can follow in the same step", async () => {
  const preflight = vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.7.0",
    known: true,
    cannotOpen: null,
    stops: [
      { id: "tg", fixedIn: "0.89.0" },
      { id: "max", fixedIn: null },
    ],
  })
  const install = vi.spyOn(platform, "install").mockResolvedValue()
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const row = within(list)
    .getByRole("button", { name: /^WhatsApp/ })
    .closest("li") as HTMLElement
  fireEvent.click(await within(row).findByRole("button", { name: /^Update to/ }))

  const alert = await within(row).findByRole("alert")
  expect(preflight).toHaveBeenCalledWith("wa")
  expect(install).not.toHaveBeenCalled()
  expect(alert).toHaveTextContent("Telegram 0.89.0 reads it")
  expect(alert).toHaveTextContent("MAX can't use them until its new version comes out, usually within a day.")
  const both = within(alert).getByRole("button", { name: "Update WhatsApp and Telegram" })
  expect(both).toHaveFocus()

  fireEvent.click(both)
  await waitFor(() => expect(install.mock.calls.map(([id]) => id)).toEqual(["wa", "tg"]))
})

it("installs without asking when the check finds nothing", async () => {
  vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.30.0",
    known: true,
    cannotOpen: null,
    stops: [],
  })
  const install = vi.spyOn(platform, "install").mockResolvedValue()
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const row = within(list)
    .getByRole("button", { name: /^Google Drive/ })
    .closest("li") as HTMLElement
  fireEvent.click(await within(row).findByRole("button", { name: "Install" }))
  await waitFor(() => expect(install).toHaveBeenCalledWith("drive", expect.any(Function)))
  expect(within(row).queryByRole("alert")).toBeNull()
})
