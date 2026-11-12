import { vi } from "vitest"

/** The computer asks for reduced motion: nothing fades, so a test need not wait out a crossfade. */
export function reduceMotion() {
  const media = window.matchMedia
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...media(query),
    matches: query.includes("prefers-reduced-motion: reduce"),
  }))
}
