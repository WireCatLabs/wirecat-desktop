import { describe, expect, it } from "vitest"
import { appPasswordProvider, appPasswordValue, linkParts, readMailNotes } from "./mail-signin"

describe("mail sign-in", () => {
  it("knows the provider from the method, or from the address's domain for another server", () => {
    expect(appPasswordProvider("gmail", "")).toBe("gmail")
    expect(appPasswordProvider("imap", "Me@Yandex.RU ")).toBe("yandex")
    expect(appPasswordProvider("imap", "me@bk.ru")).toBe("mailru")
    expect(appPasswordProvider("imap", "me@me.com")).toBe("icloud")
    expect(appPasswordProvider("imap", "me@example.org")).toBeNull()
    expect(appPasswordProvider("microsoft", "me@gmail.com")).toBeNull()
  })

  it("drops the spaces of a copied Gmail password only", () => {
    expect(appPasswordValue("gmail", " abcd efgh ijkl mnop ")).toBe("abcdefghijklmnop")
    expect(appPasswordValue("yandex", " ab cd ")).toBe("ab cd")
  })

  it("reads mail-cli's prepare text into steps and notes, without the lines meant for its maintainers", () => {
    const read = readMailNotes([
      "Server: imap.gmail.com:993 (tls), login [email]",
      "Prepare the Gmail mailbox first:",
      "  1. Turn on 2-Step Verification for the Google Account.",
      "  2. Open https://myaccount.google.com/apppasswords and create an app password. Google's help page does not list the labels of that screen, so none are quoted here.",
      "  Note: App passwords are not offered with Advanced Protection on.",
      "  Sources: https://support.google.com/mail/answer/7126229",
      "  All providers: https://github.com/WireCatLabs/mail-cli/blob/main/docs/providers.md",
      "Gmail did not grant sending",
    ])
    expect(read).toEqual({
      server: "imap.gmail.com:993 (tls), login [email]",
      steps: [
        "Turn on 2-Step Verification for the Google Account.",
        "Open https://myaccount.google.com/apppasswords and create an app password.",
      ],
      notes: ["App passwords are not offered with Advanced Protection on."],
      other: ["Gmail did not grant sending"],
    })
  })

  it("cuts a line at its links, leaving the closing stop to the text", () => {
    expect(linkParts("Open https://a.example/x. Then go.").map((p) => [p.text, p.url])).toEqual([
      ["Open ", false],
      ["https://a.example/x", true],
      [". Then go.", false],
    ])
  })
})
