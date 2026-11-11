import { describe, expect, it } from "vitest"
import {
  ambiguousTerm,
  clampSpan,
  errorDetail,
  fieldsIn,
  groupHits,
  hitField,
  hitRow,
  nameChoices,
  queryReason,
  quoteValue,
  suggestSearch,
  toggleSearchTerm,
  withoutLeadingStars,
  withoutPatterns,
} from "./search"

describe("hitRow", () => {
  it("reads a message hit by its chat, sender and excerpt", () => {
    const row = hitRow(
      { ref: "msg:1", timestamp: "2026-10-30T10:00:00Z", chat_title: "Family", sender_name: "Ana", excerpt: "hi" },
      0,
    )
    expect(row).toEqual({
      key: "msg:1",
      when: "2026-10-30T10:00:00Z",
      where: "Family",
      tool: null,
      who: "Ana",
      fromMe: false,
      text: "hi",
      files: [],
    })
  })

  it("names the tool a memo hit came from", () => {
    expect(hitRow({ ref: "msg:telegram/1/-100/4000" }, 0).tool).toBe("tg")
    expect(hitRow({ ref: "meeting:1/100" }, 0).tool).toBeNull()
  })

  it("names the files a hit without text carries", () => {
    const hit = {
      excerpt: "",
      attachments: [{ position: 1, kind: "photo" }, { position: 2, kind: "document", name: "a.pdf" }, {}],
    }
    expect(hitRow(hit, 0)).toMatchObject({
      text: null,
      files: [
        { kind: "photo", name: null },
        { kind: "document", name: "a.pdf" },
      ],
    })
  })

  it("prefers a mail subject over its mailbox, and a note's title over its path", () => {
    expect(hitRow({ chat_title: "INBOX", email: { subject: "Re: plan" } }, 0).where).toBe("Re: plan")
    expect(hitRow({ title: "Plan", path: "plan.md", updated_at: "2026-01-01" }, 0)).toMatchObject({
      where: "Plan",
      when: "2026-01-01",
    })
  })

  it("keys a hit without a ref by its place in the page", () => {
    expect(hitRow({}, 3)).toMatchObject({ key: "#3", where: null, text: null })
  })
})

describe("clampSpan", () => {
  it("keeps a span the tool counted past the text inside the query", () => {
    expect(clampSpan({ start: 0, end: 9 }, 7)).toEqual({ start: 0, end: 7 })
    expect(clampSpan({ start: 15, end: 15 }, 13)).toEqual({ start: 13, end: 13 })
    expect(clampSpan(null, 5)).toBeNull()
  })
})

describe("queryReason", () => {
  it("knows only the closed query reasons", () => {
    expect(queryReason("query.unknown-field")).toBe("unknown-field")
    expect(queryReason("query.something-new")).toBeNull()
    expect(queryReason("input.invalid")).toBeNull()
  })

  it("takes the part of the message after the dash as the tool's detail", () => {
    expect(errorDetail('search: query.unknown-field at position 1 — no field "bogus"')).toBe('no field "bogus"')
    expect(errorDetail("search: query.invalid-syntax at position 12")).toBeNull()
  })
})

