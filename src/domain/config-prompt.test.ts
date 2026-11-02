import { describe, expect, it } from "vitest"
import { findTool } from "./catalog"
import { configPrompt } from "./config-prompt"

const tg = findTool("tg") as NonNullable<ReturnType<typeof findTool>>
const file = "~/.config/tg-cli/config.json"

describe("the prompt an agent gets about a settings problem", () => {
  it("names the file, the place and the problem, asks for a backup and only a syntax fix", () => {
    const prompt = configPrompt(
      tg,
      {
        tone: "bad",
        text: "The settings file is not valid JSON: a comma is missing before this line.",
        config: { kind: "invalid_json", file, line: 9, column: 3 },
      },
      "work",
    )
    expect(prompt).toContain(`File: ${file}`)
    expect(prompt).toContain("Where: line 9, column 3")
    expect(prompt).toContain("Problem (invalid_json): The settings file is not valid JSON")
    expect(prompt).toContain("backup copy")
    expect(prompt).toContain("Fix only the JSON syntax at or just before line 9, column 3")
    expect(prompt).toContain("Do not add, remove, rename, reorder or change any setting or value.")
    expect(prompt).toContain("Never print, quote or copy a setting's value")
    expect(prompt).toContain("run `tg work doctor`")
  })

  it("keeps a setting problem to its key and offers the tool's own fix", () => {
    const prompt = configPrompt(
      tg,
      {
        tone: "warn",
        text: "sync.colour is not a setting tg knows.",
        fix: "tg personal config unset sync.colour",
        config: { kind: "unknown_setting", file, profile: "personal", key: "sync.colour" },
      },
      null,
    )
    expect(prompt).toContain("Profile: personal")
    expect(prompt).toContain("Setting: sync.colour")
    expect(prompt).toContain("`tg personal config unset sync.colour`")
    expect(prompt).toContain("Prefer running the suggested command")
    expect(prompt).toContain("run `tg personal doctor`")
    expect(prompt).not.toContain("Where:")
  })
})

describe("an older tool's single error string", () => {
  it("is treated as a syntax problem when it is a JSON parse error", () => {
    const max = findTool("max") as NonNullable<ReturnType<typeof findTool>>
    const prompt = configPrompt(
      max,
      {
        tone: "warn",
        text: "Could not read ~/.config/max-cli/config.json: Unexpected token } in JSON at position 212",
        config: { file: "~/.config/max-cli/config.json" },
      },
      "personal",
    )
    expect(prompt).toContain("Fix only the JSON syntax:")
    expect(prompt).not.toContain("Where:")
  })
})
