import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "@/app/App"
import { useOnboarding } from "@/shared/onboarding-store"
import { render, waitFor } from "@/testing/render"
import { HOME_SECTION, useNav } from "./nav"

afterEach(() => {
  localStorage.clear()
  vi.resetModules()
})

describe("the page a restart opens", () => {
  it("is saved on every move and read back by the next start", async () => {
    useNav.getState().go("logs")
    expect(localStorage.getItem("wirecat.page")).toBe("logs")
    vi.resetModules()
    const again = await import("./nav")
    expect(again.useNav.getState().active).toBe("logs")
  })

  it("falls back to Tools when the saved page no longer exists", async () => {
    useOnboarding.setState({ status: "done", open: false })
    useNav.setState({ active: "gone" })
    render(<App />)
    await waitFor(() => expect(useNav.getState().active).toBe(HOME_SECTION))
  })
})
