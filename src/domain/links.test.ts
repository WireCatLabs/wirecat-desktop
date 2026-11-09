import { describe, expect, it } from "vitest"
import { appLink, type DeepLinkTarget, formatLink, linkTargetOf, parseLink, referenceOf } from "./links"
import fixture from "./links-v1.fixture.json"

const valid = fixture.valid as { ref: string; path: string; web: string; app: string; target: DeepLinkTarget }[]

describe("the v1 link grammar, as cli-core's shared fixture states it", () => {
  it.each(valid.map((one) => [one.ref, one] as const))("reads and writes %s", (_, one) => {
    for (const text of [one.path, one.web, one.app]) expect(parseLink(text)).toEqual(one.target)
    expect(formatLink(one.target)).toBe(one.path)
    expect(appLink(one.target)).toBe(one.app)
    expect(linkTargetOf(one.ref)).toEqual(one.target)
    expect(referenceOf(one.target)).toBe(one.ref)
  })

  it.each(fixture.refused.map((one) => [one.why, one.path] as const))("refuses %s", (_, path) => {
    expect(parseLink(path)).toBeNull()
    if (path.startsWith("/")) {
      expect(parseLink(`https://wirecat.dev/o#${path}`)).toBeNull()
      expect(parseLink(`wirecat://open${path}`)).toBeNull()
    }
  })

  it("ignores a query a later version may add", () => {
    for (const one of fixture.ignored_query) expect(parseLink(one.path)).toEqual(one.target)
  })

  it("keeps the limits the fixture names", () => {
    expect(fixture.version).toBe("v1")
    expect(fixture.app_prefix).toBe("wirecat://open")
    expect(parseLink(`/v1/task/${"1".repeat(fixture.max_path - 9)}`)).not.toBeNull()
    expect(parseLink(`/v1/task/${"1".repeat(fixture.max_path - 8)}`)).toBeNull()
  })

  it("names nothing for a ref no link opens", () => {
    for (const ref of ["person:", "person:77/2", "account:max/1", "msg:max/1/2", "chat:tg//1", "task:", "plain"])
      expect(linkTargetOf(ref)).toBeNull()
  })
})
