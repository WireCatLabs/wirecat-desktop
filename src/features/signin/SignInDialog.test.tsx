import { act, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { findTool } from "@/domain/catalog"
import { useLanguage } from "@/i18n"
import { platform } from "@/platform/bridge"
import { MOCK_CODES } from "@/platform/mock-qr"
import type { SignInEvent } from "@/platform/signin-schemas"
import { useOnboarding } from "../onboarding/store"
import { recentErrors } from "../report/errors"
import { useReport } from "../report/store"
import { NewProfile } from "../tools/Health"
import { SignInDialog } from "./SignInDialog"
import { useSignIn } from "./store"

const SCAN = "scan in WhatsApp → Settings → Linked devices → Link a device"

let send: (e: SignInEvent) => void = () => undefined
let finish: () => void = () => undefined

beforeEach(() => {
  useOnboarding.setState({ open: false })
  useSignIn.setState(useSignIn.getInitialState(), true)
  vi.spyOn(platform, "signIn").mockImplementation((_id, _method, _profile, onEvent) => {
    send = (e) => act(() => onEvent(e))
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  vi.spyOn(platform, "signInStop").mockResolvedValue()
  vi.spyOn(platform, "signInAnswer").mockResolvedValue()
})

afterEach(() => {
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

    expect(platform.signIn).toHaveBeenCalledWith("wa", "qr", "personal", expect.any(Function))
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

  it("asks the tool to stop on Escape and closes once it has stopped", async () => {
    signInForm()
    const dialog = await startAs("work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: SCAN })

    // jsdom does not turn Escape into the dialog's cancel event, which the browser does.
    fireEvent(dialog, new Event("cancel", { cancelable: true }))
    expect(platform.signInStop).toHaveBeenCalledWith("wa")
    expect(within(dialog).getByRole("button", { name: "Stopping…" })).toBeDisabled()

    send({ event: "stopped" })
    finish()
    expect(screen.queryByRole("dialog")).toBeNull()
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

    expect(within(dialog).getByRole("alert")).toHaveTextContent("in use by wa personal serve")
    expect(within(dialog).getByRole("button", { name: "Try again" })).toHaveFocus()
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
    expect(screen.getByRole("alert")).toHaveTextContent("Use letters, digits")
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
    expect(platform.signIn).toHaveBeenCalledWith("tg", "qr", "personal", expect.any(Function))
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

  it("offers Telegram's other way in, and starts it after the running one stops", async () => {
    const dialog = await open("tg", "work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: "scan in Telegram" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Use phone number instead" }))
    expect(platform.signInStop).toHaveBeenCalledWith("tg")
    finish()
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenLastCalledWith("tg", "phone", "work", expect.any(Function)),
    )
  })

  it("keeps Zoom's page beside the pasted-address fallback, and drops the question when the browser answers", async () => {
    const dialog = await open("zm")
    send({
      event: "openUrl",
      url: "https://zoom.us/oauth/authorize?x=1",
      purpose: "Approve access to Zoom in the browser",
    })
    expect(within(dialog).getByText(/Waiting for you to finish in the browser/)).toBeInTheDocument()
    send({ event: "needs", field: "redirect", secret: true, prompt: "the address it ended on", hint: null })
    expect(within(dialog).getByRole("button", { name: "Open zoom.us" })).toBeInTheDocument()
    expect(within(dialog).getByLabelText("The address it ended on")).toBeInTheDocument()

    send({ event: "done", alreadyLinked: false, received: null })
    expect(within(dialog).queryByRole("textbox", { name: "The address it ended on" })).toBeNull()
  })

  it("asks for Zoom's Public Client ID when the tool has none, saves it with zm's own config set and starts again", async () => {
    vi.spyOn(platform, "settingsSet").mockResolvedValue()
    const dialog = await open("zm")
    send({ event: "failed", code: "configuration_error", message: "run zm config set zoom.client_id <id> first" })
    await userEvent.type(within(dialog).getByLabelText("Public Client ID"), "abcDEF123{Enter}")
    expect(platform.settingsSet).toHaveBeenCalledWith("zm", null, false, "zoom.client_id", "abcDEF123")
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalledTimes(2))
  })

  it("says an older tool must be updated, and offers no field", async () => {
    const dialog = await open("max")
    send({ event: "failed", code: "needs_update", message: "This version cannot sign in here yet." })
    expect(within(dialog).getByRole("alert")).toHaveTextContent("cannot sign in here yet")
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
      expect(platform.signIn).toHaveBeenLastCalledWith("tg", "phone", "personal", expect.any(Function)),
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
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Эта версия пока не умеет входить здесь.")
  })
})