describe("suggestSearch", () => {
  const words = {
    group: { who: "Who", where: "Where", when: "When", what: "What", files: "Files and links" },
    describe: (f: string) => `about ${f}`,
    more: "More fields…",
    popularHeading: "Most used",
    datesHeading: "Dates",
    valuesHeading: (f: string) => `Values for ${f}`,
    count: (n: number) => `${n} messages`,
  } as const
  const fields = [
    { name: "from", group: "who", example: 'from:"Ana Ruiz"', top: true },
    { name: "chat", group: "where", example: "chat:x", top: true },
    { name: "date", group: "when", example: "date>=7d", top: true },
    { name: "tag", group: "what", example: "tag:x", top: true },
    { name: "has", group: "files", example: "has:photo", top: true },
    { name: "kind", group: "where", example: "kind:group", top: true },
    { name: "transcript", group: "what", example: "transcript:x", top: false },
  ] as const
  const ctx = {
    fields: [...fields],
    values: {
      chat: [
        { value: "-1001", label: "Design crit" },
        { value: "-1002", label: "Family" },
        { value: "-1003", label: "Accountant" },
        { value: "-1001762030832", label: "kyrillic", detail: "kyrillic" },
        { value: "-1001334573228", label: "kyrillic" },
      ],
      from: [
        { value: "11", label: "Ярослав", detail: "yar_one", count: 3 },
        { value: "12", label: "Ярослав", detail: "yar_two", count: 40 },
        { value: "13", label: "Ярослав Петров", detail: null, count: 900 },
        { value: "14", label: "Мирослав", detail: null, count: 5000 },
      ],
    },
    used: {},
    all: false,
    now: new Date(2026, 9, 31),
    words,
    dateWords: {
      last7: "7",
      last30: "30",
      today: "t",
      yesterday: "y",
      thisMonth: "m",
      since: "s",
      between: "b",
    },
    what: "messages",
  }
  const labels = (q: string, at = q.length, all = false) =>
    suggestSearch(q, at, { ...ctx, all }).items.map((i) => i.label)

  it("leads an empty box with the usual first keys, then the rest by group, and no ready queries", () => {
    const found = suggestSearch("", 0, ctx).items
    expect(found.map((i) => [i.label, i.group])).toEqual([
      ["from:", "Most used"],
      ["chat:", "Most used"],
      ["date", "Most used"],
      ["has:", "Most used"],
      ["kind:", "Most used"],
      ["tag:", "What"],
      ["More fields…", undefined],
    ])
    expect(found[0]).toMatchObject({ insert: "from:", open: true, note: "about from" })
    expect(found.some((i) => i.whole)).toBe(false)
  })

  it("puts the keys the owner searched with first, a hidden one too", () => {
    const used = { transcript: 4, tag: 2 }
    expect(labels("").length).toBe(7)
    expect(
      suggestSearch("", 0, { ...ctx, used })
        .items.map((i) => i.label)
        .slice(0, 5),
    ).toEqual(["transcript:", "tag:", "from:", "chat:", "date"])
    expect(suggestSearch("x t", 3, { ...ctx, used }).items.map((i) => i.label)).toEqual(["transcript:", "tag:"])
  })

  it("shows the first fields by group, the rest behind More fields, and finds a hidden one by name", () => {
    expect(labels("x ")).toEqual(["from:", "chat:", "date", "has:", "kind:", "tag:", "More fields…"])
    expect(labels("x ", 2, true)).toContain("transcript:")
    expect(labels("x tr")).toEqual(["transcript:"])
    expect(suggestSearch("x ", 2, ctx).items[5]).toMatchObject({ example: "tag:x", group: "What" })
  })

  it("offers dates the tools accept after date, narrowed as typed", () => {
    expect(labels("date")).toEqual([
      "date>=7d",
      "date>=30d",
      "date:today",
      "date:yesterday",
      "date>=2026-10-01",
      "date:[2026-10-01 TO *]",
      "date:[2026-10-01 TO 2026-10-31]",
    ])
    expect(labels("date>=")).toEqual(["date>=7d", "date>=30d", "date>=2026-10-01"])
    expect(labels("-date:to")).toEqual(["date:today"])
    expect(suggestSearch("-date:to", 8, ctx).items[0]?.insert).toBe("-date:today")
  })

  it("shows a chat by its title and inserts its id, which names exactly one chat", () => {
    const found = suggestSearch('invoice chat:"des', 17, ctx)
    expect(found.items.map((i) => i.insert)).toEqual(['chat:"-1001"'])
    expect(found.items[0]).toMatchObject({ label: "Design crit", example: "-1001" })
    expect(found.from).toBe(8)
    expect(labels("chat:acc")).toEqual(["Accountant"])
  })

  it("tells two chats with one title apart by username and id", () => {
    const found = suggestSearch("chat:@kyr", 9, ctx).items
    expect(found.map((i) => [i.label, i.note, i.insert])).toEqual([["kyrillic", "@kyrillic", 'chat:"-1001762030832"']])
    expect(suggestSearch("chat:kyr", 8, ctx).items.map((i) => i.insert)).toEqual([
      'chat:"-1001762030832"',
      'chat:"-1001334573228"',
    ])
  })

  it("offers the people who write most first, by any part of the name, with ё typed as е", () => {
    const found = suggestSearch("from:ярос", 9, ctx).items
    expect(found.map((i) => [i.label, i.note])).toEqual([
      ["Ярослав Петров", "900 messages"],
      ["Ярослав", "@yar_two · 40 messages"],
      ["Ярослав", "@yar_one · 3 messages"],
    ])
    expect(labels("from:слав")).toEqual(["Мирослав", "Ярослав Петров", "Ярослав", "Ярослав"])
  })

  it("keeps a quoted value with spaces as one term while it is typed", () => {
    expect(suggestSearch('chat:"Design c', 14, ctx).items.map((i) => i.label)).toEqual(["Design crit"])
  })
})

