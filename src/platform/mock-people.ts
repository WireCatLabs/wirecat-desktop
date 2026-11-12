import { WHATSAPP_PHONE } from "@/domain/people"
import { delay } from "./mock-delay"
import { memoDefault } from "./mock-memo"
import {
  type Doubt,
  type Identity,
  type Listed,
  type Match,
  PERSON_KINDS,
  type PersonDetail,
  type Split,
} from "./people-schemas"
import type { PersonProfile } from "./person-profile-schemas"
import type { Platform } from "./types"

// The People page's stand-in for memo, with made-up people only, shaped like cli-memo #748's real answers
// (src-tauri/tests/fixtures/people). `?people=none` knows only the owner, `missing` has no memo, `old` an older memo,
// `more` says memo has more people and matches than were read. `?people-fail=read` fails the read (another sync holds
// the store), `?people=nokinds` is a memo older than kinds of people (one list of everyone, no contact),
// `?people-fail=write` fails every decision the same way, `?people-fail=stale` refuses Same person as
// `identity.stale`, `?people-mailbox=old` is a memo that gives a company no address on a match by name,
// `?people-company=old` one that cannot make the people of a match one company's mailboxes,
// `?people-fail=merge` refuses the second join of a group, `?people-fail=unnamed|ambiguous` refuses
// Company mailbox until the owner names the company or picks one of two. Two splits an agent proposed wait beside the
// matches and eight people look wrongly joined (`people links check`); `?people=calm` has neither.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("people") ?? memoDefault({ missing: "missing", old: "old" })
const fail = params.get("people-fail") ?? memoDefault({ failing: "read" })
const BUSY = "another process holds the store (store.busy); try again in a minute"

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

type Held = Omit<PersonDetail, "matches" | "displayName">

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
  phone: null,
  email: null,
  phones: [],
  emails: [],
  seenIn: seen.map(([id, scope]) => ({ account: id, scope })),
  method,
  linkedAt: ago(days * DAY),
  movable: true,
  bot: false,
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
      {
        ...account(
          "bitrix24:https://northstar.example/crm/contact/details/5310/",
          "Konstantin Nikolaevich Loft Pro Max Semenov",
          [["acme", "work"]],
          "initial",
          14,
        ),
        // A CRM contact holds several of each, as a Bitrix24 card does.
        phone: "+34 910 000 333",
        phones: ["+34 910 000 333", "+34 910 000 334"],
        emails: ["k.semenov@loft.example", "konstantin@mail.example"],
      },
    ]),
    person("person:31", "Konstantin", [
      account("telegram:7012", "Konstantin", [["1", "personal"]], "initial", 70, "kostya_s"),
      account("max:4410", "Костя", [["5", "personal"]], "same-phone", 30),
    ]),
    person("person:32", "K. Semenov", [account("whatsapp:34600555019", "K. Semenov", [["7", "work"]], "initial", 4)]),
    person("person:33", "Сергей", [
      account("bitrix24:northstar.example/contact/7731", "Сергей", [["acme", "personal"]], "initial", 1),
    ]),
    person("person:34", "Сергей", [
      account("bitrix24:northstar.example/contact/7733", "Сергей", [["acme", "personal"]], "initial", 1),
    ]),
    person("person:40", "Viktor Example", [
      account("telegram:7001", "Viktor", [["1", "personal"]], "initial", 60, "viktor_ex"),
      account("email:viktor@example.org", "Viktor Example", [["2", "work"]], "same-email", 50),
      account("max:7002", "Mila Example", [["5", "personal"]], "same-phone", 30),
    ]),
    person("person:41", "Harbour Studio", [
      account("email:info@harbour.example", "Harbour Studio", [["2", "work"]], "initial", 45),
    ]),
    person("person:42", "Olga Harbour", [
      account("telegram:7301", "Olga", [["1", "personal"]], "initial", 40, "olga_h"),
      account("email:olga@harbour.example", "Olga Harbour", [["2", "work"]], "initial", 20),
    ]),
    person("person:43", "Pavel Harbour", [
      account("email:pavel@harbour.example", "Pavel Harbour", [["2", "work"]], "initial", 18),
    ]),
    // The owner's real data: a stored name with no letter, a WhatsApp @lid with no number, MAX's «.» and a bot.
    person("person:44", "—", [
      account("email:ops@msx.example", null, [["me@work.example", "work"]], "initial", 50),
      account("telegram:4402", null, [["1001", "personal"]], "same-email", 20, "msx04x"),
    ]),
    // A stored name of two letters while the CRM knows the whole one, and a person made of test data alone.
    person("person:47", "Вр", [
      account("bitrix24:northstar.example/user/3327", "Богдан Постушенко", [["acme", "work"]], "initial", 6),
      account("email:bogdan@northstar.example", "Богдан Постушенко", [["2", "work"]], "same-email", 6),
    ]),
    person("person:48", null, [account("email:test@test.test", null, [["2", "work"]], "initial", 3)]),
    person("person:49", "Ann Lee", [account("whatsapp:11", "Ann Lee", [["7", "personal"]], "initial", 3)]),
    person("person:45", "Eky", [
      account("whatsapp:157724520243314@lid", "Claudio Тренер", [["34600000001", "personal"]], "initial", 20),
    ]),
    person("person:46", "Dmitry Volkov", [
      account(
        "telegram:6611",
        "Dmitry",
        [
          ["1001", "personal"],
          ["1002", "work"],
        ],
        "initial",
        30,
        "dvolkov",
      ),
      account("max:6610", ".", [["2001", "personal"]], "same-phone", 12),
      {
        ...account("telegram:6612", "Sirgris Personal Bot", [["1001", "personal"]], "manual", 2, "sirgris_bot"),
        bot: true,
      },
    ]),
    // A Telegram bot memo has no bot flag for: only its username says so.
    person("person:50", "Бездушная Машина", [
      account("telegram:7750", "Бездушная Машина", [["1001", "personal"]], "initial", 5, "vas3k_club_bot"),
    ]),
    ...crowd(),
  ]
}

