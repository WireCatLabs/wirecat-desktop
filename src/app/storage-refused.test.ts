import { afterEach, describe, expect, it, vi } from "vitest"
import { useScale } from "@/features/settings/scale"
import { useLanguage } from "@/i18n"
import { useTheme } from "./theme"

describe("where storage refuses writes", () => {
  afterEach(() => vi.restoreAllMocks())

  it("theme, language and scale still change", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError")
    })
    expect(() => useTheme.getState().set("dark")).not.toThrow()
    expect(() => useLanguage.getState().set("ru")).not.toThrow()
    expect(() => useScale.getState().set(120)).not.toThrow()
    expect(useTheme.getState().choice).toBe("dark")
    expect(useLanguage.getState().choice).toBe("ru")
    expect(useScale.getState().percent).toBe(120)
  })
})
