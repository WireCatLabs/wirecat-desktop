import { describe, expect, it } from "vitest"
import { plainNotes } from "./update-notes"

describe("plainNotes", () => {
  it("turns Markdown into plain lines and drops the All changes list", () => {
    const body =
      "Short **summary**.\n\n## New\n\n- Analytics page, see [guide](https://x.dev)\n\n## All changes\n\n- A (#1)\n"
    expect(plainNotes(body)).toBe("Short summary.\n\nNew\n\n• Analytics page, see guide")
  })

  it("returns null for an empty body", () => {
    expect(plainNotes(undefined)).toBeNull()
    expect(plainNotes("  \n")).toBeNull()
  })
})
