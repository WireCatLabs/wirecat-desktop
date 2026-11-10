import "@testing-library/jest-dom/vitest"
import { cleanup, configure } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"
import { initPlatform } from "@/platform/bridge"
import { answerAtOnce } from "./mock-speed"
import { resetStores } from "./stores"

// The mock is imported here, before any test file runs, so a `vi.mock` of it inside a test file comes too late.
vi.mock("@/platform/mock-delay", () => import("./mock-speed"))

await initPlatform()

// Pages are lazy chunks; on a busy CI machine the first one takes longer than the default 1 s to appear.
configure({ asyncUtilTimeout: 3000 })

// Every store the app creates is recorded, so `resetStores` can put each one back without a list to keep in step.
vi.mock("zustand", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zustand")>()
  const { track } = await import("./registry")
  const create = ((initializer?: unknown) =>
    initializer
      ? track(actual.create(initializer as never))
      : (inner: never) => track(actual.create(inner))) as typeof actual.create
  return { ...actual, create }
})

// A fresh store resumes the setup from the computer's state; a test that wants that asks for it (`resumeOnboarding`).
beforeEach(async () => {
  resetStores()
  const { useOnboarding } = await import("@/shared/onboarding-store")
  useOnboarding.setState({ resuming: false })
})

afterEach(() => {
  cleanup()
  resetStores()
  answerAtOnce(false)
})

// jsdom has no matchMedia; the theme follows it.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia

// jsdom has <dialog> but not its modal methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event("close"))
}
