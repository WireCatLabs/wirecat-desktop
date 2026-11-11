import { describe, expect, it } from "vitest"
import { accountValue, sourceLink } from "./source-link"

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

  it("opens a portal's user on their profile page", () => {
    expect(sourceLink("bitrix24:portal.example/user/3327")).toBe("https://portal.example/company/personal/user/3327/")
    expect(sourceLink("bitrix24:https://portal.example/company/personal/user/12/")).toBe(
      "https://portal.example/company/personal/user/12/",
    )
    expect(sourceLink("bitrix24:localhost/user/1")).toBeNull()
  })

  it("opens WhatsApp by a phone number only, never by an @lid", () => {
    expect(sourceLink("whatsapp:34600111222")).toBe("https://wa.me/34600111222")
    expect(sourceLink("whatsapp:34600111222@s.whatsapp.net")).toBe("https://wa.me/34600111222")
    expect(sourceLink("whatsapp:157724520243314@lid")).toBeNull()
  })

  it("writes to a plain address, and to nothing that carries a query", () => {
    expect(sourceLink("email:ya@burobiz.ru")).toBe("mailto:ya@burobiz.ru")
    expect(sourceLink("email:a@example.com?attach=/etc/passwd")).toBeNull()
    expect(sourceLink("email:not-an-address")).toBeNull()
  })

  it("copies what a person would type, not memo's id", () => {
    expect(accountValue("email:ya@burobiz.ru")).toBe("ya@burobiz.ru")
    expect(accountValue("telegram:5401505520", "Xorlov")).toBe("@Xorlov")
    expect(accountValue("telegram:5401505520")).toBe("5401505520")
    expect(accountValue("whatsapp:34600111222@c.us")).toBe("+34600111222")
    expect(accountValue("bitrix24:portal.example/contact/907")).toBe("https://portal.example/crm/contact/details/907/")
  })

  it("opens a Telegram account only by its public username", () => {
    expect(sourceLink("telegram:4411", "lena_o")).toBe("https://t.me/lena_o")
    expect(sourceLink("telegram:4411", null)).toBeNull()
    expect(sourceLink("telegram:4411", "a/b")).toBeNull()
    expect(sourceLink("max:9020", "lena_o")).toBeNull()
  })
})
