import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import { render, screen, waitFor, within } from "@/testing/render"
import { AccountList } from "./Health"

const tool = (id: string) => findTool(id) as NonNullable<ReturnType<typeof findTool>>

beforeEach(() => {
  vi.spyOn(platform, "syncLast").mockResolvedValue({
    at: new Date(Date.now() - 12 * 60_000).toISOString(),
    left: null,
    known: true,
  })
})

afterEach(() => vi.restoreAllMocks())

const signedIn = [
  { name: "personal", signedIn: true },
  { name: "work", signedIn: true },
]

const openMenu = async (profile: string) => {
  await userEvent.click(screen.getByRole("button", { name: `More for ${profile}` }))
  return screen.getByRole("menu")
}

describe("an account row", () => {
  it("has its name, state, last sync, Sync, and the rest behind ⋯", async () => {
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={() => undefined} />)
    const row = screen.getByRole("listitem", { name: "Telegram account personal" })
    expect(within(row).getByText("signed in")).toBeInTheDocument()
    expect(await within(row).findByText("Last synced 12 min ago")).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: "Sync Telegram personal now" })).toBeInTheDocument()
    const menu = await openMenu("personal")
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((i) => i.textContent),
    ).toEqual(["Check", "Settings", "Remove account…"])
  })

  it("shows a check's result under the row it was asked from, and folds it away", async () => {
    vi.spyOn(platform, "diagnose").mockResolvedValue({
      command: "tg work doctor --record --json",
      exitCode: 0,
      durationMs: 400,
      report: { item: { profile: "work", login: { state: "signed_in" } } },
      stderr: "",
    })
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={() => undefined} />)
    await userEvent.click(within(await openMenu("work")).getByRole("menuitem", { name: "Check" }))
    expect(platform.diagnose).toHaveBeenCalledWith("tg", "work")
    const work = screen.getByRole("listitem", { name: "Telegram account work" })
    expect(await within(work).findByText("Technical details")).toBeInTheDocument()
    const personal = screen.getByRole("listitem", { name: "Telegram account personal" })
    expect(within(personal).queryByText("Technical details")).not.toBeInTheDocument()
    await userEvent.click(within(work).getByRole("button", { name: "Close the check" }))
    await waitFor(() => expect(within(work).queryByText("Technical details")).not.toBeInTheDocument())
  })

  it("offers Sign in again for a signed-out account and no Sync", () => {
    render(<AccountList tool={tool("tg")} profiles={[{ name: "work", signedIn: false }]} onReload={() => undefined} />)
    const row = screen.getByRole("listitem", { name: "Telegram account work" })
    expect(within(row).getByText("not signed in")).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: "Sign in again" })).toBeInTheDocument()
    expect(within(row).queryByRole("button", { name: /^Sync/ })).not.toBeInTheDocument()
  })
})

describe("removing an account", () => {
  it("lists what the sign-out removes and keeps, offers no data deletion, and signs out", async () => {
    const remove = vi.spyOn(platform, "accountRemove").mockResolvedValue({ result: "signedOut", wasSignedIn: true })
    const reload = vi.fn()
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={reload} />)
    await userEvent.click(within(await openMenu("work")).getByRole("menuitem", { name: "Remove account…" }))
    const dialog = screen.getByRole("dialog", { name: "Remove work?" })
    expect(within(dialog).getByText("The sign-in on this computer")).toBeInTheDocument()
    expect(within(dialog).getByText(/The messages already copied here/)).toBeInTheDocument()
    expect(within(dialog).getByText("tg work session end --record --json")).toBeInTheDocument()
    expect(within(dialog).getByRole("group", { name: "Sign out and delete its data" })).toBeDisabled()
    expect(within(dialog).getByText(/cannot delete one account's data yet/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign out" }))
    expect(remove).toHaveBeenCalledWith("tg", "work", false)
    expect(await within(dialog).findByText(/work is signed out of Telegram/)).toBeInTheDocument()
    expect(reload).toHaveBeenCalled()
  })

  it("says the tool's own reason when the sign-out fails, and keeps the dialog open to try again", async () => {
    vi.spyOn(platform, "accountRemove").mockResolvedValue({ result: "failed", message: "tg serve is running" })
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={() => undefined} />)
    await userEvent.click(within(await openMenu("work")).getByRole("menuitem", { name: "Remove account…" }))
    const dialog = screen.getByRole("dialog", { name: "Remove work?" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign out" }))
    expect(await within(dialog).findByText("tg serve is running")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("explains that Zoom cannot sign out, with nothing to run", async () => {
    const remove = vi.spyOn(platform, "accountRemove")
    render(
      <AccountList tool={tool("zm")} profiles={[{ name: "personal", signedIn: null }]} onReload={() => undefined} />,
    )
    await userEvent.click(within(await openMenu("personal")).getByRole("menuitem", { name: "Remove account…" }))
    const dialog = screen.getByRole("dialog", { name: "Remove personal?" })
    expect(within(dialog).getByText(/Zoom cannot sign an account out yet/)).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })
})

describe("Drive's folders", () => {
  it("lists the chosen folders, removes one, and offers Sync now as the next step", async () => {
    vi.spyOn(platform, "driveFoldersChosen")
      .mockResolvedValueOnce({ result: "listed", folders: [{ id: "1Notes", name: "Meeting notes" }] })
      .mockResolvedValue({ result: "listed", folders: [] })
    const remove = vi.spyOn(platform, "driveFolderRemove").mockResolvedValue({ result: "removed" })
    render(
      <AccountList tool={tool("drive")} profiles={[{ name: "personal", signedIn: true }]} onReload={() => undefined} />,
    )
    await userEvent.click(within(await openMenu("personal")).getByRole("menuitem", { name: "Choose folders" }))
    const panel = screen.getByRole("region", { name: "Folders Drive copies for personal" })
    expect(within(panel).getByText(/Files outside them stay in Drive and are not read/)).toBeInTheDocument()
    await userEvent.click(await within(panel).findByRole("button", { name: "Stop importing Meeting notes" }))
    expect(remove).toHaveBeenCalledWith("drive", "personal", "1Notes")
    expect(await within(panel).findByText(/Sync now to copy or drop their text/)).toBeInTheDocument()
    expect(within(panel).getByText(/Drive copies nothing for this account/)).toBeInTheDocument()
  })
})
