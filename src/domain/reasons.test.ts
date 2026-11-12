import { describe, expect, it } from "vitest"
import { reasonOf } from "./people"
import { queryReason } from "./search"

describe("knownReason", () => {
  it("passes a known reason through and refuses any other text", () => {
    expect(reasonOf("person.owner")).toBe("person.owner")
    expect(reasonOf("toString")).toBeNull()
    expect(queryReason("query.unknown-field")).toBe("unknown-field")
    expect(queryReason("query.nope")).toBeNull()
  })
})
