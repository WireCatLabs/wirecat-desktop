import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { portalHost, webhookPage, webhookParts, webhookProblem } from "@/domain/bitrix-signin"
import { platform } from "@/platform/bridge"
import type { SignInEvent, SignInInputs } from "@/platform/signin-schemas"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSignIn } from "@/shared/signin-store"
import { act, render, screen, within } from "@/testing/render"
import { MOTION } from "@/ui/motion"
import { SignInDialog } from "./SignInDialog"

const HOOK = "https://acme.bitrix24.ru/rest/12/s3cr3tk3y/"
const settled = () => act(() => new Promise((done) => setTimeout(done, MOTION.swap + 50)))

describe("the portal and the webhook, read in the window", () => {
  it("keeps only the portal's host from what is typed", () => {
    expect(portalHost("Acme.Bitrix24.ru")).toBe("acme.bitrix24.ru")
    expect(portalHost("https://acme.bitrix24.ru/crm/deal/list/?x=1")).toBe("acme.bitrix24.ru")
    expect(portalHost("crm.example.com:8443")).toBe("crm.example.com")
    for (const bad of ["", "acme", "acme bitrix24.ru", "http://", "1.2.3.4", "-acme.ru"])
      expect(portalHost(bad)).toBeNull()
  })

  it("links to the portal's own Developer resources", () => {
    expect(webhookPage("acme.bitrix24.ru")).toBe("https://acme.bitrix24.ru/devops/")
  })

  it("reads the portal and the employee from a webhook, never more", () => {
    expect(webhookParts(` ${HOOK}crm.deal.list.json`)).toEqual({ host: "acme.bitrix24.ru", user: "12" })
    expect(webhookParts("https://acme.bitrix24.ru/rest/api/7/key/")).toEqual({ host: "acme.bitrix24.ru", user: "7" })
    for (const bad of ["http://acme.bitrix24.ru/rest/12/k/", "https://acme.bitrix24.ru/rest/x/k/", `${HOOK}?a=1`, "no"])
      expect(webhookParts(bad)).toBeNull()
  })

  it("names b24's refusals by their reason first", () => {
    const of = (reason: string | null, message = "x", code: string | null = null) =>
      webhookProblem({ message, code, reason })?.kind ?? null
    expect(of("webhook.scope-missing")).toBe("scope")
    expect(of(null, "this webhook has no user scope for user.current (INSUFFICIENT_SCOPE); add it in Bitrix24")).toBe(
      "scope",
    )
    expect(of("webhook.malformed")).toBe("malformed")
    expect(of("webhook.refused")).toBe("refused")
    expect(of(null, "getaddrinfo ENOTFOUND acme.bitrix24.ru", "network_error")).toBe("unreachable")
    expect(of("command.timed-out")).toBeNull()
    expect(
      webhookProblem({
        message: "profile work already uses this webhook (acme)",
        code: "conflict",
        reason: "session.duplicate",
      }),
    ).toMatchObject({ kind: "duplicate", profile: "work" })
  })
})

