import { beforeEach, expect, it, vi } from "vitest"
import { App } from "@/app/App"
import { findTool } from "@/domain/catalog"
import type { InstallSession } from "@/domain/status"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useCompat } from "@/shared/compat-store"
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
  expect(screen.getByText("Чаты и каналы · поиск · ответы")).toBeInTheDocument()
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

const doneInstall = () =>
  vi.spyOn(platform, "install").mockImplementation(async (_id, onEvent) => {
    const skills = { refreshed: [], failed: null }
    onEvent({ event: "done", version: "0.7.0", path: "", shadowedBy: null, skills, pathFix: null })
  })

const rowOf = async (name: RegExp) => {
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  return within(list).getByRole("button", { name }).closest("li") as HTMLElement
}

it("updates a tool whose newest version reads the new format in the same step, without asking", async () => {
  vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.7.0",
    known: true,
    cannotOpen: null,
    alsoUpdate: [{ id: "tg", version: "0.89.0" }],
    stops: [],
  })
  let finish = () => {}
  const install = vi.spyOn(platform, "install").mockImplementation(async (id, onEvent) => {
    if (id === "wa") await new Promise<void>((r) => (finish = r))
    const skills = { refreshed: [], failed: null }
    onEvent({ event: "done", version: "0.7.0", path: "", shadowedBy: null, skills, pathFix: null })
  })
  const afterInstall = vi.spyOn(useCompat.getState(), "checkAfterInstall")
  render(<App />)
  const row = await rowOf(/^WhatsApp/)
  fireEvent.click(await within(row).findByRole("button", { name: /^Update to/ }))

  expect(
    await within(row).findByText("Also updating Telegram so it keeps reading your saved messages and notes."),
  ).toBeInTheDocument()
  expect(within(row).queryByRole("alert")).toBeNull()
  finish()
  await waitFor(() => expect(install.mock.calls.map(([id]) => id)).toEqual(["wa", "tg"]))
  await waitFor(() => expect(useTools.getState().sessions.tg?.outcome?.event).toBe("done"))
  expect(afterInstall).not.toHaveBeenCalled()
  const tgRow = await rowOf(/^Telegram/)
  expect(within(tgRow).getByRole("button", { name: /^Telegram/ })).toHaveAttribute("aria-expanded", "false")
})

it("opens the panel of a tool updated alongside when its update fails", async () => {
  vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.7.0",
    known: true,
    cannotOpen: null,
    alsoUpdate: [{ id: "tg", version: "0.89.0" }],
    stops: [],
  })
  vi.spyOn(platform, "install").mockImplementation(async (id, onEvent) => {
    if (id === "tg") throw new Error("npm error code E404")
    const skills = { refreshed: [], failed: null }
    onEvent({ event: "done", version: "0.7.0", path: "", shadowedBy: null, skills, pathFix: null })
  })
  render(<App />)
  fireEvent.click(await within(await rowOf(/^WhatsApp/)).findByRole("button", { name: /^Update to/ }))
  await waitFor(() => expect(useTools.getState().sessions.tg?.outcome?.event).toBe("failed"))
  const tgRow = await rowOf(/^Telegram/)
  expect(within(tgRow).getByRole("button", { name: /^Telegram/ })).toHaveAttribute("aria-expanded", "true")
})

it("updates nothing alongside when the tool's own update fails", async () => {
  vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.7.0",
    known: true,
    cannotOpen: null,
    alsoUpdate: [{ id: "tg", version: "0.89.0" }],
    stops: [],
  })
  const install = vi.spyOn(platform, "install").mockRejectedValue(new Error("npm error code ECONNRESET"))
  render(<App />)
  fireEvent.click(await within(await rowOf(/^WhatsApp/)).findByRole("button", { name: /^Update to/ }))
  await waitFor(() => expect(useTools.getState().sessions.wa?.outcome?.event).toBe("failed"))
  expect(install.mock.calls.map(([id]) => id)).toEqual(["wa"])
  expect(useTools.getState().sessions.tg).toBeUndefined()
})

it("warns only about the tools with no version that reads the new format, and still updates the others", async () => {
  vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.7.0",
    known: true,
    cannotOpen: null,
    alsoUpdate: [{ id: "tg", version: "0.89.0" }],
    stops: ["max"],
  })
  const install = doneInstall()
  render(<App />)
  const row = await rowOf(/^WhatsApp/)
  fireEvent.click(await within(row).findByRole("button", { name: /^Update to/ }))

  const alert = await within(row).findByRole("alert")
  expect(install).not.toHaveBeenCalled()
  expect(alert).toHaveTextContent("MAX can't use them until its new version comes out, usually within a day.")
  expect(alert).not.toHaveTextContent("Telegram")
  expect(within(alert).getByRole("button", { name: "Not now" })).toHaveFocus()

  fireEvent.click(within(alert).getByRole("button", { name: "Update anyway" }))
  await waitFor(() => expect(install.mock.calls.map(([id]) => id)).toEqual(["wa", "tg"]))
})

it("updates nothing when the owner answers Not now", async () => {
  vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.7.0",
    known: true,
    cannotOpen: null,
    alsoUpdate: [{ id: "tg", version: "0.89.0" }],
    stops: ["max"],
  })
  const install = doneInstall()
  render(<App />)
  const row = await rowOf(/^WhatsApp/)
  fireEvent.click(await within(row).findByRole("button", { name: /^Update to/ }))
  fireEvent.click(within(await within(row).findByRole("alert")).getByRole("button", { name: "Not now" }))
  await waitFor(() => expect(within(row).queryByRole("alert")).toBeNull())
  expect(install).not.toHaveBeenCalled()
  expect(useTools.getState().sessions.tg).toBeUndefined()
})

it("installs without asking when the check finds nothing", async () => {
  vi.spyOn(platform, "storePreflight").mockResolvedValue({
    version: "0.30.0",
    known: true,
    cannotOpen: null,
    alsoUpdate: [],
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

it("gives an open tool's panel one purple button, with an account to sync and one to reconnect", async () => {
  render(<App />)
  const list = await screen.findByRole("list", { name: "WireCat tools" })
  const header = within(list).getByRole("button", { name: /^Telegram/ })
  const row = header.closest("li") as HTMLElement
  await within(row).findByRole("button", { name: "Manage" })
  fireEvent.click(header)
  await within(row).findByRole("button", { name: /^Sync .* now$/ })
  await within(row).findByRole("button", { name: "Reconnect" })
  const primary = row.querySelectorAll('[data-variant="primary"]')
  expect([...primary].map((b) => b.textContent)).toEqual(["Sign in here"])
})
