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

  it("offers Telegram's other way in, and starts it after the running one stops", async () => {
    const dialog = await open("tg", "work")
    send({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: "scan in Telegram" })
    await userEvent.click(within(dialog).getByRole("button", { name: "Use phone number instead" }))
    expect(platform.signInStop).toHaveBeenCalledWith("tg")
    finish()
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenLastCalledWith("tg", "phone", "work", expect.any(Function), {}),
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
    expect(within(dialog).queryByLabelText("The address it ended on")).toBeNull()
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

  it("explains refused app keys and opens the next try with the keys filled in for editing", async () => {
    const dialog = await openTg()
    await userEvent.type(within(dialog).getByLabelText("App api_id"), "123{Enter}")
    send({ event: "needs", field: "api_hash", secret: true, prompt: "App api_hash (not shown)", hint: null })
    await userEvent.type(within(dialog).getByLabelText("App api_hash"), "not-a-real-hash{Enter}")
    expect(JSON.stringify(useSignIn.getState())).not.toContain("not-a-real-hash")

    send({ event: "failed", code: "provider_error", message: "Telegram refused: API_ID_INVALID" })
    const alert = within(dialog).getByRole("alert")
    expect(alert).toHaveTextContent("did not accept the app keys")
    expect(alert).toHaveTextContent("API_ID_INVALID")
    expect(within(dialog).getByRole("button", { name: "Try again" })).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole("button", { name: "Enter the keys again" }))
    await vi.waitFor(() => expect(platform.signIn).toHaveBeenCalledTimes(2))
    send({ event: "openUrl", url: APPS, purpose: null })
    send({ event: "needs", field: "api_id", secret: false, prompt: "App api_id", hint: null })
    expect(within(dialog).getByLabelText("App api_id")).toHaveValue("123")
    await userEvent.type(within(dialog).getByLabelText("App api_id"), "4{Enter}")
    expect(platform.signInAnswer).toHaveBeenLastCalledWith("tg", "1234")
    send({ event: "needs", field: "api_hash", secret: true, prompt: "App api_hash (not shown)", hint: null })
    expect(within(dialog).getByLabelText("App api_hash")).toHaveValue("not-a-real-hash")
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

  it("says beside the two-step password that it is never kept", async () => {
    const dialog = await openTg()
    send({ event: "needs", field: "password", secret: true, prompt: "2FA password (not shown)", hint: null })
    expect(within(dialog).queryByRole("region", { name: "Your own Telegram app keys" })).toBeNull()
    expect(within(dialog).getByText(/never the password itself/)).toBeInTheDocument()
  })
})

describe("signing in to mail", () => {
  it("asks the provider first, then sends the address and app password the steps asked for", async () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("email", "work"))
    const dialog = screen.getByRole("dialog", { name: "Sign in to Email" })
    await userEvent.click(within(dialog).getByRole("radio", { name: /Another mail server/ }))
    expect(within(dialog).getByText(/only the domain, never the whole address/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Type the mail address first.")

    await userEvent.type(within(dialog).getByLabelText("Mail address"), "me@example.com")
    await userEvent.type(within(dialog).getByLabelText("App password"), "abcd efgh")
    await userEvent.click(within(dialog).getByRole("button", { name: "Start sign-in" }))
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenCalledWith("email", "imap", "work", expect.any(Function), {
        address: "me@example.com",
        password: "abcd efgh",
      }),
    )
    expect(JSON.stringify(useSignIn.getState())).not.toContain("abcd efgh")
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
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Эта версия пока не умеет входить здесь.")
  })
})
