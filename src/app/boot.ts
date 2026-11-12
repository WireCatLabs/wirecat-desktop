import { useEffect } from "react"
import { useOnboarding } from "@/shared/onboarding-store"
import { useSystem } from "@/shared/system-store"
import { reducedMotion } from "@/ui/motion"

/** A slow or hung first check must not hold the window on the boot screen; the pages have their own skeletons. */
export const BOOT_CAP_MS = 6000
const FADE_MS = 260

const held = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("boot") === "hold"

/** Fades index.html's boot screen out over the app, which is already laid out under it, then removes it. */
function finishBoot() {
  const boot = document.getElementById("boot")
  if (!boot || boot.dataset.done !== undefined) return
  boot.dataset.done = ""
  boot.setAttribute("aria-hidden", "true")
  setTimeout(() => boot.remove(), reducedMotion() ? 0 : FADE_MS)
}

/** The boot screen stays until the computer has been checked once and the setup knows which step to open. */
export function useFinishBoot() {
  const checked = useSystem((s) => s.readiness !== null || s.error !== null)
  const resuming = useOnboarding((s) => s.open && s.resuming)
  const ready = checked && !resuming
  useEffect(() => {
    if (held()) return
    if (ready) {
      finishBoot()
      return
    }
    const cap = setTimeout(finishBoot, BOOT_CAP_MS)
    return () => clearTimeout(cap)
  }, [ready])
}
