import { delay } from "./mock-delay"
import { type Identity, type Listed, type Match, PERSON_KINDS, type PersonDetail } from "./people-schemas"
import type { Platform } from "./types"

// The People page's stand-in for memo, with made-up people only, shaped like cli-memo #748's real answers
// (src-tauri/tests/fixtures/people). `?people=none` knows only the owner, `missing` has no memo, `old` an older memo,
// `more` says memo has more people and matches than were read. `?people-fail=read` fails the read (another sync holds
// the store), `?people=nokinds` is a memo older than kinds of people (one list of everyone, no contact),
// `?people-fail=write` fails every decision the same way, `?people-fail=stale` refuses Same person as
// `identity.stale`, `?people-fail=merge` refuses the second join of a group.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("people")
const fail = params.get("people-fail")
const BUSY = "another process holds the store (store.busy); try again in a minute"

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

type Held = Omit<PersonDetail, "matches">

const account = (
  identity: string,
  name: string | null,
  seen: [string, string][],
  method: string,
  days: number,
  username: string | null = null,
): Identity => ({
  identity,
  provider: identity.split(":")[0] ?? identity,
  name,
  username,
  seenIn: seen.map(([id, scope]) => ({ account: id, scope })),
  method,
  linkedAt: ago(days * DAY),
  movable: true,
})

function seed(): Held[] {
  const person = (ref: string, name: string | null, identities: Identity[], merges: Held["merges"] = []): Held => ({
    ref,
    name,
    mergedInto: null,
    identities,
    merges,
  })
  return [
    person("person:1", null, []),
    person(
      "person:7",
      "Lena Ortiz",
      [
        account("telegram:4411", "Lena", [["1", "personal"]], "initial", 40, "lena_o"),
        account(
          "email:lena@example.org",
          "Lena Ortiz",
          [
            ["2", "work"],
            ["3", "personal"],
          ],
          "same-email",
          12,
        ),
        account("crm:acct/88", "Lena O.", [["acme", "work"]], "manual", 3),
      ],
      [
        {
          id: "merge:7-12",
          from: "person:12",
          identities: ["email:lena@example.org"],
          method: "same-email",
          at: ago(12 * DAY),
        },
      ],
    ),
    person("person:9", "Lena Ortiz", [account("max:9020", "Лена Ортис", [["5", "personal"]], "initial", 20)]),
    person("person:4", "Kai Moreno", [
      account(
        "telegram:5120",
        "Kai",
        [
          ["1", "personal"],
          ["6", "work"],
        ],
        "initial",
        60,
        "kai_m",
      ),
    ]),
    person("person:5", "Kai M.", [account("max:7731", "Kai M.", [["5", "personal"]], "initial", 9)]),
    person("person:21", "Marta Gil", [
      account("whatsapp:34600111222", "Marta", [["7", "personal"]], "initial", 30),
      account("email:marta@studio.example", "Marta Gil", [["2", "work"]], "same-email", 8),
    ]),
    person("person:22", "Marta Gil (Studio)", [
      account(
        "bitrix24:https://northstar.example/crm/contact/details/4120/",
        "Marta Gil",
        [["acme", "work"]],
        "initial",
        6,
      ),
    ]),
    person("person:23", '"CZECH AIRLINES "', [
      account("email:news@czech.example", '"CZECH AIRLINES "', [["2", "personal"]], "initial", 90),
    ]),
    person("person:24", "!", [account("telegram:8812", "!", [["1", "personal"]], "initial", 15, "ivan_petrov")]),
    person("person:25", "OpenWeather Team", [
      account("email:no-reply@openweather.example", "OpenWeather Team", [["2", "personal"]], "initial", 80),
    ]),
    person("person:26", "OpenWeather Team", [
      account("email:news@openweather.example", "OpenWeather Team", [["3", "work"]], "initial", 50),
    ]),
    person("person:27", "! null #97365", [account("telegram:97365", null, [["1", "personal"]], "initial", 11)]),
    person("person:28", "Без имени", [account("max:5521", "Без имени", [["5", "personal"]], "initial", 7)]),
    person("person:30", "Konstantin Nikolaevich Loft Pro Max Semenov", [
      account(
        "bitrix24:https://northstar.example/crm/contact/details/5310/",
        "Konstantin Nikolaevich Loft Pro Max Semenov",
        [["acme", "work"]],
        "initial",
        14,
      ),
    ]),
    person("person:31", "Konstantin", [
      account("telegram:7012", "Konstantin", [["1", "personal"]], "initial", 70, "kostya_s"),
      account("max:4410", "Костя", [["5", "personal"]], "same-phone", 30),
    ]),
    person("person:32", "K. Semenov", [account("whatsapp:34600555019", "K. Semenov", [["7", "work"]], "initial", 4)]),
    ...crowd(),
  ]
}

