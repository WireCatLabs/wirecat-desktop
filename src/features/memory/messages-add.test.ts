import { describe, expect, it } from "vitest"
import { MENDED_IN_SETTINGS } from "@/domain/memory-add"
import { LANGS } from "@/i18n"
import { addMessages } from "./messages-add"

const IMAGE_REASONS = ["ai.not-set", "ai.images-not-allowed", "ai.key-missing", "image.unsupported", "ai.failed"]

describe("the words for a picture added to memory", () => {
  it.each(LANGS)("%s has a line for every reason a picture is kept by its name", (lang) => {
    const m = addMessages[lang]
    for (const reason of IMAGE_REASONS) expect(m.imageAfter[reason], `${lang} ${reason}`).toBeTruthy()
    for (const reason of ["ai.not-set", "ai.images-not-allowed", "ai.key-missing"])
      expect(m.imageBefore[reason], `${lang} ${reason}`).toBeTruthy()
    expect(m.imageRead("anthropic/claude-haiku-4-5")).toContain("anthropic/claude-haiku-4-5")
    expect(m.imageWillRead("m", "h.example", false)).toContain("h.example")
    expect(m.imageWillRead("m", "h.example", true)).not.toContain("h.example")
  })

  it("offers the way to Settings only for what Settings can mend", () => {
    expect(MENDED_IN_SETTINGS).not.toContain("image.unsupported")
    for (const reason of MENDED_IN_SETTINGS) expect(IMAGE_REASONS).toContain(reason)
  })
})
