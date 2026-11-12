import { describe, expect, it } from "vitest"
import { refusalOf } from "./DigestAgent"
import { bookMessages } from "./messages-book"

describe("refusalOf", () => {
  const m = bookMessages.en.form

  it("words memo's known refusals and nothing else, not even an object's own property names", () => {
    expect(refusalOf("digest.agent-unchosen", m)).toBe(m.agentUnchosen)
    expect(refusalOf("toString", m)).toBeNull()
    expect(refusalOf("constructor", m)).toBeNull()
  })
})
