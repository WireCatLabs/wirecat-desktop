import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { MOCK_CODES } from "@/platform/mock-qr"
import type { SignInEvent } from "@/platform/signin-schemas"
import { recentErrors } from "@/shared/errors"
import { useOnboarding } from "@/shared/onboarding-store"
import { useReport } from "@/shared/report-store"
import { useSignIn } from "@/shared/signin-store"
import { act, fireEvent, render, screen, within } from "@/testing/render"
import { MOTION } from "@/ui/motion"
import { NewProfile } from "../tools/Health"
import { SignInDialog } from "./SignInDialog"

/** The wizard's step list item that starts with `label`, with its state words. */
const step = (dialog: HTMLElement, label: string) =>
  within(dialog)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "")
    .find((text) => text.startsWith(label)) ?? ""

/** Text drawn in the dialog, not the line read out to a screen reader. */
const STAGE_TEXT = "p:not([role=status])"

const SCAN = "scan in WhatsApp → Settings → Linked devices → Link a device"

/** The copy of a step fading out has gone. */
const settled = () => act(() => new Promise((done) => setTimeout(done, MOTION.swap + 50)))

let send: (e: SignInEvent) => void = () => undefined
let finish: () => void = () => undefined
const pending: (() => void)[] = []

beforeEach(() => {
  useOnboarding.setState({ open: false })
  vi.spyOn(platform, "signIn").mockImplementation((_id, _method, _profile, onEvent) => {
    send = (e) => act(() => onEvent(e))
    return new Promise((resolve) => {
      finish = resolve
      pending.push(resolve)
    })
  })
  vi.spyOn(platform, "signInStop").mockResolvedValue()
  vi.spyOn(platform, "signInAnswer").mockResolvedValue()
})

afterEach(async () => {
  // The next test's run waits for these to end, as the tool runs one sign-in at a time; a run waiting for an earlier one
  // starts once that one ends, so this repeats.
  for (let round = 0; round < 5; round++) {
    for (const end of pending.splice(0)) end()
    await act(() => new Promise((done) => setTimeout(done, 0)))
  }
  vi.restoreAllMocks()
  useReport.getState().close()
})

const wa = findTool("wa")
if (!wa) throw new Error("wa is in the catalog")

function signInForm(onCheck = vi.fn()) {
  render(
    <>
      <NewProfile tool={wa as NonNullable<typeof wa>} onCheck={onCheck} />
      <SignInDialog />
    </>,
  )
  return onCheck
}

async function startAs(name: string) {
  await userEvent.type(screen.getByLabelText(/Account name/), `${name}{Enter}`)
  const dialog = screen.getByRole("dialog", { name: "Sign in to WhatsApp" })
  expect(within(dialog).getByText(/Settings → Linked devices → Link a device/)).toBeInTheDocument()
  expect(platform.signIn).not.toHaveBeenCalled()
  await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
  return dialog
}