describe("fieldsIn", () => {
  it("names each key a query filters by once, and none of the values", () => {
    expect(fieldsIn('photo from:"Ana Ruiz" -chat:x date>=7d from:12 (a OR b)')).toEqual(["from", "chat", "date"])
    expect(fieldsIn("")).toEqual([])
  })
})

describe("nameChoices", () => {
  const known = {
    from: [
      { value: "11", label: "Ярослав", detail: "yar_one", count: 3 },
      { value: "12", label: "Ярослав", detail: "yar_two", count: 40 },
      { value: "13", label: "Ярослав Петров", detail: null, count: 900 },
      { value: "20", label: "Ana", detail: null, count: 1 },
    ],
  }

  it("lists everyone whose name holds the refused name, who writes most first, as a query naming one id", () => {
    const refused = [
      { id: "11", label: "Ярослав · @yar_one", field: "from" as const },
      { id: "12", label: "Ярослав · @yar_two", field: "from" as const },
    ]
    const found = nameChoices('from:"Ярослав" has:photo', '"Ярослав" matches 2 people', refused, known)
    expect(found?.typed).toBe("Ярослав")
    expect(found?.options.map((o) => [o.label, o.query])).toEqual([
      ["Ярослав Петров", "from:13 has:photo"],
      ["Ярослав", "from:12 has:photo"],
      ["Ярослав", "from:11 has:photo"],
    ])
  })

  it("answers a name that fits nobody with the names that contain it", () => {
    const found = nameChoices("-from:петров", 'from:петров — nobody matches "петров"', [], known)
    expect(found?.options.map((o) => o.query)).toEqual(["-from:13"])
    expect(nameChoices("from:zzz", 'from:zzz — nobody matches "zzz"', [], known)).toBeNull()
    expect(nameChoices("from:ana", "the store is locked", [], known)).toBeNull()
  })

  it("keeps the tool's own candidates when no list knows them", () => {
    const refused = [{ id: "-1001", label: "Design", field: "chat" as const }]
    expect(nameChoices("chat:design", "matches 2 chats", refused, {})?.options.map((o) => o.query)).toEqual([
      'chat:"-1001"',
    ])
  })
})

describe("withoutLeadingStars", () => {
  it("turns topic words into their start and keeps names, files and exact words", () => {
    expect(withoutLeadingStars("*аренд* from:*Мила* filename:*договор*")).toBe("аренд* from:*Мила* filename:*договор*")
    expect(withoutLeadingStars("(*rent* OR -subject:*отчет) content:*акт*")).toBe(
      "(rent* OR -subject:отчет*) content:акт*",
    )
    expect(withoutLeadingStars("*договор\\ аренды*")).toBe("договор\\ аренды*")
  })
  it("says nothing changed when no word starts with *", () => {
    expect(withoutLeadingStars('аренд* from:*Мила* "*x*"')).toBeNull()
    expect(withoutLeadingStars("* invoice")).toBeNull()
  })
})

describe("withoutPatterns", () => {
  it("turns name and value patterns into plain values and keeps word starts and file patterns", () => {
    expect(withoutPatterns("купи* велосипед* from:*Мила*")).toBe("купи* велосипед* from:Мила")
    expect(withoutPatterns("from:*Анна\\ Мария* has:photo")).toBe('from:"Анна Мария" has:photo')
    expect(withoutPatterns("(rent OR deposit*) -chat:Диз*")).toBe("(rent OR deposit*) -chat:Диз")
    expect(withoutPatterns("filename:*договор* subject:*отчет*")).toBe("filename:*договор* subject:отчет")
    expect(withoutPatterns("from:* invoice")).toBe("invoice")
  })
  it("says nothing changed when there is no pattern to take out", () => {
    expect(withoutPatterns("аренд* has:photo date>=7d")).toBeNull()
    expect(withoutPatterns('from:"Сергей Иванов"')).toBeNull()
  })
})

