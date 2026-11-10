import { afterEach, describe, expect, it, vi } from "vitest"
import { platform } from "@/platform/bridge"
import { listProfiles } from "./query"

afterEach(() => vi.restoreAllMocks())

describe("listProfiles", () => {
  it("asks the tool once for pages that open together or within seconds of each other", async () => {
    const asked = vi.spyOn(platform, "listProfiles")
    await Promise.all([listProfiles("tg"), listProfiles("tg")])
    await listProfiles("tg")
    expect(asked).toHaveBeenCalledTimes(1)
  })
})
