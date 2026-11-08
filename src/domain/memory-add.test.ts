import { describe, expect, it } from "vitest"
import {
  chosenReader,
  emptyDraft,
  fileName,
  givenOf,
  MAX_TEXT,
  missingOf,
  reasonOf,
  tooOldFor,
  untickedAtFirst,
} from "./memory-add"

describe("Add to Memory", () => {
  it("says what is missing for each way until it can be saved", () => {
    expect(missingOf(emptyDraft("text"))).toBe("text")
    expect(missingOf({ ...emptyDraft("text"), text: "x".repeat(MAX_TEXT + 1) })).toBe("tooLong")
    expect(missingOf({ ...emptyDraft("link"), url: "example.org" })).toBe("link")
    expect(missingOf({ ...emptyDraft("link"), url: "file:///etc/passwd" })).toBe("link")
    expect(missingOf(emptyDraft("file"))).toBe("file")
    expect(givenOf({ ...emptyDraft("link"), url: " https://example.org/a " })).toEqual({
      kind: "link",
      url: "https://example.org/a",
    })
    expect(givenOf({ ...emptyDraft("file"), path: "/home/o/a.pdf" })).toEqual({ kind: "file", path: "/home/o/a.pdf" })
  })

  it("keeps only the text of the way chosen", () => {
    expect(givenOf({ ...emptyDraft("text"), text: "notes", url: "https://x.org" })).toEqual({
      kind: "text",
      text: "notes",
    })
  })

  it("uses only the reader the owner chose, never the only one there is", () => {
    const one = [{ id: "ollama", available: true, chosen: false }]
    expect(chosenReader(one)).toBeNull()
    expect(chosenReader([{ id: "codex", available: false, chosen: true }])).toBeNull()
    expect(chosenReader([...one, { id: "codex", available: true, chosen: true }])?.id).toBe("codex")
  })

  it("leaves suggested tasks unticked at first", () => {
    expect(
      untickedAtFirst([
        { id: "f1", kind: "fact" },
        { id: "f2", kind: "task" },
      ]),
    ).toEqual(["f2"])
  })

  it("words memo's known refusals and leaves the rest in memo's words", () => {
    expect(reasonOf("source.url-refused")).toBe("source.url-refused")
    expect(reasonOf("reader.not-running")).toBe("reader.not-running")
    expect(reasonOf("the store is busy")).toBeNull()
    expect(tooOldFor("error: unknown command 'sources'")).toBe(true)
    expect(fileName("C:\\Users\\o\\runner notes.pdf")).toBe("runner notes.pdf")
  })
})