describe("quoteValue", () => {
  it("leaves plain words bare, in any script", () => {
    expect(quoteValue("photo")).toBe("photo")
    expect(quoteValue("Кириллица")).toBe("Кириллица")
    expect(quoteValue("report.pdf")).toBe("report.pdf")
    expect(quoteValue("12345")).toBe("12345")
  })

  it("quotes whatever the parser reads as an operator, a wildcard or a separator", () => {
    expect(quoteValue("@kyrillic")).toBe('"@kyrillic"')
    expect(quoteValue("Design crit")).toBe('"Design crit"')
    expect(quoteValue("-1001762030832")).toBe('"-1001762030832"')
    expect(quoteValue("a:b")).toBe('"a:b"')
    expect(quoteValue("(work)")).toBe('"(work)"')
    expect(quoteValue("inv*")).toBe('"inv*"')
    expect(quoteValue("Кафе ☕")).toBe('"Кафе ☕"')
    expect(quoteValue("🎉")).toBe('"🎉"')
    expect(quoteValue("OR")).toBe('"OR"')
    expect(quoteValue("trailing.")).toBe('"trailing."')
  })

  it("escapes quotes and backslashes inside the quotes", () => {
    expect(quoteValue('say "hi"')).toBe('"say \\"hi\\""')
    expect(quoteValue("a\\b")).toBe('"a\\\\b"')
  })
})

describe("ambiguousTerm", () => {
  it("finds the chat term a refused name came from", () => {
    const q = 'date>=3d chat:"Design crit" chat:kyrillic'
    expect(ambiguousTerm(q, "chat", ["@kyrillic", "kyrillic"])).toEqual({ start: 28, end: 41, sign: "" })
    expect(ambiguousTerm("-chat:kyr x", "chat", ["kyrillic"])).toEqual({ start: 0, end: 9, sign: "-" })
    expect(ambiguousTerm("invoice", "chat", ["kyrillic"])).toBeNull()
  })
})

describe("catalog examples", () => {
  it("are written the way the bar quotes a value, so each one is a query the tool accepts", async () => {
    const { tools } = await import("./catalog")
    for (const tool of tools)
      for (const f of tool.search?.fields ?? []) {
        if (f.name === "date") continue
        const value = f.example.slice(f.name.length + 1)
        const raw = value.startsWith('"') ? value.slice(1, -1).replace(/\\(.)/g, "$1") : value
        expect(f.example, `${tool.id} ${f.name}`).toBe(`${f.name}:${quoteValue(raw)}`)
      }
  })
})

describe("filtering and grouping by a hit's value", () => {
  const msg = { chat_title: "Harbour flat", sender_name: "Ana Ruiz", timestamp: "2026-10-30T18:00:00Z" }
  it("maps a value to the tool's own field, and only fields the tool knows", () => {
    expect(hitField(["chat_title"], ["chat", "from"])).toBe("chat")
    expect(hitField(["email", "labels", "0"], ["label"])).toBe("label")
    expect(hitField(["chat_title"], ["title"])).toBeNull()
    expect(hitField(["excerpt"], ["chat", "from"])).toBeNull()
  })

  it("adds a term quoted as the tool reads it, and takes the same term out again", () => {
    const q = toggleSearchTerm("invoice", "chat", "Harbour flat")
    expect(q).toBe('invoice chat:"Harbour flat"')
    expect(toggleSearchTerm(q, "chat", "Harbour flat")).toBe("invoice")
    expect(toggleSearchTerm("", "from", "Ana", true)).toBe("-from:Ana")
  })

  it("groups the shown hits by a field, most first, and never counts the owner as a sender", () => {
    const hits = [msg, { ...msg, chat_title: "Family" }, msg, { ...msg, sender_is_me: true }]
    expect(groupHits(hits, "chat").map((g) => [g.value, g.count])).toEqual([
      ["Harbour flat", 3],
      ["Family", 1],
    ])
    expect(groupHits(hits, "from").map((g) => [g.value, g.count])).toEqual([
      ["Ana Ruiz", 3],
      ["", 1],
    ])
  })
})