/** Enough made-up people for the table to have pages. */
function crowd(): Held[] {
  const first = ["Ana", "Bruno", "Chen", "Dana", "Emil", "Farah", "Goran", "Hana", "Ilya", "Jun", "Kira", "Luis"]
  const last = ["Abad", "Berg", "Costa", "Diaz", "Engel", "Fox", "Grau", "Hill", "Ito", "Jaramillo"]
  const sources = ["telegram", "max", "whatsapp", "email"]
  return Array.from({ length: 110 }, (_, n) => {
    const name = `${first[n % first.length]} ${last[Math.floor(n / first.length) % last.length]}`
    const ids = Array.from({ length: 1 + (n % 3) }, (_, k) => {
      const provider = sources[(n + k) % sources.length] ?? "telegram"
      const id = provider === "email" ? `${name.toLowerCase().replace(" ", ".")}@example.org` : String(9000 + n * 7 + k)
      return account(`${provider}:${id}`, name, [[String(1 + k), k % 2 ? "work" : "personal"]], "initial", 5 + n)
    })
    return { ref: `person:${100 + n}`, name, mergedInto: null, identities: ids, merges: [] }
  })
}

/** memo's kind of each made-up person who is not one; the rest are people. */
const KIND: Record<string, Listed["kind"]> = {
  "person:23": "organization",
  "person:25": "automated",
  "person:26": "automated",
  "person:105": "stranger",
  "person:117": "stranger",
  "person:129": "stranger",
  "person:27": "unsorted",
  "person:28": "unsorted",
}

/** Tasks the made-up people are assigned. */
const TASKS: Record<string, number> = { "person:1": 4, "person:7": 3, "person:4": 1, "person:21": 2 }

const MATCHES: Match[] = [
  {
    id: "17100",
    persons: ["person:9", "person:7"],
    identity: "max:9020",
    with: "telegram:4411",
    joins: "person",
    signal: "phone",
    candidates: [],
    reason: null,
    evidence: [],
    proposer: { kind: "rule", name: "rule" },
  },
  {
    id: "17101",
    persons: ["person:5", "person:4"],
    identity: "max:7731",
    with: "telegram:5120",
    joins: "identity",
    signal: "agent",
    candidates: [],
    reason: "Kai writes from this MAX account in the Harbour chat.",
    evidence: [],
    proposer: { kind: "agent", name: "claude-code" },
  },
  {
    id: "17102",
    persons: ["person:22", "person:21"],
    identity: "bitrix24:https://northstar.example/crm/contact/details/4120/",
    with: "email:marta@studio.example",
    joins: "person",
    signal: "email",
    candidates: [],
    reason: null,
    evidence: ["marta@studio.example"],
    proposer: { kind: "rule", name: "rule" },
  },
  ...(
    [
      ["17103", "person:30", "person:31", "telegram:7012"],
      ["17104", "person:30", "person:32", "whatsapp:34600555019"],
      ["17105", "person:31", "person:32", "whatsapp:34600555019"],
    ] as const
  ).map(
    ([id, a, b, other]): Match => ({
      id,
      persons: [a, b],
      identity: a === "person:30" ? "bitrix24:https://northstar.example/crm/contact/details/5310/" : "telegram:7012",
      with: other,
      joins: "person",
      signal: "phone",
      candidates: ["person:30", "person:31", "person:32"],
      reason: null,
      evidence: ["+34 600 555 019"],
      proposer: { kind: "rule", name: "rule" },
    }),
  ),
]

