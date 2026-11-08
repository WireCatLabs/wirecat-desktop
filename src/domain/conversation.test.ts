import { describe, expect, it } from "vitest"
import { type ConversationTarget, isConversation, joined, placeOf, splitQuoted } from "./conversation"
import { type DeepLinkTarget, parseLink, referenceOf } from "./links"
import fixture from "./links-v1.fixture.json"

const valid = fixture.valid as { ref: string; path: string; target: DeepLinkTarget }[]

describe("the conversation a link opens", () => {
  const conversations = valid.filter((one) => one.path.startsWith("/v1/chat/") || one.path.startsWith("/v1/msg/"))

  it("covers both forms in the shared fixture, mail threads included", () => {
    expect(conversations.some((one) => one.path.startsWith("/v1/msg/"))).toBe(true)
    expect(conversations.some((one) => one.path.startsWith("/v1/chat/email/"))).toBe(true)
  })

  it.each(conversations.map((one) => [one.path, one] as const))("reads %s by its store parts", (_, one) => {
    const target = parseLink(one.path)
    if (!target || !isConversation(target)) throw new Error(`${one.path} is not a conversation`)
    const want = one.target as ConversationTarget
    expect(placeOf(target)).toEqual({
      provider: want.provider,
      account: want.account,
      chat: want.chat,
      message: want.type === "message" ? want.message : null,
    })
    expect(referenceOf(target)).toBe(one.ref)
  })

  it("is no conversation for the other kinds", () => {
    for (const path of ["/v1/task/80", "/v1/proposal/fact%3A512", "/v1/sync/telegram"]) {
      const target = parseLink(path)
      expect(target && isConversation(target)).toBe(false)
    }
  })
})

describe("joined", () => {
  const m = (ref: string) => ({ ref })

  it("puts an older page above and a newer one below, each message once", () => {
    expect(joined([m("3"), m("4")], [m("1"), m("2"), m("3")], true).map((x) => x.ref)).toEqual(["1", "2", "3", "4"])
    expect(joined([m("3"), m("4")], [m("4"), m("5")], false).map((x) => x.ref)).toEqual(["3", "4", "5"])
  })
})

describe("splitQuoted", () => {
  it("folds the quoted earlier mail and the line that introduces it", () => {
    const text = "Thanks, two questions.\n\nOn Mon, 3 Nov 2026 at 10:00, Ana <ana@example.com> wrote:\n> Hello\n> there"
    expect(splitQuoted(text)).toEqual({
      own: "Thanks, two questions.",
      quoted: "On Mon, 3 Nov 2026 at 10:00, Ana <ana@example.com> wrote:\n> Hello\n> there",
    })
  })

  it("knows the Spanish and Russian introductions and Outlook's rule", () => {
    expect(splitQuoted("Sí.\nEl lun, 3 nov 2026, Ana escribió:\n> Hola").own).toBe("Sí.")
    expect(splitQuoted("Да.\nВ пн, 3 нояб. Анна написала:\n> Привет").own).toBe("Да.")
    expect(splitQuoted("Fine.\n-----Original Message-----\nFrom: Ana").own).toBe("Fine.")
  })

  it("keeps an email with nothing quoted whole", () => {
    expect(splitQuoted("Hello\nwrote: nothing")).toEqual({ own: "Hello\nwrote: nothing", quoted: null })
  })

  it("keeps a line that only looks like an introduction when no quote follows", () => {
    expect(splitQuoted("On Monday you wrote:\nI agree.")).toEqual({
      own: "On Monday you wrote:\nI agree.",
      quoted: null,
    })
  })
})