const SPLITS: Split[] = [
  {
    id: "901",
    person: "person:40",
    op: "unlink",
    identities: ["max:7002"],
    merge: null,
    reason: "The MAX account is Mila's, Viktor's wife: another name, and she writes about Viktor as «he».",
    evidence: ["max:7002", "telegram:7001"],
    proposer: { kind: "agent", name: "claude-code" },
  },
  {
    id: "902",
    person: "person:7",
    op: "unmerge",
    identities: ["email:lena@example.org"],
    merge: "merge:7-12",
    reason: "This address is the studio's shared inbox; three people sign from it.",
    evidence: ["email:lena@example.org", "merge:7-12"],
    proposer: { kind: "agent", name: "openclaw" },
  },
]

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

const UNSHARED = { score: 0.9, shared: null, mailbox: null }

/** In memo's order: highest score first, the agent's (no score) last. */
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
    ...UNSHARED,
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
    ...UNSHARED,
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
      ...UNSHARED,
      score: 0.8,
    }),
  ),
  // As memo gave the owner's real one (UX-150): a phone match with no evidence, so the number comes from the profiles.
  {
    id: "17106",
    persons: ["person:33", "person:34"],
    identity: "bitrix24:northstar.example/contact/7731",
    with: "bitrix24:northstar.example/contact/7733",
    joins: "person",
    signal: "phone",
    candidates: [],
    reason: null,
    evidence: [],
    proposer: { kind: "rule", name: "rule" },
    ...UNSHARED,
    score: 0.7,
  },
  // One shared mailbox three people sign from: memo suggests the pairs and never joins them by itself.
  ...(
    [
      ["17107", "person:41", "person:42"],
      ["17108", "person:41", "person:43"],
      ["17109", "person:42", "person:43"],
    ] as const
  ).map(
    ([id, a, b]): Match => ({
      id,
      persons: [a, b],
      identity: a === "person:41" ? "email:info@harbour.example" : "email:olga@harbour.example",
      with: b === "person:42" ? "email:olga@harbour.example" : "email:pavel@harbour.example",
      joins: "person",
      signal: "email",
      candidates: [],
      reason: null,
      evidence: ["info@harbour.example"],
      proposer: { kind: "rule", name: "rule" },
      score: 0.4,
      shared: "role",
      mailbox: "info@harbour.example",
    }),
  ),
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
    ...UNSHARED,
    score: null,
  },
]

