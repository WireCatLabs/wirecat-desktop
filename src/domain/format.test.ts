import { describe, expect, it } from "vitest"
import { formatBytes, linkParts } from "./format"

describe("formatBytes", () => {
  it("picks a readable unit", () => {
    expect(formatBytes(512)).toBe("512 bytes")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(1450 * 1024 * 1024)).toBe("1.4 GB")
    expect(formatBytes(210 * 1024 * 1024)).toBe("210 MB")
  })
})

describe("linkParts", () => {
  it("cuts a line at its links, leaving the closing stop to the text", () => {
    expect(linkParts("Open https://a.example/x. Then go.").map((p) => [p.text, p.url])).toEqual([
      ["Open ", false],
      ["https://a.example/x", true],
      [". Then go.", false],
    ])
  })

  it("makes a link of https only, never javascript:, http or a file", () => {
    for (const text of [
      "javascript:alert(1)",
      "http://a.example/x",
      "file:///etc/passwd",
      "wirecat://open/v1/task/1",
    ]) {
      expect(linkParts(`see ${text}`).some((p) => p.url)).toBe(false)
    }
  })
})