describe("Bitrix24's sign-in wizard", () => {
  let send: (e: SignInEvent) => void = () => undefined
  const pending: (() => void)[] = []

  beforeEach(() => {
    useOnboarding.setState({ open: false })
    vi.spyOn(platform, "signIn").mockImplementation((_id, _method, _profile, onEvent) => {
      send = (e) => act(() => onEvent(e))
      return new Promise((resolve) => pending.push(resolve))
    })
    vi.spyOn(platform, "signInStop").mockResolvedValue()
    vi.spyOn(platform, "signInOnPortal").mockResolvedValue([])
  })

  afterEach(async () => {
    for (let round = 0; round < 5; round++) {
      for (const end of pending.splice(0)) end()
      await act(() => new Promise((done) => setTimeout(done, 0)))
    }
    act(() => useSignIn.getState().close())
    vi.restoreAllMocks()
  })

  const open = () => {
    render(<SignInDialog />)
    act(() => useSignIn.getState().start("bitrix", "work"))
    return screen.getByRole("dialog", { name: "Sign in to Bitrix24" })
  }

  const toPaste = async (dialog: HTMLElement) => {
    await userEvent.type(within(dialog).getByLabelText("Portal address"), "https://acme.bitrix24.ru/crm/")
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    await settled()
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    await settled()
  }

  it("asks the portal first and says what is missing at the field", async () => {
    const dialog = open()
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    const field = within(dialog).getByLabelText("Portal address")
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter your portal's address")
    expect(field).toHaveFocus()
  })

  it("leads to the portal's own webhook page with the rights to tick, then signs in with the webhook on stdin", async () => {
    const dialog = open()
    await userEvent.type(within(dialog).getByLabelText("Portal address"), "https://acme.bitrix24.ru/crm/")
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    await settled()
    expect(within(dialog).getByText("Open Developer resources on acme.bitrix24.ru.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Open Developer resources" })).toBeInTheDocument()
    for (const code of ["crm", "user_basic", "department"])
      expect(within(dialog).getByRole("button", { name: `Copy ${code}` })).toBeInTheDocument()
    expect(within(dialog).getByText(/Only a webhook made by a portal administrator/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }))
    await settled()
    await userEvent.type(within(dialog).getByLabelText("Webhook address"), HOOK)
    await userEvent.click(within(dialog).getByRole("button", { name: "Check and sign in" }))
    expect(platform.signInOnPortal).toHaveBeenCalledWith("bitrix", "acme.bitrix24.ru")
    const [, method, profile, , inputs] = vi.mocked(platform.signIn).mock.calls[0] ?? []
    expect([method, profile, (inputs as SignInInputs).password]).toEqual(["webhook", "work", HOOK])
    expect(within(dialog).getByText("Checking the webhook with acme.bitrix24.ru…")).toBeInTheDocument()

    send({ event: "done", alreadyLinked: false, received: null })
    await settled()
    expect(within(dialog).getByText("Bitrix24 is signed in as work.")).toBeInTheDocument()
  })

  it("refuses a webhook another profile already holds, naming it, before anything runs", async () => {
    vi.mocked(platform.signInOnPortal).mockResolvedValue([
      { profile: "work", user: "99" },
      { profile: "sales", user: "12" },
    ])
    const dialog = open()
    await toPaste(dialog)
    await userEvent.type(within(dialog).getByLabelText("Webhook address"), HOOK)
    await userEvent.click(within(dialog).getByRole("button", { name: "Check and sign in" }))
    expect(within(dialog).getByText("Profile sales already uses this webhook.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Manage sales" })).toBeInTheDocument()
    expect(platform.signIn).not.toHaveBeenCalled()
  })

  it("refuses a webhook of another portal and offers to use that portal", async () => {
    const dialog = open()
    await toPaste(dialog)
    await userEvent.type(within(dialog).getByLabelText("Webhook address"), "https://other.bitrix24.ru/rest/1/k/")
    await userEvent.click(within(dialog).getByRole("button", { name: "Check and sign in" }))
    expect(within(dialog).getByText("This webhook is for other.bitrix24.ru, not acme.bitrix24.ru.")).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Use other.bitrix24.ru" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Check and sign in" }))
    expect(platform.signIn).toHaveBeenCalled()
  })

  it("brings a missing right back to the paste step, with the address kept and the box to tick named", async () => {
    const dialog = open()
    await toPaste(dialog)
    await userEvent.type(within(dialog).getByLabelText("Webhook address"), HOOK)
    await userEvent.click(within(dialog).getByRole("button", { name: "Check and sign in" }))
    send({
      event: "failed",
      code: "permission_error",
      reason: "webhook.scope-missing",
      message: "this webhook has no user scope for user.current (INSUFFICIENT_SCOPE); add it in Bitrix24",
    })
    await settled()
    expect(within(dialog).getByText("The webhook may not read who made it.")).toBeInTheDocument()
    expect(within(dialog).getByText(/tick Users \(basic\), user_basic/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Webhook address")).toHaveValue(HOOK)
    await userEvent.click(within(dialog).getByRole("button", { name: "Check again" }))
    expect(platform.signIn).toHaveBeenCalledTimes(2)
  })
})