describe("signing in to WhatsApp inside the window", () => {
  it("draws each code the tool sends, then its history, and refreshes the accounts when done", async () => {
    const onCheck = signInForm()
    expect(screen.getByRole("button", { name: "Open terminal" })).toBeInTheDocument()
    const dialog = await startAs("personal")

    expect(platform.signIn).toHaveBeenCalledWith("wa", "qr", "personal", expect.any(Function), {})
    send({ event: "note", text: "Before you link: wa is not an official WhatsApp app." })
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })
    const code = within(dialog).getByRole("img", { name: /QR code/ })
    expect(code.tagName.toLowerCase()).toBe("svg")
    const first = code.querySelector("path")?.getAttribute("d")
    expect(within(dialog).getByText(/not an official WhatsApp app/)).toBeInTheDocument()
    expect(within(dialog).getByText(/^Scan in WhatsApp → Settings/)).toBeInTheDocument()

    send({ event: "qr", text: MOCK_CODES[1] ?? "", expiresAt: null, scan: SCAN })
    expect(
      within(dialog)
        .getByRole("img", { name: /QR code/ })
        .querySelector("path")
        ?.getAttribute("d"),
    ).not.toBe(first)

    send({ event: "progress", step: "history", message: null })
    expect(within(dialog).queryByRole("img", { name: /QR code/ })).toBeNull()
    expect(within(dialog).getByText(/Receiving your chat history/)).toBeInTheDocument()

    send({ event: "done", alreadyLinked: false, received: { chats: 4, messages: 1400, people: 2 } })
    expect(within(dialog).getByText(/^WhatsApp is signed in as /)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Open WhatsApp" })).toBeInTheDocument()
    expect(within(dialog).getByText(/Received 4 chats, 1,400 messages and 2 people/)).toBeInTheDocument()
    expect(onCheck).toHaveBeenCalledOnce()
    const done = within(dialog).getByRole("button", { name: "Done" })
    expect(done).toHaveFocus()

    await userEvent.keyboard("{Enter}")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes on Escape at once and stops the tool behind it, refreshing the accounts once it has ended", async () => {
    const onCheck = signInForm()
    const dialog = await startAs("work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })

    // jsdom does not turn Escape into the dialog's cancel event, which the browser does.
    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(platform.signInStop).toHaveBeenCalledWith("wa")
    expect(onCheck).not.toHaveBeenCalled()

    send({ event: "stopped" })
    finish()
    await vi.waitFor(() => expect(onCheck).toHaveBeenCalledOnce())
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes at once while the tool is still starting, and stops the run again once Rust has it", async () => {
    signInForm()
    const dialog = await startAs("personal")
    expect(within(dialog).getByText(/Asking WhatsApp how to sign in/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(platform.signInStop).toHaveBeenCalledTimes(1)

    // The first stop came before Rust registered the run; its first word shows it still runs, so it is stopped again.
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })
    expect(platform.signInStop).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes on Cancel at once too, without waiting for the tool", async () => {
    signInForm()
    const dialog = await startAs("personal")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(platform.signInStop).toHaveBeenCalledWith("wa")
  })

  it("shows the tool's refusal with Report this, and the report carries no code", async () => {
    signInForm()
    const dialog = await startAs("personal")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })
    send({
      event: "failed",
      message: "this WhatsApp login is in use by wa personal serve",
      code: "provider_unavailable",
    })

    const alert = within(dialog).getByRole("alert")
    expect(alert).toHaveTextContent("WhatsApp is busy receiving messages in the background.")
    expect(alert).toHaveTextContent("Stop the background service on WhatsApp's page")
    expect(within(alert).getByRole("button", { name: "Open WhatsApp" })).toBeInTheDocument()
    expect(within(alert).getByRole("button", { name: "Copy the stop command" })).toBeInTheDocument()
    await userEvent.click(within(alert).getByRole("button", { name: "Details" }))
    expect(alert).toHaveTextContent("in use by wa personal serve")
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: /Report this/ }))

    expect(screen.queryByRole("dialog", { name: "Sign in to WhatsApp" })).toBeNull()
    const report = JSON.stringify([useReport.getState().prefill, recentErrors()])
    expect(report).toContain("in use by wa personal serve")
    expect(report).not.toContain("█")
  })

  it("never starts without a valid name the owner typed", async () => {
    signInForm()
    await userEvent.click(screen.getByRole("button", { name: "Sign in here" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Type a name for this account first")
    expect(screen.getByLabelText(/Account name/)).toHaveFocus()
    await userEvent.type(screen.getByLabelText(/Account name/), "-bad{Enter}")
    expect(screen.getByRole("alert")).toHaveTextContent("Use Latin letters, digits")
    expect(platform.signIn).not.toHaveBeenCalled()
  })
})

describe("answering what the tool asks", () => {
  async function open(tool: string, profile = "personal") {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start(tool, profile))
    act(() => useSignIn.getState().begin())
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    return screen.getByRole("dialog")
  }

  it("asks Telegram's questions one at a time, masks the password and keeps no answer", async () => {
    const dialog = await open("tg")
    expect(platform.signIn).toHaveBeenCalledWith("tg", "qr", "personal", expect.any(Function), {})
    send({ event: "openUrl", url: "https://my.telegram.org/apps", purpose: "copy App api_id and App api_hash" })
    expect(within(dialog).getByRole("button", { name: "Open my.telegram.org" })).toBeInTheDocument()

    send({ event: "needs", field: "password", secret: true, prompt: "2FA password (not shown)", hint: "the cat" })
    const field = within(dialog).getByLabelText("2FA password")
    expect(field).toHaveAttribute("type", "password")
    expect(field).toHaveFocus()
    expect(within(dialog).getByText("Hint: the cat")).toBeInTheDocument()

    await userEvent.type(field, "not-a-real-password{Enter}")
    expect(platform.signInAnswer).toHaveBeenCalledWith("tg", "not-a-real-password")
    expect(field).toHaveValue("")
    expect(within(dialog).getByText(/Sent\. Waiting/)).toBeInTheDocument()
    expect(JSON.stringify(useSignIn.getState())).not.toContain("not-a-real-password")

    send({ event: "done", alreadyLinked: false, received: null })
    expect(within(dialog).getByText(/is signed in as personal\./)).toBeInTheDocument()
  })

  it("switches to the phone number in plain sight: heading, steps, the way back, and a wait that says so", async () => {
    const dialog = await open("tg", "work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: "scan in Telegram" })
    expect(within(dialog).getByRole("heading", { name: "Sign in with a QR code" })).toBeInTheDocument()
    const qrPath = within(dialog).getByRole("region", { name: "Sign in with a QR code" })
    expect(within(qrPath).getByText("Scan the QR code")).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: "Use phone number instead" }))
    expect(platform.signInStop).toHaveBeenCalledWith("tg")
    expect(within(dialog).getByRole("heading", { name: "Sign in with your phone number" })).toBeInTheDocument()
    const phonePath = within(dialog).getByRole("region", { name: "Sign in with your phone number" })
    expect(within(phonePath).getByText("Phone number")).toBeInTheDocument()
    expect(within(phonePath).getByText("Code from Telegram")).toBeInTheDocument()
    expect(within(phonePath).getByText("Two-step password, if set")).toBeInTheDocument()
    expect(within(dialog).getByText("Switching to phone sign-in…", { selector: STAGE_TEXT })).toBeInTheDocument()
    expect(within(dialog).queryByRole("img", { name: /QR code/ })).toBeNull()
    expect(within(dialog).getByRole("button", { name: "Use QR code instead" })).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Use phone number instead" })).toBeNull()

    finish()
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenLastCalledWith("tg", "phone", "work", expect.any(Function), {}),
    )
    send({ event: "needs", field: "phone", secret: false, prompt: "phone number, international format", hint: null })
    // Long enough to read, even though tg asked at once.
    expect(within(dialog).getByText("Switching to phone sign-in…", { selector: STAGE_TEXT })).toBeInTheDocument()
    await vi.waitFor(
      () => expect(within(dialog).queryByText("Switching to phone sign-in…", { selector: STAGE_TEXT })).toBeNull(),
      { timeout: MOTION.hold + MOTION.swap + 1000 },
    )
    expect(within(dialog).getByRole("textbox", { name: "Phone number, international format" })).toHaveFocus()

    await userEvent.click(within(dialog).getByRole("button", { name: "Use QR code instead" }))
    expect(within(dialog).getByRole("heading", { name: "Sign in with a QR code" })).toBeInTheDocument()
    expect(within(dialog).getByText("Switching to QR code sign-in…", { selector: STAGE_TEXT })).toBeInTheDocument()
    finish()
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenLastCalledWith("tg", "qr", "work", expect.any(Function), {}),
    )
  })

  it("says the switch failed, and why, when tg cannot start again", async () => {
    const dialog = await open("tg", "work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: "scan in Telegram" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Use phone number instead" }))
    finish()
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalledTimes(2))
    send({ event: "failed", code: null, message: "A Telegram sign-in is still running or stopping." })

    expect(within(dialog).getByText("Could not switch to phone sign-in.")).toBeInTheDocument()
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Telegram could not finish the sign-in.")
    expect(within(dialog).queryByRole("img", { name: /QR code/ })).toBeNull()
    expect(within(dialog).getByRole("button", { name: "Try again" })).toHaveFocus()
  })

  it("lets only digits and a leading plus into the phone number, cleans a paste and refuses a short number", async () => {
    const user = userEvent.setup()
    const dialog = await open("tg")
    send({ event: "needs", field: "phone", secret: false, prompt: "phone number, international format", hint: null })
    const field = within(dialog).getByRole("textbox", { name: "Phone number, international format" })
    expect(within(dialog).getByText(/With \+ and the country code/)).toBeInTheDocument()

    await user.type(field, "+3a4b-6")
    expect(field).toHaveValue("+346")
    await user.keyboard("{Enter}")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("This has 3 digits")
    expect(platform.signInAnswer).not.toHaveBeenCalled()

    await user.clear(field)
    await user.click(field)
    await user.paste("Phone: +34 (612) 345-678")
    expect(field).toHaveValue("+34612345678")
    expect(within(dialog).getByText("Telegram gets +34 612 345 678.")).toBeInTheDocument()
    await user.keyboard("{Enter}")
    expect(platform.signInAnswer).toHaveBeenCalledWith("tg", "+34612345678")
  })

  it("asks for the country code when a number comes without one", async () => {
    const dialog = await open("tg")
    send({ event: "needs", field: "phone", secret: false, prompt: "phone number, international format", hint: null })
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Phone number/ }), "612 345 678{Enter}")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Start with + and the country code")
    expect(platform.signInAnswer).not.toHaveBeenCalled()
  })

  it("says in plain steps what to do when the browser does not come back, and keeps Zoom's page beside them", async () => {
    const user = userEvent.setup()
    const dialog = await open("zm")
    send({
      event: "openUrl",
      url: "https://zoom.us/oauth/authorize?x=1",
      purpose: "Approve access to Zoom in the browser",
    })
    expect(within(dialog).getByText(/Waiting for you to finish in the browser/)).toBeInTheDocument()
    send({
      event: "needs",
      field: "redirect",
      secret: true,
      prompt: "If the browser does not come back by itself, the address it ended on (code=…&state=…)",
      hint: null,
    })
    expect(
      within(dialog).getByText(/it should return to WireCat on its own\. Sometimes it does not/),
    ).toBeInTheDocument()
    expect(within(dialog).queryByText(/code=…&state=…/, { selector: STAGE_TEXT })).toBeNull()
    expect(within(dialog).getByRole("button", { name: "Open zoom.us" })).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Address or code from the browser")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Copy the link to zoom.us" }))
    expect(await navigator.clipboard.readText()).toBe("https://zoom.us/oauth/authorize?x=1")
    expect(within(dialog).getByRole("button", { name: "Copied" })).toBeInTheDocument()

    await user.click(within(dialog).getAllByRole("button", { name: "Try again" })[0] as HTMLElement)
    expect(platform.signInStop).toHaveBeenCalledWith("zm")
    expect(useSignIn.getState().phase).toBe("starting")
    finish()
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalledTimes(2))

    send({ event: "done", alreadyLinked: false, received: null })
    expect(within(dialog).queryByRole("textbox", { name: "Address or code from the browser" })).toBeNull()
  })

  it("lists the steps beside the content; the first goes back to the plan, a later one says why it cannot", async () => {
    const user = userEvent.setup()
    const dialog = await open("zm")
    send({ event: "openUrl", url: "https://zoom.us/oauth/authorize?x=1", purpose: null })
    const locked = within(dialog).getByRole("button", { name: /^Your Zoom app/ })
    await user.click(locked)
    expect(within(dialog).getByText(/already past this step/)).toBeInTheDocument()
    expect(useSignIn.getState().phase).toBe("browser")

    await user.click(within(dialog).getByRole("button", { name: /^Before you start/ }))
    expect(useSignIn.getState().phase).toBe("plan")
    expect(platform.signInStop).toHaveBeenCalledWith("zm")
    expect(within(dialog).getByRole("button", { name: "Start sign-in" })).toBeInTheDocument()
  })

  it("asks for Zoom's Public Client ID when the tool has none, saves it with zm's own config set and starts again", async () => {
    vi.spyOn(platform, "settingsSet").mockResolvedValue()
    const dialog = await open("zm")
    send({ event: "failed", code: "configuration_error", message: "run zm config set zoom.client_id <id> first" })
    finish()
    await userEvent.type(within(dialog).getByLabelText("Public Client ID"), "abcDEF123{Enter}")
    expect(platform.settingsSet).toHaveBeenCalledWith("zm", null, false, "zoom.client_id", "abcDEF123")
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalledTimes(2))
  })

  it("answers Zoom's question for the Public Client ID in the window, beside zm's own checklist", async () => {
    const setup = vi.spyOn(platform, "zoomAppSetup").mockResolvedValue({
      state: "ready",
      setup: {
        marketplaceUrl: "https://marketplace.zoom.us/develop/create",
        guideUrl: "https://wirecat.dev/en/docs/zm/zoom-app",
        appType: "General app",
        management: "User-managed",
        oauth: "Public Client OAuth",
        redirectUrl: "https://example.com/zoom-callback",
        allowList: ["https://example.com/zoom-callback"],
        scopes: [
          { scope: "meeting:read:list_meetings", required: true, purpose: "find your meetings" },
          { scope: "meeting:write:meeting", required: false, purpose: "create a meeting" },
        ],
        configKey: "zoom.client_id",
      },
    })
    const dialog = await open("zm")
    send({ event: "needs", field: "client_id", secret: false, prompt: "Public Client ID of your Zoom app", hint: null })
    expect(setup).toHaveBeenCalledWith("zm")
    await vi.waitFor(() => expect(within(dialog).getByText("https://example.com/zoom-callback")).toBeInTheDocument())
    expect(within(dialog).getByRole("button", { name: "Copy all 1" })).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText("Public Client ID of your Zoom app"), "abcDEF123{Enter}")
    expect(platform.signInAnswer).toHaveBeenCalledWith("zm", "abcDEF123")
  })

  it("links WhatsApp by phone number: the number, then the code to type on the phone", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("wa", "personal", undefined, "phone"))
    const dialog = screen.getByRole("dialog")
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenCalledWith("wa", "phone", "personal", expect.any(Function), {}),
    )
    send({ event: "needs", field: "phone", secret: false, prompt: "phone number, international format", hint: null })
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Phone number/ }), "+34 612 345 678{Enter}")
    expect(platform.signInAnswer).toHaveBeenCalledWith("wa", "+34612345678")
    send({ event: "pairingCode", code: "WCAT-2026", place: "WhatsApp on the phone", expiresAt: null })
    expect(within(dialog).getByText("WCAT-2026")).toBeVisible()
    expect(step(dialog, "Type the code on the phone")).toContain("in progress")
  })

  it("says an older tool must be updated, and offers no field", async () => {
    const dialog = await open("max")
    send({ event: "failed", code: "needs_update", message: "This version cannot sign in here yet." })
    expect(within(dialog).getByRole("alert")).toHaveTextContent("This version of MAX cannot sign in inside WireCat.")
    expect(within(dialog).getByRole("button", { name: "Open MAX to update" })).toBeInTheDocument()
    expect(within(dialog).queryByRole("textbox")).toBeNull()
    const openSetup = vi.spyOn(platform, "openSetup").mockResolvedValue()
    await userEvent.click(within(dialog).getByRole("button", { name: "Open terminal" }))
    expect(openSetup).toHaveBeenCalledWith("max", "personal")
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

const FAKE_HASH = "0123456789abcdef0123456789abcdef"

describe("Telegram's own app keys", () => {
  const APPS = "https://my.telegram.org/apps"

  async function openTg() {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("tg", "personal"))
    const dialog = screen.getByRole("dialog", { name: "Sign in to Telegram" })
    expect(within(dialog).getAllByText("First time only")).toHaveLength(3)
    act(() => useSignIn.getState().begin())
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "openUrl", url: APPS, purpose: "copy App api_id and App api_hash" })
    send({ event: "needs", field: "api_id", secret: false, prompt: "App api_id", hint: null })
    return dialog
  }

  it("shows the steps on my.telegram.org beside the question, with pictures to enlarge and a link to copy", async () => {
    const user = userEvent.setup()
    const dialog = await openTg()
    const guide = within(dialog).getByRole("region", { name: "Your own Telegram app keys" })
    expect(within(guide).getByRole("button", { name: "Open my.telegram.org" })).toBeInTheDocument()
    expect(within(dialog).getByLabelText("App api_id")).toHaveFocus()

    await user.click(within(guide).getByRole("button", { name: "Copy the link to my.telegram.org" }))
    expect(await navigator.clipboard.readText()).toBe(APPS)
    expect(within(guide).getByRole("button", { name: "Copied" })).toBeInTheDocument()

    await user.click(within(guide).getByRole("button", { name: "Enlarge: Where the keys are" }))
    const big = screen.getByRole("dialog", { name: "Where the keys are" })
    expect(within(big).getByRole("img", { name: /Credentials card/ })).toBeInTheDocument()
    fireEvent(big, new Event("cancel", { cancelable: true }))
    expect(screen.queryByRole("dialog", { name: "Where the keys are" })).toBeNull()
    expect(screen.getByRole("dialog", { name: "Sign in to Telegram" })).toBeInTheDocument()
    expect(platform.signInStop).not.toHaveBeenCalled()
  })

  const keyField = (dialog: HTMLElement, name: string) => within(dialog).getByRole("textbox", { name })
  const hashField = (dialog: HTMLElement) => within(dialog).getByLabelText("App api_hash", { selector: "input" })

  async function typeKeys(dialog: HTMLElement, id: string, hash: string) {
    await userEvent.type(keyField(dialog, "App api_id"), `${id}{Enter}`)
    send({ event: "needs", field: "api_hash", secret: true, prompt: "App api_hash (not shown)", hint: null })
    await userEvent.type(hashField(dialog), `${hash}{Enter}`)
  }

  it("explains refused app keys, says what still looks off, and opens the next try on the keys with no other step first", async () => {
    const dialog = await openTg()
    await typeKeys(dialog, "1234", FAKE_HASH)
    expect(JSON.stringify(useSignIn.getState())).not.toContain(FAKE_HASH)

    send({ event: "failed", code: "provider_error", message: "Telegram refused: API_ID_INVALID" })
    finish()
    const alert = within(dialog).getByRole("alert")
    expect(alert).toHaveTextContent("did not accept the app keys")
    expect(alert).toHaveTextContent("API_ID_INVALID")
    expect(alert).toHaveTextContent(/Also check:\s*The api_id has fewer than 5 digits/)
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole("button", { name: "Enter the keys again" }))
    // Before tg says anything, the keys step is already there, waiting: no QR code and no other stage in between.
    expect(keyField(dialog, "App api_id")).toBeDisabled()
    expect(keyField(dialog, "App api_id")).toHaveValue("1234")
    expect(within(dialog).queryByRole("img", { name: /QR code/ })).toBeNull()
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalledTimes(2))
    send({ event: "openUrl", url: APPS, purpose: null })
    send({ event: "needs", field: "api_id", secret: false, prompt: "App api_id", hint: null })
    expect(keyField(dialog, "App api_id")).toBeEnabled()
    await userEvent.type(keyField(dialog, "App api_id"), "5{Enter}")
    expect(platform.signInAnswer).toHaveBeenLastCalledWith("tg", "12345")
    send({ event: "needs", field: "api_hash", secret: true, prompt: "App api_hash (not shown)", hint: null })
    expect(hashField(dialog)).toHaveValue(FAKE_HASH)
  })

  it("refuses keys that cannot be right before sending, and sends them cleaned of labels and spaces", async () => {
    const dialog = await openTg()
    await userEvent.type(keyField(dialog, "App api_id"), "12a45678{Enter}")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("digits only")
    expect(platform.signInAnswer).not.toHaveBeenCalled()
    await userEvent.clear(keyField(dialog, "App api_id"))
    await userEvent.type(keyField(dialog, "App api_id"), " App api_id: 12345678 {Enter}")
    expect(platform.signInAnswer).toHaveBeenLastCalledWith("tg", "12345678")

    send({ event: "needs", field: "api_hash", secret: true, prompt: "App api_hash (not shown)", hint: null })
    await userEvent.type(hashField(dialog), `${FAKE_HASH.slice(1)}{Enter}`)
    expect(within(dialog).getByRole("alert")).toHaveTextContent("This has 31 characters; an api_hash has 32")
    expect(platform.signInAnswer).toHaveBeenCalledOnce()
  })

  it("says how long Telegram asks to wait, and offers only Try again", async () => {
    const dialog = await openTg()
    send({ event: "failed", code: "rate_limited", message: "Telegram asks to wait 420 s before the next request" })
    const alert = within(dialog).getByRole("alert")
    expect(alert).toHaveTextContent("wait 7 min before the next try")
    expect(within(alert).queryByRole("button", { name: /again/ })).toBeNull()
    expect(within(dialog).getByRole("button", { name: "Try again" })).toHaveFocus()
  })

  it("offers a new code when the code expired", async () => {
    const dialog = await openTg()
    send({ event: "failed", code: "provider_error", message: "Telegram refused: PHONE_CODE_EXPIRED" })
    expect(within(within(dialog).getByRole("alert")).getByRole("button", { name: "Get a new code" })).toBeEnabled()
  })

  it("says calmly that the sign-in went to a file when there is no keyring, with the error folded away", async () => {
    const dialog = await openTg()
    send({
      event: "note",
      text: "could not reach the OS keyring — it may be locked (Platform failure: DBus error: no secrets); using ~/.config/tg-cli/credentials.json instead, readable only by you",
    })
    const note = within(dialog).getByRole("note")
    expect(within(note).getByText("~/.config/tg-cli/credentials.json").tagName.toLowerCase()).toBe("code")
    expect(within(dialog).queryByRole("alert")).toBeNull()
    const details = within(note).getByRole("button", { name: "Details" })
    expect(details).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(details)
    expect(details).toHaveAttribute("aria-expanded", "true")
    expect(within(note).getByText(/DBus error: no secrets/)).toBeInTheDocument()
  })

  it("says beside the two-step password that it is never kept, however tg words the question", async () => {
    const dialog = await openTg()
    send({ event: "needs", field: "password", secret: true, prompt: "2FA password (not shown)", hint: null })
    expect(within(dialog).queryByRole("region", { name: "Your own Telegram app keys" })).toBeNull()
    expect(within(dialog).getByText(/never the password itself/)).toBeVisible()
    send({ event: "needs", field: "secret", secret: true, prompt: "two-step verification password", hint: null })
    expect(within(dialog).getAllByText(/never the password itself/).length).toBeGreaterThan(0)
  })

  it("switches to the phone number on the keys step without asking the keys typed so far again", async () => {
    const dialog = await openTg()
    await userEvent.type(keyField(dialog, "App api_id"), "12345678{Enter}")
    send({ event: "needs", field: "api_hash", secret: true, prompt: "App api_hash (not shown)", hint: null })
    await userEvent.click(within(dialog).getByRole("button", { name: "Use phone number instead" }))
    expect(platform.signInStop).toHaveBeenCalledWith("tg")
    expect(within(dialog).getByRole("region", { name: "Your own Telegram app keys" })).toBeInTheDocument()
    expect(within(dialog).getByText(/After the keys: your phone number/)).toBeInTheDocument()
    finish()
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenLastCalledWith("tg", "phone", "personal", expect.any(Function), {}),
    )

    send({ event: "openUrl", url: APPS, purpose: null })
    send({ event: "needs", field: "api_id", secret: false, prompt: "App api_id", hint: null })
    expect(platform.signInAnswer).toHaveBeenLastCalledWith("tg", "12345678")
    send({ event: "needs", field: "api_hash", secret: true, prompt: "App api_hash (not shown)", hint: null })
    await userEvent.type(hashField(dialog), `${FAKE_HASH}{Enter}`)
    expect(platform.signInAnswer).toHaveBeenLastCalledWith("tg", FAKE_HASH)

    send({ event: "needs", field: "phone", secret: false, prompt: "phone number, international format", hint: null })
    await userEvent.type(keyField(dialog, "Phone number, international format"), "+34600000000{Enter}")
    send({ event: "note", text: "Telegram sent a login code (app)" })
    send({ event: "needs", field: "code", secret: false, prompt: "login code", hint: null })
    expect(within(dialog).getByText("Telegram sent the code as a message in your Telegram app.")).toBeInTheDocument()
    await userEvent.type(keyField(dialog, "Login code"), "11111{Enter}")
    send({ event: "note", text: "that code was not accepted — try again" })
    send({ event: "needs", field: "code", secret: false, prompt: "login code", hint: null })
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Telegram did not accept that code")
    expect(within(dialog).queryByText(/Telegram sent a login code/)).toBeNull()

    send({ event: "done", alreadyLinked: false, received: null })
    expect(within(dialog).getByText(/is signed in as personal\./)).toBeInTheDocument()
  })
})