export function peopleMock(): Pick<
  Platform,
  | "peopleRead"
  | "peopleKinds"
  | "peopleShow"
  | "peopleFind"
  | "peopleDecide"
  | "peopleMerge"
  | "peopleUnlink"
  | "peopleUnmerge"
> {
  let people = scenario === "none" ? seed().slice(0, 1) : seed()
  let matches = scenario === "none" ? [] : [...MATCHES]
  let next = 40

  const find = (ref: string): Held => {
    const p = people.find((x) => x.ref === ref)
    if (!p) throw new Error("person.not-found")
    return p
  }
  const shown = (ref: string): PersonDetail => ({
    ...find(ref),
    matches: matches.filter((m) => m.persons.includes(ref)),
  })
  /** As cli-core's settleLinks: the pairs left name the person that stays, and one match is kept per pair. */
  const settle = (from: string, to: string) => {
    const pairs = new Set<string>()
    matches = matches
      .map((x) => ({ ...x, persons: x.persons.map((p) => (p === from ? to : p)) }))
      .filter((x) => {
        const key = [...x.persons].sort().join(" ")
        if (x.persons[0] === x.persons[1] || pairs.has(key)) return false
        pairs.add(key)
        return true
      })
  }
  const merged = new Map<string, string>()
  const current = (ref: string): string => {
    let now = ref
    while (merged.has(now)) now = merged.get(now) ?? now
    return now
  }
  const write = async () => {
    await delay(500)
    if (fail === "write") throw new Error(BUSY)
  }
  /** As memo's display_name: the name unquoted, else a handle, phone or email; never a placeholder. */
  const display = (p: Held) => {
    const name = p.name?.replace(/^["\s]+|["\s]+$/g, "") ?? ""
    if (/\p{L}/u.test(name) && !/^(null|Без имени)$/.test(name) && !name.includes("#")) return name
    const id = p.identities.find((i) => i.username)
    return id?.username ? `@${id.username}` : (contactOf(p) ?? null)
  }
  const contactOf = (p: Held) => {
    const value = (provider: string) => p.identities.find((i) => i.provider === provider)?.identity.split(":")[1]
    const phone = value("whatsapp")
    const username = p.identities.find((i) => i.username)?.username
    return phone ? `+${phone}` : (value("email") ?? (username ? `@${username}` : null))
  }
  const rank = (p: Held) => Number(p.ref.slice(7))
  const listed = (p: Held): Listed => {
    const owner = p.ref === "person:1"
    const base = { ref: p.ref, name: p.name, owner, tasks: TASKS[p.ref] ?? 0 }
    if (scenario === "nokinds")
      return { ...base, displayName: null, kind: null, contact: null, messagesFrom: null, lastContact: null }
    const n = rank(p)
    return {
      ...base,
      displayName: owner ? null : display(p),
      kind: KIND[p.ref] ?? "person",
      contact: contactOf(p),
      messagesFrom: owner ? null : n < 100 ? 1000 - n : (n * 37) % 410,
      lastContact: ago((n % 30) * 3_600_000 * 7),
    }
  }
  const ofKind = (kind: string) => people.map(listed).filter((p) => (p.kind ?? "person") === kind)

  const api: ReturnType<typeof peopleMock> = {
    async peopleRead(kind = "person") {
      await delay(600)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.131.64", need: "0.131.72" }
      if (fail === "read") throw new Error(BUSY)
      const more = scenario === "more"
      const kinded = scenario !== "nokinds"
      const listing = kinded
        ? ofKind(kind).sort(
            (a, b) => Number(b.owner) - Number(a.owner) || (b.messagesFrom ?? 0) - (a.messagesFrom ?? 0),
          )
        : people.map(listed)
      return { kind: "ready", people: listing, peopleMore: more, matches, matchesMore: more, kinded }
    },
    async peopleKinds() {
      await delay(900)
      if (scenario === "nokinds") return {}
      return Object.fromEntries(
        PERSON_KINDS.map((k) => [
          k,
          { value: ofKind(k).length + (k === "unsorted" ? 5_000 : 0), more: k === "unsorted" },
        ]),
      )
    },
    async peopleShow(ref) {
      await delay(350)
      return shown(ref)
    },
    async peopleFind(account) {
      await delay(350)
      const asked = (account.includes(":") ? account : `email:${account}`).toLowerCase()
      const value = asked.split(":")[1]?.replace(/^@/, "")
      const p = people.find((x) =>
        x.identities.some(
          (i) => i.identity.toLowerCase() === asked || (i.username !== null && i.username.toLowerCase() === value),
        ),
      )
      return p ? shown(p.ref) : null
    },
    async peopleDecide(ref, id, answer, reason) {
      await write()
      const m = matches.find((x) => x.id === id && shown(ref).matches.includes(x))
      if (!m) throw new Error("This match is not open on this person any more. Read again.")
      if (answer === "reject" && !reason?.trim()) throw new Error("Say in a few words why they are not one person.")
      if (answer === "confirm" && fail === "stale") throw new Error("identity.stale")
      matches = matches.filter((x) => x.id !== id)
      if (answer === "confirm") {
        const [from, to] = m.persons as [string, string]
        if (m.joins !== "identity") merged.set(from, to)
        const gone = find(from)
        const moving =
          m.joins === "identity" ? gone.identities.filter((i) => i.identity === m.identity) : gone.identities
        people = people
          .map((p) =>
            p.ref === from
              ? { ...p, identities: p.identities.filter((i) => !moving.includes(i)) }
              : p.ref !== to
                ? p
                : {
                    ...p,
                    identities: [...p.identities, ...moving],
                    merges: [
                      ...p.merges,
                      {
                        id: `merge:${to.slice(7)}-${from.slice(7)}`,
                        from,
                        identities: moving.map((i) => i.identity),
                        method: "proposal",
                        at: new Date().toISOString(),
                      },
                    ],
                  },
          )
          .filter((p) => p.ref !== from || p.identities.length > 0)
        if (m.joins !== "identity") settle(from, to)
      }
      const now = people.some((p) => p.ref === ref) ? ref : (m.persons[1] as string)
      return now === ref ? shown(ref) : { ...shown(now), mergedInto: now }
    },
    async peopleMerge(refs) {
      const joined = [refs[0] ?? ""]
      const confirmed: string[] = []
      const left = refs.slice(1)
      const stop = (why: string) => {
        if (confirmed.length === 0) throw new Error(why)
        return { person: shown(current(joined[0] ?? "")), joined, confirmed, stopped: why }
      }
      while (left.length > 0) {
        const kept = current(joined[0] ?? "")
        const pair = (ref: string) =>
          matches.find((x) => x.joins !== "identity" && x.persons.includes(kept) && x.persons.includes(current(ref)))
        const at = left.findIndex((ref) => pair(ref))
        const m = at < 0 ? undefined : pair(left[at] ?? "")
        if (!m) return stop("No open match joins them any more. Read again.")
        if (fail === "merge" && confirmed.length > 0) return stop("identity.stale")
        await api.peopleDecide(kept, m.id, "confirm")
        confirmed.push(m.id)
        joined.push(left.splice(at, 1)[0] ?? "")
      }
      return { person: shown(current(joined[0] ?? "")), joined, confirmed, stopped: null }
    },
    async peopleUnlink(ref, identities) {
      await write()
      const p = find(ref)
      const moved = p.identities.filter((i) => identities.includes(i.identity))
      const to = `person:${next++}`
      people = [
        ...people.map((x) =>
          x.ref === ref ? { ...x, identities: x.identities.filter((i) => !moved.includes(i)) } : x,
        ),
        { ref: to, name: moved[0]?.name ?? null, mergedInto: null, identities: moved, merges: [] },
      ]
      return { person: shown(ref), movedTo: to }
    },
    async peopleUnmerge(ref, merge) {
      await write()
      const p = find(ref)
      const undone = p.merges.find((m) => m.id === merge)
      if (!undone) throw new Error("This merge is not on this person any more. Read again.")
      const back = p.identities.filter((i) => undone.identities.includes(i.identity))
      people = [
        ...people.map((x) =>
          x.ref !== ref
            ? x
            : {
                ...x,
                identities: x.identities.filter((i) => !back.includes(i)),
                merges: x.merges.filter((m) => m.id !== merge),
              },
        ),
        { ref: undone.from, name: back[0]?.name ?? null, mergedInto: null, identities: back, merges: [] },
      ]
      return shown(ref)
    },
  }
  return api
}
