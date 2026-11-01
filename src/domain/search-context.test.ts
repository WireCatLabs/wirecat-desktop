import { describe, expect, it } from "vitest"
import { contextLines, hitLink } from "./search-context"

describe("contextLines", () => {
  it("reads the messages around a hit, marking the hit and naming its files", () => {
    const body = {
      items: [
        { ref: "msg:t/1/2/3", sender_name: "Ana", text: "before", attachments: [{ kind: "photo", name: "a.jpg" }] },
        { ref: "msg:t/1/2/4", sender_name: "Jo", text: "the hit", anchor: true },
      ],
    }
    const lines = contextLines("messages", body, { ref: "msg:t/1/2/4" })
    expect(lines.map((l) => [l.who, l.anchor])).toEqual([
      ["Ana", false],
      ["Jo", true],
    ])
    expect(lines[0]?.files).toEqual(["a.jpg"])
  })

  it("marks a mail by its ref when the tool marks none", () => {
    const body = { items: [{ ref: "msg:email/p/I/1" }, { ref: "msg:email/p/I/2" }] }
    expect(contextLines("mail", body, { ref: "msg:email/p/I/2" }).map((l) => l.anchor)).toEqual([false, true])
  })

  it("marks the transcript line the hit was found in", () => {
    const body = {
      items: [{ lines: [0, 30_000, 60_000].map((at, i) => ({ position: i, offset_ms: at, text: `${i}` })) }],
    }
    expect(contextLines("meetings", body, { offset_ms: 45_000 }).map((l) => l.anchor)).toEqual([false, true, false])
  })

  it("opens only https links", () => {
    expect(hitLink({ url: "https://docs.google.com/x" })).toBe("https://docs.google.com/x")
    expect(hitLink({ url: "file:///etc/passwd" })).toBeNull()
  })
})
