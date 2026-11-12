import { describe, expect, it } from "vitest"
import { readLast, remember } from "./store"

describe("the last settings view", () => {
  it("comes back as it was remembered", () => {
    remember(() => ({ view: "shared", tool: "tg", shapes: { tg: { rows: 4, categories: 1, file: true } } }))
    expect(readLast()).toEqual({ view: "shared", tool: "tg", shapes: { tg: { rows: 4, categories: 1, file: true } } })
  })

  it("is ignored when an older app saved another shape", () => {
    localStorage.setItem("wirecat.config.last", JSON.stringify({ view: "everything", shapes: { tg: 3 } }))
    expect(readLast()).toEqual({})
  })
})
