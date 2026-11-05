import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach } from "vitest"
import { HOME_SECTION, useNav } from "@/features/nav"
import { useOnboarding } from "@/features/onboarding/store"
import { resetKept } from "@/features/tools/kept"
import { useLanguage } from "@/i18n"
import { initPlatform } from "@/platform/bridge"

await initPlatform()

// A fresh store resumes the setup from the computer's state; a test that wants that asks for it (`resumeOnboarding`).
beforeEach(() => {
  useOnboarding.setState({ resuming: false })
})

afterEach(() => {
  cleanup()
  useNav.setState({ active: HOME_SECTION })
  resetKept()
  useLanguage.setState({ choice: "en" })
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

// The suite reads English; a machine set to Russian or Spanish would otherwise switch it.
useLanguage.setState({ choice: "en" })