export function peopleMock(): Pick<
  Platform,
  | "peopleRead"
  | "peopleKinds"
  | "peoplePage"
  | "peopleShow"
  | "peopleFind"
  | "peopleDecide"
  | "peopleResolve"
  | "peopleOneCompany"
  | "peopleMerge"
  | "peopleUnlink"
  | "peopleCheck"
  | "peopleAdd"
  | "peopleUnmerge"
  | "peopleSplitDecide"
  | "peopleDoubts"
  | "peopleKeep"
  | "peopleTestData"
  | "peopleTestPeople"
  | "peopleContact"
> {
  const company: Held[] = ["pro", "b2bmail"].map((box, i) => ({
    ref: `person:${90 + i}`,
    name: i === 0 ? "Билайн бизнес" : "билайн бизнес",
    mergedInto: null,
    identities: [account(`email:${box}@beeline.ru`, "Билайн бизнес", [["email:work", "work"]], "import", 12)],
    merges: [],
  }))
  // As memo words it for a name match on one company's mail: the card must not show this sentence.
  const sameCompany: Match = {
    id: "17190",
    persons: ["person:90", "person:91"],
    identity: "email:pro@beeline.ru",
    with: "email:b2bmail@beeline.ru",
    joins: "person",
    signal: "name",
    candidates: [],
    reason: "same name «Билайн бизнес» and mail at the same company, beeline.ru",
    evidence: [],
    proposer: { kind: "rule", name: "rule" },
    score: 0.5,
    shared: null,
    mailbox: null,
  }
  let people = scenario === "none" ? seed().slice(0, 1) : scenario === "company" ? [...seed(), ...company] : seed()
  let matches = scenario === "none" ? [] : scenario === "company" ? [sameCompany, ...MATCHES] : [...MATCHES]
  let splits = scenario === "none" || scenario === "calm" ? [] : [...SPLITS]
  const kept = new Set<string>()
  // As memo: an address at a reserved test domain is hidden without asking.
  const hidden = new Set<string>(scenario === "none" ? [] : ["person:48"])
  let next = 60
  /** As `people links check`: only while the person still holds the doubted accounts. */
  const doubts = (): Doubt[] => {
    if (scenario === "none" || scenario === "calm") return []
    const holds = (ref: string, identity: string) =>
      people.some((p) => p.ref === ref && p.identities.length > 1 && p.identities.some((i) => i.identity === identity))
    const of = (ref: string, reason: string, ids: string[], moves: Doubt["moves"]): Doubt[] => {
      const p = people.find((x) => x.ref === ref)
      if (!p || kept.has(ref) || hidden.has(ref) || !ids.every((id) => holds(ref, id))) return []
      const identities = ids.map((id) => ({
        identity: id,
        name: p.identities.find((i) => i.identity === id)?.name ?? null,
      }))
      return [{ person: ref, name: p.name, owner: false, reason, identities, moves }]
    }
    const test = people
      .filter((p) => Number(p.ref.slice(7)) >= 100 && p.identities.some((i) => i.provider === "email"))
      .slice(0, 6)
      .flatMap((p) => {
        const email = p.identities.find((i) => i.provider === "email")?.identity ?? ""
        return of(p.ref, "test-data", [email], [{ op: "unlink", identities: [email] }])
      })
    // A seed name alone may be a real person's: memo asks, and the card offers test data or a real contact.
    const seedName =
      people.some((p) => p.ref === "person:49") && !kept.has("person:49") && !hidden.has("person:49")
        ? [
            {
              person: "person:49",
              name: "Ann Lee",
              owner: false,
              reason: "test-data",
              identities: [{ identity: "whatsapp:11", name: "Ann Lee" }],
              moves: [],
            },
          ]
        : []
    return [
      ...seedName,
      ...of("person:40", "mixed-names", ["max:7002"], [{ op: "unlink", identities: ["max:7002"] }]),
      ...of("person:7", "shared-address", ["email:lena@example.org"], [{ op: "unmerge", merge: "merge:7-12" }]),
      ...of("person:44", "shared-address", ["email:ops@msx.example", "telegram:4402"], []),
      ...test,
    ]
  }

  const find = (ref: string): Held => {
    const p = people.find((x) => x.ref === ref)
    if (!p) throw new Error("person.not-found")
    return p
  }
  const shown = (ref: string): PersonDetail => ({
    ...find(ref),
    displayName: display(find(ref)),
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
  /** As memo's display_name: the name unquoted, else a handle, phone or email. */
  const display = (p: Held) => {
    const name = p.name?.replace(/^["\s]+|["\s]+$/g, "") ?? ""
    if (/\p{L}/u.test(name) && !/^(null|Без имени)$/.test(name) && !name.includes("#")) return name
    const id = p.identities.find((i) => i.username)
    return id?.username ? `@${id.username}` : (contactOf(p) ?? null)
  }
  const identityValue = (p: Held, provider: string) =>
    p.identities.find((i) => i.provider === provider)?.identity.split(":")[1]
  const contactOf = (p: Held) => {
    const value = (provider: string) => identityValue(p, provider)
    const phone = WHATSAPP_PHONE.exec(value("whatsapp") ?? "")?.[1]
    const username = p.identities.find((i) => i.username)?.username
    return phone ? `+${phone}` : (value("email") ?? (username ? `@${username}` : null))
  }
  const rank = (p: Held) => Number(p.ref.slice(7))
  const listed = (p: Held): Listed => {
    const owner = p.ref === "person:1"
    const base = { ref: p.ref, name: p.name, owner, tasks: TASKS[p.ref] ?? 0 }
    if (scenario === "nokinds")
      return {
        ...base,
        displayName: null,
        kind: null,
        contact: null,
        phone: null,
        email: null,
        username: null,
        usernameSource: null,
        messagesFrom: null,
        lastContact: null,
        bot: false,
      }
    const n = rank(p)
    return {
      ...base,
      displayName: owner ? null : display(p),
      kind: KIND[p.ref] ?? "person",
      contact: contactOf(p),
      phone: WHATSAPP_PHONE.test(identityValue(p, "whatsapp") ?? "") ? `+${identityValue(p, "whatsapp")}` : null,
      email: identityValue(p, "email") ?? null,
      username: p.identities.find((i) => i.username)?.username ?? null,
      usernameSource: p.identities.find((i) => i.username)?.provider ?? null,
      messagesFrom: owner ? null : n < 100 ? 1000 - n : (n * 37) % 410,
      lastContact: ago((n % 30) * 3_600_000 * 7),
      bot: p.identities.length > 0 && p.identities.every((i) => i.bot),
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
      const companyMailbox = params.get("people-mailbox") !== "old"
      const oneCompany = params.get("people-company") !== "old"
      return {
        kind: "ready",
        people: listing,
        peopleMore: more,
        matches,
        matchesMore: more,
        splits,
        kinded,
        companyMailbox,
        oneCompany,
      }
    },
    async peoplePage({ kind, page, size, query, sort }) {
      await delay(400)
      if (fail === "read") throw new Error(BUSY)
      const q = query.trim().toLowerCase()
      const rows = ofKind(kind)
        .filter((p) => !q || (p.displayName ?? p.name ?? "").toLowerCase().includes(q))
        .sort((a, b) => {
          if (a.owner !== b.owner) return Number(b.owner) - Number(a.owner)
          if (sort === "name") return (a.displayName ?? "").localeCompare(b.displayName ?? "")
          if (sort === "tasks") return b.tasks - a.tasks
          if (sort === "recent") return (b.lastContact ?? "").localeCompare(a.lastContact ?? "")
          return (b.messagesFrom ?? 0) - (a.messagesFrom ?? 0)
        })
      return {
        people: rows.slice((page - 1) * size, page * size),
        total: { value: rows.length, more: false },
        more: page * size < rows.length,
      }
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
    async peopleResolve(ref, id, to) {
      await write()
      const m = matches.find((x) => x.id === id && shown(ref).matches.includes(x))
      if (!m) throw new Error("This match is not open on this person any more. Read again.")
      const refused = (reason: string, message: string, organizations: { ref: string; name: string | null }[] = []) =>
        ({ kind: "refused", reason, message, organizations }) as const
      if (!m.shared) {
        // As memo 0.131.86: on a match by name, the company's address is one of the two people's that the owner names.
        const held = m.persons.flatMap((p) =>
          find(p).identities.flatMap((i) => (i.identity.startsWith("email:") ? [i.identity.slice(6)] : [])),
        )
        if (!to.mailbox || !held.includes(to.mailbox))
          return refused(
            "identity.not-shared",
            `${id} is not about a shared mailbox; name which of the two people's addresses is the company's: ${held.join(", ")}`,
          )
        if (fail === "unnamed" && !to.name && !to.organization)
          return refused("organization.unnamed", `${to.mailbox}: name the company or its organization`)
        matches = matches.filter((x) => x.id !== id)
        return {
          kind: "done",
          organization: to.organization ?? "organization:3",
          mailbox: to.mailbox,
          person: shown(ref),
        }
      }
      if (fail === "unnamed" && !to.name && !to.organization)
        return refused("organization.unnamed", `${m.mailbox} is a free mailbox; name the company or its organization`)
      if (fail === "ambiguous" && !to.organization)
        return refused(
          "organization.ambiguous",
          "2 organizations match harbour.example (organization:3, organization:8); name the one meant as a reference",
          [
            { ref: "organization:3", name: "Harbour Studio" },
            { ref: "organization:8", name: "Harbour Studio Ltd" },
          ],
        )
      matches = matches.filter((x) => x.id !== id)
      return { kind: "done", organization: to.organization ?? "organization:3", mailbox: m.mailbox, person: shown(ref) }
    },
    async peopleOneCompany(id, to) {
      await write()
      const m = matches.find((x) => x.id === id)
      if (!m) throw new Error("This match is not open any more. Read again.")
      if (fail === "unnamed" && !to.name && !to.organization)
        return {
          kind: "refused",
          reason: "organization.unnamed",
          message: `${id}: name the company or its organization`,
          organizations: [],
        }
      const moved = m.persons
      const mailboxes = moved.flatMap((p) =>
        find(p).identities.flatMap((i) => (i.identity.startsWith("email:") ? [i.identity.slice(6)] : [])),
      )
      const closed = matches.filter((x) => x.persons.some((p) => moved.includes(p))).map((x) => x.id)
      matches = matches.filter((x) => !closed.includes(x.id))
      const name = to.name ?? (to.organization ? null : find(moved[0] ?? "").name)
      people = people.filter((p) => !moved.includes(p.ref))
      return {
        kind: "organized",
        organization: to.organization ?? "organization:5",
        name,
        mailboxes,
        people: moved,
        closed,
      }
    },
    async peopleDecide(ref, id, answer, reason) {
      await write()
      const m = matches.find((x) => x.id === id && shown(ref).matches.includes(x))
      if (!m) throw new Error("This match is not open on this person any more. Read again.")
      if (answer === "reject" && !reason?.trim()) throw new Error("Say in a few words why they belong together.")
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
      // In the order given, as memo: the first account names the new person.
      const moved = identities.flatMap((id) => p.identities.filter((i) => i.identity === id))
      const to = `person:${next++}`
      people = [
        ...people.map((x) =>
          x.ref === ref ? { ...x, identities: x.identities.filter((i) => !moved.includes(i)) } : x,
        ),
        { ref: to, name: moved[0]?.name ?? null, mergedInto: null, identities: moved, merges: [] },
      ]
      return { person: shown(ref), movedTo: to }
    },
    async peopleCheck(name) {
      await delay(250)
      const typed = name.trim().toLocaleLowerCase()
      const words = (p: Held) => (display(p) ?? "").toLocaleLowerCase()
      return people
        .filter((p) => p.ref !== "person:1" && !hidden.has(p.ref) && typed && words(p).startsWith(typed))
        .map((p) => ({ ...listed(p), sameName: words(p) === typed }))
        .sort((a, b) => Number(b.sameName) - Number(a.sameName))
        .slice(0, 8)
    },
    async peopleAdd(name) {
      await write()
      const ref = `person:${next++}`
      people = [{ ref, name: name.trim(), mergedInto: null, identities: [], merges: [] }, ...people]
      return ref
    },
    async peopleSplitDecide(ref, id, answer, reason) {
      await write()
      const split = splits.find((x) => x.id === id && x.person === ref)
      if (!split) throw new Error("proposal.wrong-state")
      if (answer === "reject" && !reason?.trim()) throw new Error("Say in a few words why they belong together.")
      if (answer === "confirm" && fail === "stale") throw new Error("identity.stale")
      splits = splits.filter((x) => x.id !== id)
      if (answer === "reject") return shown(ref)
      if (split.op === "unmerge" && split.merge) return api.peopleUnmerge(ref, split.merge)
      return (await api.peopleUnlink(ref, split.identities)).person
    },
    async peopleKeep(reference) {
      await delay(400)
      if (params.get("people-fail") === "keep-old") throw new Error("memo.too-old")
      if (params.get("people-fail") === "write") throw new Error("person.no-doubt")
      kept.add(reference)
      hidden.delete(reference)
    },
    async peopleTestData(reference) {
      await delay(400)
      if (params.get("people-fail") === "keep-old") throw new Error("memo.too-old")
      if (params.get("people-fail") === "write") throw new Error("person.unknown")
      hidden.add(reference)
    },
    async peopleTestPeople() {
      await delay(300)
      if (fail === "read") throw new Error(BUSY)
      const items = people
        .filter((p) => hidden.has(p.ref))
        .map((p) => ({ person: p.ref, name: display(p) ?? p.identities[0]?.identity.split(":")[1] ?? null }))
      return { items, total: items.length }
    },
    async peopleContact() {
      await delay(300)
      if (params.get("people-fail") === "write") throw new Error("person.unknown")
    },
    async peopleDoubts(page, size) {
      await delay(450)
      if (fail === "read") throw new Error(BUSY)
      const all = doubts()
      return { items: all.slice((page - 1) * size, page * size), total: all.length, more: page * size < all.length }
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

const EMPTY_PROFILE: PersonProfile = {
  phones: [],
  emails: [],
  organizations: [],
  lastContact: null,
  messagesFrom: null,
  tasks: null,
  tasksMore: false,
  deals: 0,
  recent: [],
}

const said = (days: number, text: string, outgoing: boolean, chat: string, provider = "telegram", n = days) => ({
  kind: "message",
  at: ago(days * DAY),
  text,
  outgoing,
  provider,
  chat,
  locator: `msg:${provider}/1/2/${30 + n}`,
})

/** What each made-up person's context says; the rest have none. Phones are 555 numbers, made up. */
const PROFILES: Record<string, Partial<PersonProfile>> = {
  "person:7": {
    phones: ["+34 600 111 222"],
    emails: ["lena@example.org"],
    organizations: [{ name: "Acme Studio", role: "Producer" }],
    lastContact: ago(2 * DAY),
    messagesFrom: 993,
    tasks: 3,
    deals: 2,
    recent: [
      said(2, "Sending the cut tonight, can you check the colour on scene 4?", false, "Lena"),
      said(3, "Sure, after 6.", true, "Lena"),
      said(9, "Invoice for October attached.", false, "Lena Ortiz", "email"),
    ],
  },
  "person:9": {
    phones: ["+34 600 111 222"],
    lastContact: ago(20 * DAY),
    messagesFrom: 4,
    recent: [said(20, "Привет! Это Лена, мой новый номер.", false, "Лена Ортис", "max")],
  },
  "person:33": {
    phones: ["+7 912 555-01-47"],
    emails: ["s.volkov@northstar.example"],
    organizations: [{ name: "Northstar Logistics", role: "Закупки" }],
    lastContact: ago(6 * DAY),
    messagesFrom: 0,
    tasks: 1,
    deals: 3,
    recent: [
      {
        kind: "event",
        at: ago(6 * DAY),
        text: "Созвон по поставке",
        outgoing: null,
        provider: null,
        chat: null,
        locator: null,
      },
    ],
  },
  "person:34": {
    phones: ["+7 912 555-01-47", "+7 495 555-20-10"],
    lastContact: ago(41 * DAY),
    messagesFrom: 0,
    deals: 1,
  },
}

/** `memo context` and the person's row for the match dialog; `?people-fail=profile` fails every read. */
export function peopleProfileMock(): Pick<Platform, "peopleProfile"> {
  return {
    async peopleProfile(ref) {
      await delay(450)
      if (fail === "profile") throw new Error(BUSY)
      return { ...EMPTY_PROFILE, ...PROFILES[ref] }
    },
  }
}
