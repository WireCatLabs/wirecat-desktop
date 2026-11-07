import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { InstallEvent, OwnRefusal } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { ownReview } from "@/platform/mock-community"
import { render, screen } from "@/testing/render"
import { OwnToolDialog } from "./OwnToolDialog"
import { useOwnDialog } from "./own-store"

const PKG = "@example/acme-crm-cli"

const done: InstallEvent = {
  event: "done",
  version: "0.3.0",
  path: "~/bin/wcat-acme-crm",
  shadowedBy: null,
  skills: { refreshed: [], failed: null },
  pathFix: null,
}

beforeEach(() => useOwnDialog.setState({ open: true, update: null }))
afterEach(() => vi.restoreAllMocks())

async function check(pkg = PKG) {
  render(<OwnToolDialog />)
  await userEvent.type(await screen.findByRole("textbox", { name: "npm package name" }), pkg)
  await userEvent.click(screen.getByRole("button", { name: "Check package" }))
}

describe("Add your own tool", () => {
  it("installs only after the review's Add and the second confirmation", async () => {
    const discover = vi.spyOn(platform, "ownToolDiscover").mockResolvedValue({ outcome: "review", review: ownReview() })
    const add = vi.spyOn(platform, "ownToolAdd").mockImplementation(async (_token, onEvent) => onEvent(done))
    await check()
    expect(discover).toHaveBeenCalledWith(PKG, null)
    expect(await screen.findByText("Built by https://github.com/example/acme-crm-cli on GitHub Actions")).toBeVisible()
    expect(screen.getByText("deals update")).toBeInTheDocument()
    expect(screen.getAllByText(/WireCat has not checked this tool/).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(add).not.toHaveBeenCalled()
    expect(screen.getByText("Its install scripts and first run use your permissions.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Install and run" }))
    expect(add).toHaveBeenCalledWith("review-1", expect.any(Function))
    expect(await screen.findByText(/Acme CRM is added/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restart now" })).toBeInTheDocument()
  })

  it("says when npm has no record of where it was built", async () => {
    const review = ownReview({ built: null, repo: null })
    vi.spyOn(platform, "ownToolDiscover").mockResolvedValue({ outcome: "review", review })
    await check()
    expect(await screen.findByText("No record of where npm built it")).toBeInTheDocument()
    expect(screen.getByText("No public GitHub repository")).toBeInTheDocument()
  })

  it.each<[OwnRefusal, RegExp]>([
    [{ kind: "not_found" }, /npm has no package with this name/],
    [{ kind: "not_scoped" }, /Only scoped package names work here/],
    [{ kind: "wirecat_scope" }, /belongs to WireCat's own tools/],
    [{ kind: "bad_manifest", key: "setup", rule: "the command word is not allowed." }, /problem in "setup"/],
    [{ kind: "collision", with: "Telegram", listed: false }, /Telegram already uses/],
    [{ kind: "collision", with: "Acme Listed", listed: true }, /Remove your own entry to use the listed one/],
    [{ kind: "provenance_mismatch", claimed: "https://a", built: "https://b" }, /built by https:\/\/b/],
    [{ kind: "offline", detail: "ENOTFOUND" }, /could not reach npm/],
    [{ kind: "too_large", what: "package" }, /larger than WireCat reads/],
  ])("explains a %o refusal in a sentence", async (refusal, sentence) => {
    vi.spyOn(platform, "ownToolDiscover").mockResolvedValue({ outcome: "refused", refusal })
    await check()
    expect(await screen.findByRole("alert")).toHaveTextContent(sentence)
  })

  it("asks for the desktop object of a tool that does not describe itself", async () => {
    const discover = vi
      .spyOn(platform, "ownToolDiscover")
      .mockResolvedValueOnce({ outcome: "refused", refusal: { kind: "no_manifest" } })
      .mockResolvedValueOnce({ outcome: "review", review: ownReview({ described: false }) })
    await check()
    const box = await screen.findByRole("textbox", { name: "The tool's desktop object (JSON)" })
    await userEvent.click(box)
    await userEvent.paste('{"tagline":"x"}')
    await userEvent.click(screen.getByRole("button", { name: "Check with this object" }))
    expect(discover).toHaveBeenLastCalledWith(PKG, '{"tagline":"x"}')
    expect(await screen.findByText("Acme CRM")).toBeInTheDocument()
  })

  it("offers Uninstall when the installed tool describes another manifest", async () => {
    vi.spyOn(platform, "ownToolDiscover").mockResolvedValue({ outcome: "review", review: ownReview() })
    vi.spyOn(platform, "ownToolAdd").mockImplementation(async (_token, onEvent) => {
      onEvent({ event: "step", step: "verify" })
      onEvent({
        event: "failed",
        reason: "verify",
        message: "The installed tool describes itself differently.",
        hint: null,
      })
    })
    const uninstall = vi
      .spyOn(platform, "ownToolUninstall")
      .mockImplementation(async (_t, onEvent) => onEvent({ event: "removed" }))
    await check()
    await userEvent.click(await screen.findByRole("button", { name: "Add" }))
    await userEvent.click(screen.getByRole("button", { name: "Install and run" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/describes itself differently/)
    await userEvent.click(screen.getByRole("button", { name: "Uninstall it" }))
    expect(uninstall).toHaveBeenCalledWith("review-1", expect.any(Function))
    expect(await screen.findByText("The package is uninstalled.")).toBeInTheDocument()
  })

  it("updates at once when nothing new is asked, and asks again for a new repository", async () => {
    useOwnDialog.setState({ open: true, update: { pkg: PKG, name: "Acme CRM" } })
    const same = { fromVersion: "0.2.0", repoChanged: false, fromRepo: null, newWrites: [], confirm: false }
    vi.spyOn(platform, "ownToolDiscover").mockResolvedValueOnce({
      outcome: "review",
      review: ownReview({ update: same }),
    })
    const add = vi.spyOn(platform, "ownToolAdd").mockImplementation(async (_token, onEvent) => onEvent(done))
    const { unmount } = render(<OwnToolDialog />)
    expect(await screen.findByText(/Acme CRM is added/)).toBeInTheDocument()
    expect(add).toHaveBeenCalledTimes(1)
    unmount()

    const moved = { ...same, repoChanged: true, fromRepo: "https://github.com/example/old", confirm: true }
    vi.spyOn(platform, "ownToolDiscover").mockResolvedValueOnce({
      outcome: "review",
      review: ownReview({ update: moved }),
    })
    useOwnDialog.setState({ open: false })
    render(<OwnToolDialog />)
    useOwnDialog.setState({ open: true, update: { pkg: PKG, name: "Acme CRM" } })
    expect(
      await screen.findByText(/The repository changed from https:\/\/github.com\/example\/old/),
    ).toBeInTheDocument()
    expect(add).toHaveBeenCalledTimes(1)
  })
})
