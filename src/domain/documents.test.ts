import { describe, expect, it } from "vitest"
import { ALL, branches, documentName, nodeOfQuery, queryOfNode } from "./documents"

const notes = {
  provider: "notes",
  source: "notes:1",
  label: "Notes · Synthetic notes",
  name: "Synthetic notes",
  count: 4,
  folders: [
    { path: "Projects", name: "Projects", depth: 1, count: 2 },
    { path: "Projects/Acme", name: "Acme", depth: 2, count: 1 },
    { path: "Reviews", name: "Reviews", depth: 1, count: 1 },
  ],
}

describe("the documents tree", () => {
  it("nests each account's folders under the folder whose path they extend", () => {
    const [account] = branches([notes])
    expect([account?.label, account?.provider]).toEqual(["Synthetic notes", "notes"])
    expect(account?.children.map((c) => c.label)).toEqual(["Projects", "Reviews"])
    expect(account?.children[0]?.children.map((c) => [c.label, c.count])).toEqual([["Acme", 1]])
  })

  it("nests by depth, so a Drive folder whose own name holds a slash stays one folder", () => {
    const folders = [
      { path: "Q3/Q4 plans", name: "Q3/Q4 plans", depth: 1, count: 1 },
      { path: "Q3/Q4 plans/Drafts", name: "Drafts", depth: 2, count: 1 },
    ]
    const [account] = branches([{ ...notes, folders }])
    expect(account?.children.map((c) => [c.label, c.children.map((d) => d.label)])).toEqual([
      ["Q3/Q4 plans", ["Drafts"]],
    ])
  })

  it("keeps a folder whose parent is deeper than memo listed at the top", () => {
    const [account] = branches([{ ...notes, folders: [{ path: "A/B", name: "B", depth: 2, count: 1 }] }])
    expect(account?.children.map((c) => c.label)).toEqual(["B"])
  })

  it("reads the chosen node from the search and writes it back", () => {
    const folder = branches([notes])[0]?.children[0]?.children[0]?.id ?? ""
    const q = queryOfNode("budget kind:pdf", folder)
    expect(q).toBe('budget kind:pdf source:"notes:1" folder:"Projects/Acme"')
    expect(nodeOfQuery(q)).toBe(folder)
    const account = queryOfNode(q, "source:notes:1")
    expect(account).toBe('budget kind:pdf source:"notes:1"')
    expect(nodeOfQuery(account)).toBe("source:notes:1")
    expect(queryOfNode(account, ALL)).toBe("budget kind:pdf")
    expect(nodeOfQuery("budget")).toBe(ALL)
  })

  it("names a document by its title, file, path or ref, in that order", () => {
    const d = { ref: "document:4", title: null, fileName: null, path: null }
    expect(documentName(d)).toBe("document:4")
    expect(documentName({ ...d, path: "a/b.md" })).toBe("a/b.md")
    expect(documentName({ ...d, path: "a/b.md", fileName: "b.md" })).toBe("b.md")
    expect(documentName({ ...d, fileName: "b.md", title: "Brief" })).toBe("Brief")
  })
})
