import { describe, expect, it } from "vitest"
import { ownerId, tools } from "@/domain/catalog"
import { SHOWCASE_VERSIONS } from "./mock-showcase"

describe("showcase", () => {
  it("has a version for every listed tool, so none of them shows as not starting", () => {
    expect(tools.map((t) => ownerId(t.id)).filter((id) => !SHOWCASE_VERSIONS[id])).toEqual([])
  })
})
