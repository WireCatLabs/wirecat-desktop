import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CHECK_EVERY_MS, useUpdate } from "@/features/update/store"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSystem } from "@/shared/system-store"
import { render, screen, waitFor, within } from "@/testing/render"
import { App } from "./App"

const offer = { version: "0.2.0", notes: "Faster Storage page.", kind: "self" as const }

describe("App update", () => {
  beforeEach(() => {
    useOnboarding.setState({ status: "done", open: false })
    useUpdate.setState({
      update: null,
      open: false,
      phase: "available",
      progress: null,
      saved: null,
      failure: null,
      terminal: "idle",
      asked: "idle",
      checkFailure: null,
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it("offers nothing when this is the newest release or the check fails", async () => {
    const check = vi.spyOn(platform, "checkUpdate").mockRejectedValue(new Error("offline"))
    render(<App />)
    await waitFor(() => expect(useSystem.getState().readiness).not.toBeNull())
    expect(check).toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: /Update to/ })).not.toBeInTheDocument()
  })

  it("installs only after the user confirms, shows the download, then restarts", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue(offer)
    let finish = () => {}
    const install = vi.spyOn(platform, "installUpdate").mockImplementation(async (onProgress) => {
      onProgress({ downloaded: 4_000_000, total: 10_000_000 })
      await new Promise<void>((resolve) => {
        finish = resolve
      })
    })
    const restart = vi.spyOn(platform, "restart").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    expect(within(dialog).getByText("Faster Storage page.")).toBeInTheDocument()
    expect(install).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole("button", { name: "Install and restart" }))
    expect(await within(dialog).findByRole("progressbar", { name: "Downloading the update" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    )
    expect(within(dialog).getByRole("button", { name: "Install and restart" })).toBeDisabled()
    expect(restart).not.toHaveBeenCalled()

    finish()
    expect(await within(dialog).findByText("Installed. WireCat is restarting…")).toBeInTheDocument()
    expect(restart).toHaveBeenCalledOnce()
  })

  it("says why an install failed and lets the user try again or download it", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue(offer)
    vi.spyOn(platform, "installUpdate").mockRejectedValueOnce(new Error("The download stopped: connection reset"))
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    await user.click(within(dialog).getByRole("button", { name: "Install and restart" }))

    const alert = await within(dialog).findByRole("alert")
    expect(alert).toHaveTextContent("WireCat could not reach the update server.")
    expect(alert).toHaveTextContent("Check your internet connection, then try again.")
    expect(alert).toHaveTextContent("Details: The download stopped: connection reset")
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeEnabled()
    await user.click(within(dialog).getByRole("button", { name: "Open the download page" }))
    expect(open).toHaveBeenCalledWith("https://wirecat.dev/en/download")
  })

  it("hands a .deb to the system's installer and says what to do next", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "deb" })
    const install = vi.spyOn(platform, "installUpdate")
    const download = vi.spyOn(platform, "downloadPackageUpdate").mockResolvedValue({
      result: "saved",
      file: "wirecat_0.2.0_amd64.deb",
      path: "~/Downloads/wirecat_0.2.0_amd64.deb",
      opened: true,
      command:
        "sudo install -m 644 /home/u/Downloads/wirecat_0.2.0_amd64.deb /var/cache/apt/archives/ && sudo apt install /var/cache/apt/archives/wirecat_0.2.0_amd64.deb",
    })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    expect(within(dialog).getByText(/installed from a \.deb package \(Ubuntu, Debian, Linux Mint\)/)).toBeVisible()
    expect(within(dialog).getByText(/Your accounts and data will not be deleted/)).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "Download and install" }))

    expect(await within(dialog).findByText(/The system installer opened wirecat_0\.2\.0_amd64\.deb/)).toBeVisible()
    expect(within(dialog).getByText("Or install from a terminal:")).toBeVisible()
    expect(
      within(dialog).getByText(
        "sudo install -m 644 /home/u/Downloads/wirecat_0.2.0_amd64.deb /var/cache/apt/archives/ && sudo apt install /var/cache/apt/archives/wirecat_0.2.0_amd64.deb",
      ),
    ).toBeVisible()
    expect(within(dialog).getAllByRole("button", { name: "Close" })[0]).toHaveFocus()
    expect(download).toHaveBeenCalledWith("0.2.0", expect.any(Function))
    expect(install).not.toHaveBeenCalled()
  })

  it("opens the install command in the user's terminal, says what comes next, and stays open", async () => {
    const command = "sudo dnf install /home/u/Downloads/wirecat-0.2.0-1.x86_64.rpm"
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "rpm" })
    vi.spyOn(platform, "downloadPackageUpdate").mockResolvedValue({
      result: "saved",
      file: "wirecat-0.2.0-1.x86_64.rpm",
      path: "~/Downloads/wirecat-0.2.0-1.x86_64.rpm",
      opened: false,
      command,
    })
    const terminal = vi
      .spyOn(platform, "openPackageTerminal")
      .mockResolvedValueOnce({ started: true, reason: null, message: null })
      .mockResolvedValueOnce({ started: false, reason: "terminal", message: "Could not open a terminal." })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    await user.click(within(dialog).getByRole("button", { name: "Download and install" }))
    expect(await within(dialog).findByText(command)).toBeVisible()

    await user.click(within(dialog).getByRole("button", { name: "Open in terminal" }))
    expect(
      await within(dialog).findByText(/Enter your password there, and restart WireCat when the install ends/),
    ).toBeVisible()
    expect(terminal).toHaveBeenCalledWith()
    expect(screen.getByRole("dialog", { name: "WireCat 0.2.0 is available" })).toBe(dialog)

    await user.click(within(dialog).getByRole("button", { name: "Open in terminal" }))
    expect(await within(dialog).findByText(/No terminal found\. Copy the command/)).toBeVisible()
    expect(within(dialog).getByRole("button", { name: "Copy the command" })).toBeVisible()
  })

  it.each([
    [
      { reason: "offline", detail: "error sending request for url (https://api.github.com/x)" },
      "WireCat could not reach the update server.",
      "Check your internet connection, then try again.",
    ],
    [
      { reason: "server", detail: "Download request failed with status: 429 Too Many Requests" },
      "GitHub, where WireCat keeps its updates, did not answer.",
      "Try again in a few minutes.",
    ],
    [
      { reason: "diskFull", folder: "~/Downloads", detail: "No space left on device (os error 28)" },
      "There is not enough free space in ~/Downloads for the update.",
      "Free some space on this disk",
    ],
    [
      { reason: "notWritable", folder: "~/Downloads", detail: "Permission denied (os error 13)" },
      "WireCat cannot save the update in ~/Downloads.",
      "Make sure the folder exists and you can save files in it",
    ],
    [
      { reason: "newer", version: "0.2.1" },
      "WireCat 0.2.1 is out now.",
      "Close this window and open the update again.",
    ],
  ] as const)("explains a failed package download (%o) and what to do next", async (failure, message, next) => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "deb" })
    vi.spyOn(platform, "downloadPackageUpdate").mockRejectedValue(failure)
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    await user.click(within(dialog).getByRole("button", { name: "Download and install" }))
    const alert = await within(dialog).findByRole("alert")
    expect(alert.querySelector("p")).toHaveTextContent(message)
    expect(alert).toHaveTextContent(next)
    expect(alert.querySelector("p")).not.toHaveTextContent(/https?:|os error/)
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeEnabled()
  })

  it("says plainly when the package fails the signature check", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "rpm" })
    vi.spyOn(platform, "downloadPackageUpdate").mockResolvedValue({ result: "badSignature" })
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    expect(within(dialog).getByText(/\.rpm package \(Fedora, openSUSE\)/)).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "Download and install" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The download did not match WireCat's signature, so it was not opened.",
    )
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeEnabled()
  })

  it("keeps GitHub to the quiet links under the buttons", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue({ ...offer, kind: "deb" })
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
    const github = within(dialog).getAllByText(/GitHub/)
    expect(github).toHaveLength(1)
    expect(github[0]).toHaveTextContent("All releases on GitHub")
    await user.click(within(dialog).getByRole("button", { name: "What's new in 0.2.0" }))
    expect(open).toHaveBeenCalledWith("https://github.com/WireCatLabs/wirecat-desktop/releases/tag/v0.2.0")
  })

  describe("while the app stays open", () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }))
    afterEach(() => vi.useRealTimers())

    it("checks again every 6 hours, and stops when the app closes", async () => {
      const check = vi.spyOn(platform, "checkUpdate").mockResolvedValueOnce(null).mockResolvedValue(offer)
      const { unmount } = render(<App />)
      await waitFor(() => expect(useSystem.getState().readiness).not.toBeNull())
      expect(check).toHaveBeenCalledOnce()
      expect(screen.queryByRole("button", { name: "Update to 0.2.0" })).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS)
      expect(await screen.findByRole("button", { name: "Update to 0.2.0" })).toBeInTheDocument()
      expect(check).toHaveBeenCalledTimes(2)

      unmount()
      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS)
      expect(check).toHaveBeenCalledTimes(2)
    })

    it("does not check or change the offer while an install runs", async () => {
      const check = vi
        .spyOn(platform, "checkUpdate")
        .mockResolvedValueOnce(offer)
        .mockResolvedValue({
          ...offer,
          version: "0.3.0",
        })
      vi.spyOn(platform, "installUpdate").mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()
      render(<App />)

      await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }))
      const dialog = await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })
      await user.click(within(dialog).getByRole("button", { name: "Install and restart" }))
      await within(dialog).findByRole("progressbar", { name: "Downloading the update" })

      await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS)
      expect(check).toHaveBeenCalledOnce()
      expect(screen.getByRole("dialog", { name: "WireCat 0.2.0 is available" })).toBeInTheDocument()
    })
  })

  it("offers the update in the chosen language", async () => {
    vi.spyOn(platform, "checkUpdate").mockResolvedValue(offer)
    useLanguage.setState({ choice: "ru" })
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole("button", { name: "Обновить до 0.2.0" }))
    const dialog = await screen.findByRole("dialog", { name: "Вышел WireCat 0.2.0" })
    expect(within(dialog).getByRole("button", { name: "Установить и перезапустить" })).toBeEnabled()
  })
  describe("from the Help menu", () => {
    const openHelp = async (user: ReturnType<typeof userEvent.setup>) => {
      await waitFor(() => expect(useSystem.getState().readiness).not.toBeNull())
      await user.click(screen.getByRole("button", { name: "Help" }))
    }

    it("checks and says this is the latest version, until the user closes it", async () => {
      let answer = (_: null) => {}
      const check = vi.spyOn(platform, "checkUpdate").mockResolvedValueOnce(null)
      check.mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      const user = userEvent.setup()
      render(<App />)
      await openHelp(user)
      await user.click(screen.getByRole("menuitem", { name: "Check for updates" }))

      const dialog = await screen.findByRole("dialog", { name: "Checking for updates…" })
      expect(within(dialog).getByRole("progressbar", { name: "Checking for updates…" })).toBeInTheDocument()
      answer(null)
      expect(await screen.findByRole("dialog", { name: "WireCat is up to date" })).toHaveTextContent(
        "You have the latest version, 0.0.0-test.",
      )
      const [close] = within(dialog).getAllByRole("button", { name: "Close" })
      await user.click(close as HTMLElement)
      await waitFor(() => expect(useUpdate.getState().open).toBe(false))
    })

    it("says why the check failed, and a second try offers the update in the same window", async () => {
      vi.spyOn(platform, "checkUpdate")
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error("error sending request for url (https://github.com/latest.json)"))
        .mockResolvedValue(offer)
      const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
      const user = userEvent.setup()
      render(<App />)
      await openHelp(user)
      await user.click(screen.getByRole("menuitem", { name: "Check for updates" }))

      const dialog = await screen.findByRole("dialog", { name: "Could not check for updates" })
      expect(within(dialog).getByRole("alert")).toHaveTextContent("WireCat could not reach the update server.")
      await user.click(within(dialog).getByRole("button", { name: "Open the download page" }))
      expect(open).toHaveBeenCalledWith("https://wirecat.dev/en/download")

      await user.click(within(dialog).getByRole("button", { name: "Try again" }))
      expect(await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })).toBe(dialog)
      expect(within(dialog).getByRole("button", { name: "Install and restart" })).toBeEnabled()
    })

    it("names a known update and opens it without checking again", async () => {
      const check = vi.spyOn(platform, "checkUpdate").mockResolvedValue(offer)
      const user = userEvent.setup()
      render(<App />)
      await screen.findByRole("button", { name: "Update to 0.2.0" })
      await openHelp(user)
      await user.click(screen.getByRole("menuitem", { name: "Update to 0.2.0" }))
      expect(await screen.findByRole("dialog", { name: "WireCat 0.2.0 is available" })).toBeInTheDocument()
      expect(check).toHaveBeenCalledOnce()
    })
  })
})
