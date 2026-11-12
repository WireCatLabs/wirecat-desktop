import { describe, expect, it } from "vitest"
import { without } from "./record"

describe("without", () => {
  it("drops the key and leaves the record it was given unchanged", () => {
    const record = { a: 1, b: 2 }
    expect(without(record, "a")).toEqual({ b: 2 })
    expect(record).toEqual({ a: 1, b: 2 })
  })

  it("returns the same entries when the key is absent", () => {
    expect(without({ a: 1 }, "z")).toEqual({ a: 1 })
  })
})
