import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import type { Removal } from "@/platform/bindings"
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

const plan = (data: "kept" | "deleted", dryRun: boolean): Removal => ({
  data,
  dryRun,
  revoked: null,
  configFile: "~/.config/tg-cli/config.json",
  removed: [
    { kind: "signIn", target: "the Telegram session", reason: null, chosen: false },
    { kind: "keyring", target: "app-keys:work", reason: null, chosen: false },
    { kind: "config", target: "profiles.work", reason: null, chosen: false },
    { kind: "file", target: "~/.local/state/tg-cli/accounts/work.json", reason: null, chosen: false },
    ...(data === "deleted" ? [{ kind: "store" as const, target: "telegram", reason: null, chosen: false }] : []),
  ],
  kept: [
    {
      kind: "file",
      target: "~/.local/state/tg-cli/sends/work.jsonl",
      reason: "the record of what was sent",
      chosen: false,
    },
    ...(data === "kept" ? [{ kind: "store" as const, target: "telegram", reason: null, chosen: true }] : []),
  ],
})

const openRemove = async (profile = "work") => {
  await userEvent.click(within(await openMenu(profile)).getByRole("menuitem", { name: "Remove account…" }))
  return screen.getByRole("dialog", { name: `Remove ${profile}?` })
}

describe("removing an account", () => {
  beforeEach(() => vi.spyOn(platform, "accountRemoveSupported").mockResolvedValue(true))

  it("shows the tool's dry run for the choice, removes on confirm, and the row leaves", async () => {
    const dry = vi
      .spyOn(platform, "accountRemovePlan")
      .mockResolvedValue({ result: "answered", removal: plan("kept", true) })
    const remove = vi
      .spyOn(platform, "accountRemove")
      .mockResolvedValue({ result: "answered", removal: plan("kept", false) })
    const reload = vi.fn()
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={reload} />)
    const dialog = await openRemove()
    await userEvent.click(
      await within(dialog).findByRole("button", { name: /Remove, keep its data \(search still finds it\)/ }),
    )
    expect(dry).toHaveBeenCalledWith("tg", "work", false)
    expect(await within(dialog).findByText("Saved keys in the system keyring")).toBeInTheDocument()
    expect(within(dialog).getAllByText("~/.local/state/tg-cli")).toHaveLength(2)
    expect(within(dialog).getByText("accounts/work.json")).toBeInTheDocument()
    expect(within(dialog).getByText("Kept as you chose: search still finds them")).toBeInTheDocument()
    expect(within(dialog).getByText("tg work account remove --keep-data --record --json --yes")).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove work, keep its data" }))
    expect(remove).toHaveBeenCalledWith("tg", "work", false)
    expect(await within(dialog).findByText(/work is removed from Telegram\. Its messages stay/)).toBeInTheDocument()
    expect(within(dialog).getByText("Removed: the sign-in, saved keys, settings, files.")).toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }))
    const row = screen.getByRole("listitem", { name: "Telegram account work" })
    expect(row.firstElementChild).toHaveAttribute("data-state", "closed")
    await waitFor(() => expect(reload).toHaveBeenCalled())
  })

  it("lists the store under what goes when the data is deleted, and goes back to the choice", async () => {
    vi.spyOn(platform, "accountRemovePlan").mockResolvedValue({ result: "answered", removal: plan("deleted", true) })
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={() => undefined} />)
    const dialog = await openRemove()
    await userEvent.click(await within(dialog).findByRole("button", { name: /Remove and delete its data/ }))
    expect(await within(dialog).findByText("Its messages in the shared store")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Remove work and delete its data" })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Back" }))
    expect(await within(dialog).findByRole("button", { name: /Remove and delete its data/ })).toBeInTheDocument()
  })

  it("says what holds a busy account and how to stop it, and removes nothing", async () => {
    vi.spyOn(platform, "accountRemovePlan").mockResolvedValue({
      result: "refused",
      reason: "busy",
      holder: null,
      message: "`tg serve` is running for work — stop it first (`tg work server stop`)",
    })
    const remove = vi.spyOn(platform, "accountRemove")
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={() => undefined} />)
    const dialog = await openRemove()
    await userEvent.click(await within(dialog).findByRole("button", { name: /Remove, keep its data/ }))
    expect(await within(dialog).findByText(/something is using this account right now/)).toBeInTheDocument()
    expect(within(dialog).getByText(/tg work server stop/)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
  })

  it("names the app's own sync when it holds the account", async () => {
    vi.spyOn(platform, "accountRemovePlan").mockResolvedValue({
      result: "refused",
      reason: "busy",
      holder: "sync",
      message: "Something else runs for this account",
    })
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={() => undefined} />)
    const dialog = await openRemove()
    await userEvent.click(await within(dialog).findByRole("button", { name: /Remove, keep its data/ }))
    expect(await within(dialog).findByText(/A sync of work is running/)).toBeInTheDocument()
  })

  it("signs out only, with the update that removes it fully, when the tool is too old", async () => {
    vi.spyOn(platform, "accountRemoveSupported").mockResolvedValue(false)
    const signOut = vi.spyOn(platform, "accountSignOut").mockResolvedValue({ result: "signedOut", wasSignedIn: true })
    const reload = vi.fn()
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={reload} />)
    const dialog = await openRemove()
    expect(await within(dialog).findByText("Update Telegram to remove the account fully.")).toBeInTheDocument()
    expect(within(dialog).getByText("The sign-in on this computer")).toBeInTheDocument()
    expect(within(dialog).getByText("tg work session end --record --json")).toBeInTheDocument()
    expect(within(dialog).getByRole("group", { name: "Sign out and delete its data" })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign out" }))
    expect(signOut).toHaveBeenCalledWith("tg", "work")
    expect(await within(dialog).findByText(/work is signed out of Telegram/)).toBeInTheDocument()
    expect(reload).toHaveBeenCalled()
  })

  it("keeps the dialog open to try the sign-out again when it fails", async () => {
    vi.spyOn(platform, "accountRemoveSupported").mockResolvedValue(false)
    vi.spyOn(platform, "accountSignOut").mockResolvedValue({ result: "failed", message: "tg serve is running" })
    render(<AccountList tool={tool("tg")} profiles={signedIn} onReload={() => undefined} />)
    const dialog = await openRemove()
    await userEvent.click(await within(dialog).findByRole("button", { name: "Sign out" }))
    expect(await within(dialog).findByText("tg serve is running")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("explains that an old Zoom cannot sign out, with nothing to run", async () => {
    vi.spyOn(platform, "accountRemoveSupported").mockResolvedValue(false)
    const signOut = vi.spyOn(platform, "accountSignOut")
    render(
      <AccountList tool={tool("zm")} profiles={[{ name: "personal", signedIn: null }]} onReload={() => undefined} />,
    )
    const dialog = await openRemove("personal")
    expect(await within(dialog).findByText(/Zoom cannot sign an account out yet/)).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
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
