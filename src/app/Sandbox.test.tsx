import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SignInDialog } from "@/features/signin"
import { useTerminal } from "@/features/tools"
import { platform } from "@/platform/bridge"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSandbox } from "@/shared/sandbox-store"
import { useSignIn } from "@/shared/signin-store"
import { act, render, screen, within } from "@/testing/render"
import { SandboxBanner, SandboxConfirm } from "./Sandbox"

const WARNING = "This signs your real account into a test copy. Its messages will be downloaded into the copy."

beforeEach(() => {
  useOnboarding.setState({ open: false })
  vi.spyOn(platform, "signIn").mockImplementation(() => new Promise(() => undefined))
  vi.spyOn(platform, "signInStop").mockResolvedValue()
  vi.spyOn(platform, "openSetup").mockResolvedValue({ started: true, reason: null, message: null })
})

afterEach(() => {
  act(() => useSignIn.getState().close())
  useSandbox.setState({ name: null, asking: null })
  vi.restoreAllMocks()
})

describe("a test copy started by bin/sandbox", () => {
  it("says so across the top, and the real app does not", async () => {
    vi.spyOn(platform, "sandbox").mockResolvedValue("demo")
    await act(() => useSandbox.getState().load())
    const { unmount } = render(<SandboxBanner />)
    expect(screen.getByRole("status")).toHaveTextContent("Test copy — demo. Not your real WireCat data.")
    expect(document.title).toBe("WireCat — sandbox demo")
    unmount()

    useSandbox.setState({ name: null })
    render(<SandboxBanner />)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("asks before a sign-in starts, with Cancel focused, and starts only on Sign in anyway", async () => {
    useSandbox.setState({ name: "demo" })
    render(
      <>
        <SignInDialog />
        <SandboxConfirm />
      </>,
    )
    act(() => useSignIn.getState().start("max", "personal"))
    const signin = screen.getByRole("dialog", { name: /Sign in to MAX/ })

    await userEvent.click(within(signin).getByRole("button", { name: "Start sign-in" }))
    const ask = screen.getByRole("dialog", { name: "Sign your real account into a test copy?" })
    expect(ask).toHaveTextContent(WARNING)
    expect(within(ask).getByRole("button", { name: "Cancel" })).toHaveFocus()
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }))
    expect(platform.signIn).not.toHaveBeenCalled()
    expect(useSignIn.getState().phase).toBe("plan")

    await userEvent.click(within(signin).getByRole("button", { name: "Start sign-in" }))
    await userEvent.click(screen.getByRole("button", { name: "Sign in anyway" }))
    await vi.waitFor(() =>
      expect(platform.signIn).toHaveBeenCalledWith("max", "qr", "personal", expect.any(Function), {}),
    )
  })

  it("asks before a terminal sign-in too, and the real app never asks", async () => {
    useSandbox.setState({ name: "demo" })
    const opened = useTerminal.getState().open("tg", "personal")
    await act(() => Promise.resolve())
    expect(useSandbox.getState().asking).not.toBeNull()
    act(() => useSandbox.getState().answer(false))
    await opened
    expect(platform.openSetup).not.toHaveBeenCalled()

    useSandbox.setState({ name: null })
    await useTerminal.getState().open("tg", "personal")
    expect(platform.openSetup).toHaveBeenCalledWith("tg", "personal")
    expect(useSandbox.getState().asking).toBeNull()
  })
})
