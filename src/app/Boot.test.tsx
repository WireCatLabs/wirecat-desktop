import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { useOnboarding } from "@/features/onboarding/store"
import { useSystem } from "@/features/system/store"
import { platform } from "@/platform/bridge"
import { m, readyComputer, startOnboarding } from "@/testing/onboarding"
import { App } from "./App"
import { BOOT_CAP_MS } from "./boot"

afterEach(() => {
  vi.restoreAllMocks()
  document.getElementById("boot")?.remove()
})

/** The screen index.html shows before the scripts load. */
function bootScreen() {
  const boot = document.createElement("div")
  boot.id = "boot"
  boot.setAttribute("role", "status")
  boot.setAttribute("aria-label", "WireCat")
  document.body.append(boot)
  return boot
}

it("keeps the boot screen until the setup knows its step, then hands over to the app", async () => {
  const boot = bootScreen()
  const { facts } = startOnboarding({ start: "fresh", computer: null })
  facts.current = null
  expect(screen.getByRole("status", { name: "WireCat" })).toBe(boot)

  facts.current = readyComputer
  await waitFor(() => expect(boot).not.toBeInTheDocument())
  expect(screen.getByRole("heading", { level: 1, name: m.pages.welcome.title })).toBeInTheDocument()
})

it("does not wait for ever when the first check never answers", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const boot = bootScreen()
  useOnboarding.setState({ status: "done", open: false, resuming: false })
  useSystem.setState({ readiness: null, error: null })
  vi.spyOn(platform, "readiness").mockReturnValue(new Promise(() => undefined))
  render(<App />)
  await vi.advanceTimersByTimeAsync(BOOT_CAP_MS - 500)
  expect(boot).toBeInTheDocument()
  await vi.advanceTimersByTimeAsync(1000)
  await waitFor(() => expect(boot).not.toBeInTheDocument())
  vi.useRealTimers()
})