describe("Telegram's QR code", () => {
  const scan = "scan in Telegram → Settings → Devices → Link Desktop Device"

  async function scanStage(expiresAt: string | null) {
    localStorage.clear()
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("tg", "personal"))
    act(() => useSignIn.getState().begin())
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt, scan })
    return screen.getByRole("dialog", { name: "Sign in to Telegram" })
  }

  it("says where the scanner is on Android, with a picture, and on iPhone, and remembers the phone", async () => {
    const dialog = await scanStage(new Date(Date.now() + 30_000).toISOString())
    const android = within(dialog).getByRole("radio", { name: "Android" })
    expect(android).toBeChecked()
    expect(within(dialog).getByText("Press Add Device.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Enlarge: Devices in Telegram for Android" })).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("radio", { name: "iPhone" }))
    expect(within(dialog).getByText("Press Link Desktop Device.")).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /Enlarge/ })).toBeNull()
    expect(localStorage.getItem("wirecat.signin.phone")).toBe("iphone")
  })

  it("says Telegram took the scan as soon as tg says anything after the code", async () => {
    const dialog = await scanStage(new Date(Date.now() + 30_000).toISOString())
    expect(within(dialog).queryByText(/accepted the scan/)).toBeNull()
    send({ event: "progress", step: "scanned", message: "scan accepted" })
    expect(within(dialog).getByText("Telegram accepted the scan. Finishing the sign-in…")).toBeInTheDocument()
    expect(within(dialog).getByRole("img", { name: /QR code/ })).toBeInTheDocument()
  })

  it("waits for Telegram, counting, when the code expired and no new one came", async () => {
    const dialog = await scanStage(new Date(Date.now() - 5000).toISOString())
    expect(within(dialog).getByText("Waiting for Telegram…")).toBeInTheDocument()
    expect(within(dialog).queryByText(/a new one is on its way/)).toBeNull()
    send({ event: "needs", field: "password", secret: true, prompt: "2FA password (not shown)", hint: null })
    expect(within(dialog).getByLabelText("2FA password", { selector: "input" })).toHaveFocus()
  })
})

