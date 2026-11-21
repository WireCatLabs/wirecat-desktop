import { describe, expect, it } from "vitest"
import { costText, filterOf, groupsOf, refusalOf } from "./inbox"

const t = (bucket: string, ref: string) => ({ bucket, ref })

describe("inbox", () => {
  it("groups a page's threads under needs an answer, to read and can wait, each with its whole count", () => {
    const groups = groupsOf({
      threads: [t("answer", "a1"), t("answer", "a2"), t("later", "l1")],
      buckets: { answer: 2, read: 4, later: 9 },
    })
    expect(groups.map((g) => [g.bucket, g.total, g.threads.map((x) => x.ref)])).toEqual([
      ["answer", 2, ["a1", "a2"]],
      ["later", 9, ["l1"]],
    ])
  })

  it("leaves out a thread whose group the tool does not name", () => {
    expect(groupsOf({ threads: [t("spam", "s")], buckets: { answer: 0, read: 0, later: 0 } })).toEqual([])
  })

  it("reads the account chip and the typed words apart", () => {
    expect(filterOf('account:(work OR personal) contract "by friday"')).toEqual({
      accounts: ["work", "personal"],
      words: ["contract", "by friday"],
    })
    expect(filterOf("")).toEqual({ accounts: [], words: [] })
  })

  it("names the refusals the page explains and keeps the rest as the tool's words", () => {
    expect(refusalOf({ code: "configuration_error", reason: "ai.not-set" })).toBe("noModel")
    expect(refusalOf({ code: "permission_error", reason: "chat-sending.ask" })).toBe("ask")
    expect(refusalOf({ code: "not_found", reason: "item.not-found" })).toBe("notSynced")
    expect(refusalOf({ code: "needs_update", reason: null })).toBe("old")
    expect(refusalOf({ code: "store_busy", reason: null })).toBe("busy")
    expect(refusalOf({ code: "failed", reason: "ai.rate-limited" })).toBe("other")
  })

  it("shows a cost under a cent as less than a cent, not as free", () => {
    expect([0.0031, 0, 0.42].map((usd) => costText(usd, "en"))).toEqual(["< $0.01", "$0.00", "$0.42"])
  })
})
