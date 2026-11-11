import { describe, expect, it } from "vitest"
import {
  accountLabel,
  bySource,
  canSplit,
  cleanName,
  contactOf,
  filterPeople,
  fullerName,
  handleOf,
  looksLikeAccount,
  matchesFilter,
  personName,
  profilesOf,
  reasonOf,
  seenAtWork,
  touched,
} from "./people"

const id = (identity: string, scopes: (string | null)[] = [], movable = true) => ({
  identity,
  movable,
  provider: identity.split(":")[0] ?? "",
  seenIn: scopes.map((scope, i) => ({ account: String(i), scope })),
})

describe("people", () => {
  it("groups a person's accounts by source in memo's order", () => {
    const groups = bySource([id("telegram:1"), id("email:a@x.org"), id("telegram:2")])
    expect(groups.map((g) => [g.provider, g.identities.length])).toEqual([
      ["telegram", 2],
      ["email", 1],
    ])
  })

  it("marks an account a work account saw, never the default personal one", () => {
    expect(seenAtWork(id("email:a", ["personal", "work", null]).seenIn)).toBe(true)
    expect(seenAtWork(id("email:a", ["personal", null]).seenIn)).toBe(false)
    expect(seenAtWork([])).toBe(false)
  })

  it("splits off some accounts, never none, all, or one the person does not have", () => {
    const all = [id("telegram:1"), id("email:a"), id("crm:2")]
    expect(canSplit(["crm:2"], all)).toBe(true)
    expect(canSplit([], all)).toBe(false)
    expect(canSplit(["telegram:1", "email:a", "crm:2"], all)).toBe(false)
    expect(canSplit(["max:9"], all)).toBe(false)
    expect(canSplit(["x:a b"], [...all, id("x:a b", [], false)])).toBe(false)
  })

  it("tells an account search from a name, and lists each touched person once", () => {
    expect(looksLikeAccount("telegram:4411")).toBe(true)
    expect(looksLikeAccount("lena@example.org")).toBe(true)
    expect(looksLikeAccount("Lena Ortiz")).toBe(false)
    expect(touched("person:7", null, "person:9", "person:7")).toEqual(["person:7", "person:9"])
  })

  it("filters by name or ref", () => {
    expect(matchesFilter({ name: "Lena Ortiz", ref: "person:7" }, "lena")).toBe(true)
    expect(matchesFilter({ name: null, ref: "person:7" }, "person:7")).toBe(true)
    expect(matchesFilter({ name: "Kai", ref: "person:4" }, "lena")).toBe(false)
  })

  it("cleans a name as a source typed it, and has none when no letter is left", () => {
    expect(cleanName('"CZECH AIRLINES "')).toBe("CZECH AIRLINES")
    expect(cleanName("  «Анна   Петрова» ")).toBe("Анна Петрова")
    expect(cleanName('ООО "Ромашка"')).toBe('ООО "Ромашка"')
    expect(cleanName("!$")).toBeNull()
    expect(cleanName(null)).toBeNull()
  })

  it("names a person by display name, then name, then contact, and never prints null or an id", () => {
    expect(personName({ displayName: "Lena Ortiz", name: "lena", contact: "+34600" })).toBe("Lena Ortiz")
    expect(personName({ displayName: null, name: "! null #97365", contact: "+34600111222" })).toBe("+34600111222")
    expect(personName({ name: "null #97365" })).toBeNull()
  })

  it("falls back to an account name with letters, then to a handle", () => {
    expect(
      handleOf([
        { name: null, username: "Xorlov" },
        { name: "Ярослав Орлов", username: "Xorlov" },
      ]),
    ).toBe("Ярослав Орлов")
    expect(
      handleOf([
        { name: "!", username: null },
        { name: "?", username: "kai_m" },
      ]),
    ).toBe("@kai_m")
    expect(
      handleOf([
        { name: "!", username: null },
        { name: " 'Kai' ", username: null },
      ]),
    ).toBe("Kai")
    expect(handleOf([{ name: "?", username: null }])).toBeNull()
  })

  it("narrows people to those with tasks or a usable name, the owner always named", () => {
    const people = [
      { ref: "person:1", name: null, owner: true, tasks: 0 },
      { ref: "person:2", name: "!", owner: false, tasks: 2 },
      { ref: "person:3", name: "Lena", owner: false, tasks: 0 },
    ]
    const refs = (f: Partial<Parameters<typeof filterPeople>[1]>) =>
      filterPeople(people, { query: "", withTasks: false, named: false, ...f }).map((p) => p.ref)
    expect(refs({})).toEqual(["person:1", "person:2", "person:3"])
    expect(refs({ withTasks: true })).toEqual(["person:2"])
    expect(refs({ named: true })).toEqual(["person:1", "person:3"])
    expect(refs({ query: "len" })).toEqual(["person:3"])
  })

  it("words memo's known refusals and leaves the rest in memo's words", () => {
    expect(reasonOf("identity.stale")).toBe("identity.stale")
    expect(reasonOf("the store is busy")).toBeNull()
  })

  it("reads a WhatsApp @lid as no number, and still names the source of a person with nothing else", () => {
    const lid = { identity: "whatsapp:157724520243314@lid", provider: "whatsapp", username: null }
    expect(contactOf([lid])).toEqual({ provider: "whatsapp", value: null })
    const phone = { identity: "whatsapp:34600111222@s.whatsapp.net", provider: "whatsapp", username: null }
    expect(contactOf([lid, phone])).toEqual({ provider: "whatsapp", value: "+34600111222" })
  })

  it("treats a name with no letter as none and falls back to the handle", () => {
    expect(accountLabel({ name: ".", username: "dvolkov" })).toBe("@dvolkov")
    expect(accountLabel({ name: ".", username: null })).toBeNull()
  })

  it("names the owner's profiles an account was seen in from the account groups", () => {
    const members = [
      { source: "telegram:1001", provider: "telegram", profiles: ["tg personal"] },
      { source: "zoom:1001", provider: "zoom", profiles: ["zm work"] },
      { source: "email:me@work.example", provider: "email", profiles: [] },
    ]
    const seen = (account: string) => ({ account, scope: null })
    expect(profilesOf({ provider: "telegram", seenIn: [seen("1001")] }, members)).toEqual(["personal"])
    expect(profilesOf({ provider: "email", seenIn: [seen("me@work.example")] }, members)).toEqual(["me@work.example"])
    expect(profilesOf({ provider: "telegram", seenIn: [seen("9")] }, members)).toEqual([])
  })

  it("gives a fragment of a name way to the fullest account name", () => {
    expect(fullerName("Вр", ["Богдан Постушенко", null, "Богдан"])).toBe("Богдан Постушенко")
    expect(fullerName(null, ["Богдан"])).toBe("Богдан")
    expect(fullerName("Ярослав", ["Ярослав Орлов", "Орлов"])).toBe("Ярослав Орлов")
  })

  it("keeps a full name that an account does not extend", () => {
    expect(fullerName("Лена Ортис", ["Kai M.", "Лена"])).toBe("Лена Ортис")
    expect(fullerName("Вр", ["Ли"])).toBe("Вр")
  })
})