describe("signing in to mail", () => {
  it("asks the provider first, then the app password in the window, and a new try keeps the address but never it", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("email", "work"))
    const dialog = screen.getByRole("dialog", { name: "Sign in to Email" })
    await userEvent.click(within(dialog).getByRole("radio", { name: /Another mail server/ }))
    // The steps of the provider left behind fade out over the new ones for a moment.
    await vi.waitFor(() =>
      expect(within(dialog).getAllByText(/only the domain, never the whole address/)).toHaveLength(1),
    )
    expect(within(dialog).queryByLabelText("App password")).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText("Mail address"), "me@example.com")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenCalledWith("email", "imap", "work", expect.any(Function), {
        address: "me@example.com",
      }),
    )
    for (const text of [
      "Server: imap.example.com:993 (tls), login [email]",
      "Prepare the example.com mailbox first:",
      "  1. Open https://mail.example.com/settings and turn on IMAP.",
      "  2. Make an app password. The help page does not list the labels of that screen, so none are quoted here.",
      "  Note: A new password works after a minute.",
      "  Sources: https://help.example.com/imap",
      "  All providers: https://github.com/WireCatLabs/mail-cli/blob/main/docs/providers.md",
    ])
      send({ event: "note", text })
    const page = "https://yandex.ru/support/id/ru/authorization/app-passwords"
    send({
      event: "needs",
      field: "password",
      secret: true,
      prompt: "App password for me@example.com",
      hint: `Yandex takes an app password, not your account password. How to make one: ${page}`,
    })
    const prepare = within(dialog).getByRole("heading", { name: "Before the password" }).closest("section")
    if (!prepare) throw new Error("the prepare steps are a section")
    expect(
      within(prepare)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringMatching(/^1Open mail\.example\.com\/settings.*and turn on IMAP\.$/),
      "2Make an app password.",
    ])
    expect(within(prepare).getByText("A new password works after a minute.")).toBeVisible()
    expect(dialog).not.toHaveTextContent(/Sources|All providers|Prepare the|imap\.example\.com:993/)
    expect(within(dialog).getByText("Not your account password", { exact: false })).toBeVisible()
    const field = within(dialog).getByLabelText("App password for me@example.com")
    expect(field).toHaveAttribute("type", "password")
    await userEvent.type(field, "abcd efgh{Enter}")
    expect(platform.signInAnswer).toHaveBeenCalledWith("email", "abcd efgh")

    send({ event: "failed", code: "authentication_error", reason: "mail.login-refused", message: "refused" })
    expect(within(dialog).getByRole("alert")).toHaveTextContent("The mail server refused the login.")
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    await userEvent.click(within(dialog).getByRole("button", { name: "Make an app password" }))
    expect(open).toHaveBeenCalledWith(page)
    expect(JSON.stringify(useSignIn.getState())).not.toContain("abcd efgh")
    await userEvent.click(within(dialog).getByRole("button", { name: "Try again" }))
    expect(within(dialog).getByLabelText("Mail address")).toHaveValue("me@example.com")
  })

  it("walks Gmail's app password on one step, answers the tool from it, and comes back there when Gmail refuses", async () => {
    const open = vi.spyOn(platform, "openUrl").mockResolvedValue()
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("email", "work"))
    const dialog = screen.getByRole("dialog")
    await userEvent.click(within(dialog).getByRole("radio", { name: /^Gmail/ }))
    await settled()
    expect(within(dialog).getByRole("radio", { name: /App password.*Recommended/ })).toBeChecked()
    expect(within(dialog).getByRole("radio", { name: /Sign in with Google/ })).not.toBeChecked()
    await userEvent.type(within(dialog).getByLabelText("Mail address"), "me@gmail.com")
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    await settled()
    expect(platform.signIn).not.toHaveBeenCalled()

    expect(await within(dialog).findByText(/Not your Google password/)).toBeVisible()
    expect(step(dialog, "Your app password")).toContain("in progress")
    const field = within(dialog).getByLabelText("App password", { selector: "input" })
    expect(field).toHaveFocus()
    await userEvent.click(within(dialog).getByRole("button", { name: "Open Google app passwords" }))
    expect(open).toHaveBeenCalledWith("https://myaccount.google.com/apppasswords")
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign in" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Paste the app password first.")

    await userEvent.type(field, "abcd efgh ijkl mnop{Enter}")
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenCalledWith("email", "gmail", "work", expect.any(Function), {
        address: "me@gmail.com",
      }),
    )
    send({ event: "note", text: "Prepare the Gmail mailbox first:" })
    send({ event: "needs", field: "password", secret: true, prompt: "App password for me@gmail.com", hint: null })
    expect(platform.signInAnswer).toHaveBeenCalledWith("email", "abcdefghijklmnop")
    expect(within(dialog).queryByLabelText("App password for me@gmail.com")).not.toBeInTheDocument()

    send({
      event: "failed",
      code: "authentication_error",
      reason: "mail.app-password-required",
      message: "the server asks for an app password",
    })
    await settled()
    await vi.waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Gmail did not take that password: it needs an app password.",
      ),
    )
    const again = within(dialog).getByLabelText("App password", { selector: "input" })
    expect(again).toHaveValue("")
    expect(again).toHaveFocus()
    expect(JSON.stringify(useSignIn.getState())).not.toContain("abcd")
  })

  it("takes the owner's own Google client as typed ID and secret, sent as a client file", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("email", "work", undefined, undefined))
    act(() => useSignIn.setState({ method: "gmail" }))
    await settled()
    const dialog = screen.getByRole("dialog")
    await userEvent.click(within(dialog).getByRole("radio", { name: /Sign in with Google/ }))
    await settled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose the client file, or type the client ID and secret.",
    )
    expect(within(dialog).getByRole("button", { name: "Choose the client file" })).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Enter client ID and secret" }))
    await userEvent.type(within(dialog).getByLabelText("Client ID"), "12-abc")
    expect(within(dialog).getByText(/This is not a Google client ID/)).toBeVisible()
    await userEvent.type(within(dialog).getByLabelText("Client ID"), ".apps.googleusercontent.com")
    await userEvent.type(within(dialog).getByLabelText("Client secret", { selector: "input" }), "fake-secret")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    const inputs = vi.mocked(platform.signIn).mock.calls[0]?.[4]
    expect(JSON.parse(inputs?.clientFile ?? "")).toEqual({
      installed: { client_id: "12-abc.apps.googleusercontent.com", client_secret: "fake-secret" },
    })
    expect(JSON.stringify(useSignIn.getState())).not.toContain("fake-secret")
  })

  it("asks the server only when the tool found none, and lets a port stay empty", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("email", "work", undefined, "imap"))
    const dialog = screen.getByRole("dialog")
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "needs", field: "imap_port", secret: false, prompt: "IMAP port", hint: null })
    expect(within(dialog).getByText("Leave empty for 993.")).toBeVisible()
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    expect(platform.signInAnswer).toHaveBeenCalledWith("email", "")
  })

  it("saves the owner's own Microsoft app for the profile before the browser opens", async () => {
    const saved = vi.spyOn(platform, "settingsSet").mockResolvedValue()
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("email", "work"))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("radio", { name: /Microsoft/ })).toBeChecked()
    expect(within(dialog).queryByLabelText("App password")).not.toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText("Mail address"), "me@outlook.com")
    await userEvent.click(within(dialog).getByRole("button", { name: "Use my own app" }))
    await userEvent.type(within(dialog).getByLabelText("Application (client) ID"), "1111-2222")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    expect(saved).toHaveBeenCalledWith("email", "work", false, "microsoft_client_id", "1111-2222")
    expect(platform.signIn).toHaveBeenCalledWith("email", "microsoft", "work", expect.any(Function), {
      address: "me@outlook.com",
    })
  })
})

