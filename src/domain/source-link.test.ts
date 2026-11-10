import { describe, expect, it } from "vitest"
import { sourceLink } from "./source-link"

describe("sourceLink", () => {
  it("opens a Bitrix24 contact on its own portal, in either form memo names it", () => {
    expect(sourceLink("bitrix24:portal.example/contact/7731")).toBe("https://portal.example/crm/contact/details/7731/")
    expect(sourceLink("bitrix24:https://portal.example/crm/contact/details/4120/")).toBe(
      "https://portal.example/crm/contact/details/4120/",
    )
  })

  it("opens nothing that does not look like a portal and a number", () => {
    expect(sourceLink("bitrix24:javascript:alert(1)/contact/1")).toBeNull()
    expect(sourceLink("bitrix24:portal.example/contact/abc")).toBeNull()
    expect(sourceLink("bitrix24:user@portal.example/contact/1")).toBeNull()
    expect(sourceLink("bitrix24:localhost/contact/1")).toBeNull()
  })

  it("opens a Telegram account only by its public username", () => {
    expect(sourceLink("telegram:4411", "lena_o")).toBe("https://t.me/lena_o")
    expect(sourceLink("telegram:4411", null)).toBeNull()
    expect(sourceLink("telegram:4411", "a/b")).toBeNull()
    expect(sourceLink("max:9020", "lena_o")).toBeNull()
  })
})
