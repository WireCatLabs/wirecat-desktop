import { describe, expect, it } from "vitest"
import { entityLabel, groupAccess, type OwnCommand } from "./own-access"

const cmd = (words: string, remote: OwnCommand["remote"], local: OwnCommand["local"], more = {}): OwnCommand => ({
  words,
  remote,
  local,
  summary: null,
  entity: null,
  ...more,
})

describe("groupAccess", () => {
  it("groups data commands by their first word and keeps the most each asks for", () => {
    const access = groupAccess(
      [
        cmd("contacts list", "read", "read"),
        cmd("contacts update", "write", "none"),
        cmd("deals list", "none", "read"),
        cmd("session start", "read", "write"),
        cmd("doctor", "read", "read"),
        cmd("sync", "read", "write"),
      ],
      {},
    )
    expect(access.groups.map((g) => [g.key, g.remote, g.local])).toEqual([
      ["contacts", "write", "read"],
      ["deals", "none", "read"],
    ])
    expect(access.standard.map((s) => s.root)).toEqual(["session", "doctor"])
    expect(access.sync.map((c) => c.words)).toEqual(["sync"])
  })

  it("uses the manifest's entity, its fields and summaries when it names them", () => {
    const access = groupAccess(
      [
        cmd("contacts list", "none", "read", { entity: "contact", summary: "list contacts" }),
        cmd("contacts show", "none", "read", { entity: "contact", summary: "show one contact" }),
      ],
      { contact: ["name", "email", "phone"] },
    )
    expect(access.groups).toHaveLength(1)
    expect(access.groups[0]).toMatchObject({
      key: "contact",
      fields: ["name", "email", "phone"],
      summaries: ["list contacts", "show one contact"],
    })
  })

  it("makes an entity name readable", () => {
    expect(entityLabel("deal_stage")).toBe("Deal stage")
  })
})