describe("in Russian", () => {
  it("names the dialog and counts what came from the phone in Russian forms", async () => {
    useLanguage.setState({ choice: "ru" })
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("wa", "personal"))
    act(() => useSignIn.getState().begin())
    const dialog = await screen.findByRole("dialog", { name: "Вход в WhatsApp" })
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())

    send({ event: "done", alreadyLinked: false, received: { chats: 4, messages: 21, people: 5 } })
    expect(within(dialog).getByText("Получено с телефона: 4 чата, 21 сообщение и 5 человек.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Готово" })).toBeInTheDocument()
  })

  it("translates a failure the tool reports with a code", async () => {
    useLanguage.setState({ choice: "ru" })
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("max", "personal"))
    act(() => useSignIn.getState().begin())
    const dialog = await screen.findByRole("dialog")
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "failed", code: "needs_update", message: "This version cannot sign in here yet." })
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Эта версия MAX не умеет входить внутри WireCat.")
  })
})

describe("the setup wizard every tool shares", () => {
  async function plan(tool: string) {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start(tool, "personal"))
    return screen.getByRole("dialog")
  }

  it("QR code: says what to have at hand, lights each step, and offers the first sync at the end", async () => {
    const syncRun = vi.spyOn(platform, "syncRun").mockResolvedValue()
    const dialog = await plan("max")
    expect(within(dialog).getByText("Have at hand")).toBeInTheDocument()
    expect(within(dialog).getByText("Your phone with the MAX app on it.")).toBeInTheDocument()
    expect(step(dialog, "Before you start")).toContain("in progress")

    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: "scan in the MAX app" })
    expect(step(dialog, "Before you start")).toContain("done")
    expect(step(dialog, "Scan the QR code")).toContain("in progress")
    send({ event: "needs", field: "password", secret: true, prompt: "MAX password", hint: null })
    expect(step(dialog, "Two-step password, if set")).toContain("in progress")
    send({ event: "done", alreadyLinked: false, received: null })
    expect(step(dialog, "Done")).toContain("done")

    await userEvent.click(within(dialog).getByRole("button", { name: "Sync now" }))
    expect(syncRun).toHaveBeenCalledWith("max", "personal", expect.any(Function))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("token: switches to MAX's token, shows where web.max.ru keeps it, and sends only the token", async () => {
    const dialog = await plan("max")
    await userEvent.click(within(dialog).getByRole("button", { name: "Use token instead" }))
    expect(within(dialog).getAllByText("Sign in with a token")[0]).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenCalledWith("max", "token", "personal", expect.any(Function), {}),
    )
    send({ event: "needs", field: "token", secret: true, prompt: "MAX token", hint: null })
    expect(step(dialog, "Paste the token")).toContain("in progress")
    expect(within(dialog).getByText(/Find the key __oneme_auth/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText("MAX token"), {
      target: { value: '{"token":"t0k3n","viewerId":1}' },
    })
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    expect(platform.signInAnswer).toHaveBeenCalledWith("max", "t0k3n")
  })

  it("browser: lights the browser step, and explains a declined page with the step it failed on", async () => {
    const dialog = await plan("drive")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "openUrl", url: "https://accounts.google.com/o/oauth2/v2/auth?x=1", purpose: null })
    expect(step(dialog, "Approve in the browser")).toContain("in progress")
    send({ event: "failed", code: "authentication_error", message: "access_denied" })
    expect(step(dialog, "Approve in the browser")).toContain("failed")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Access was not allowed.")
    expect(within(dialog).getByRole("button", { name: "Try again" })).toHaveFocus()
  })

  it("Zoom app: a checklist with each value to copy, the Public Client ID, and transcript files as the way without an app", async () => {
    const set = vi.spyOn(platform, "settingsSet").mockResolvedValue()
    const dialog = await plan("zm")
    expect(within(dialog).getByText("Your Zoom app, the first time")).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "failed", code: "configuration_error", message: "run zm config set zoom.client_id <id> first" })
    expect(step(dialog, "Your Zoom app, the first time")).toContain("in progress")
    expect(within(dialog).getByText("https://wirecat.dev/zoom-callback")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Copy meeting:read:summary" })).toBeInTheDocument()
    await userEvent.click(within(dialog).getByLabelText(/Name it, for example/))
    expect(within(dialog).getByText("1 of 7 done")).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: /No Zoom app\?/ }))
    await userEvent.type(within(dialog).getByLabelText("Folder with the .vtt files"), "/home/me/Zoom")
    await userEvent.click(within(dialog).getByRole("button", { name: "Use these files" }))
    expect(set).toHaveBeenCalledWith("zm", null, false, "files.folder", "/home/me/Zoom")
    expect(set).toHaveBeenCalledWith("zm", null, false, "source", "files")
    expect(await within(dialog).findByText(/Zoom now reads transcripts from \/home\/me\/Zoom/)).toBeInTheDocument()
  })
})

