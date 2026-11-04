import { describe, expect, it } from "vitest"
import { fixPrompt } from "./fix-prompt"

describe("the prompt an agent gets to fix a failed step", () => {
  it("names the step, the error, the suggestion and the last log lines, and sets the owner's limits", () => {
    const log = Array.from({ length: 80 }, (_, i) => `line ${i}`)
    const prompt = fixPrompt(
      { what: "Installing Zoom (@wirecat/zoom-cli)", error: "No space left.", hint: "Free 400 MB.", log },
      { os: "Windows", app: "0.3.1" },
    )
    expect(prompt).toMatch(/^WireCat Desktop 0\.3\.1 on Windows failed while installing Zoom \(@wirecat\/zoom-cli\)\./)
    expect(prompt).toContain("Error: No space left.")
    expect(prompt).toContain("WireCat's suggestion: Free 400 MB.")
    expect(prompt).toContain("line 79")
    expect(prompt).not.toContain("line 19\n")
    expect(prompt).toMatch(/Do not use sudo/)
    expect(prompt).toMatch(/Do not delete my data/)
  })
})