describe("going back inside the dialog", () => {
  it("email: the browser step has Back, which stops the run and keeps the typed address", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("email", "work"))
    useSignIn.setState({ address: "me@outlook.com" })
    act(() => useSignIn.getState().start("email", "work", undefined, "microsoft"))
    const dialog = screen.getByRole("dialog", { name: "Sign in to Email" })
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "openUrl", url: "https://login.microsoftonline.com/x", purpose: null })
    await userEvent.click(within(dialog).getByRole("button", { name: "Back" }))
    expect(platform.signInStop).toHaveBeenCalledWith("email")
    expect(useSignIn.getState().phase).toBe("plan")
    await settled()
    expect(within(dialog).getByLabelText("Mail address")).toHaveValue("me@outlook.com")
    expect(within(dialog).queryByRole("button", { name: "Back" })).not.toBeInTheDocument()
  })

  it("Zoom: the app checklist has Back to the plan", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("zm", "personal"))
    const dialog = screen.getByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "failed", code: "configuration_error", message: "run zm config set zoom.client_id <id> first" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Back" }))
    expect(useSignIn.getState().phase).toBe("plan")
  })

  it("WhatsApp: Back stays in place but is off while the history arrives, and says why", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("wa", "personal"))
    const dialog = screen.getByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalled())
    send({ event: "progress", step: "history", message: null })
    const back = within(dialog).getByRole("button", { name: "Back" })
    expect(back).toHaveAttribute("aria-disabled", "true")
    expect(back).toHaveAccessibleDescription(/chat history is arriving/)
    await userEvent.click(back)
    expect(useSignIn.getState().phase).toBe("progress")
  })
})
