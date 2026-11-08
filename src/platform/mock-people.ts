import { delay } from "./mock-delay"
import type { Listed, Match, PersonDetail } from "./people-schemas"
import type { Platform } from "./types"

// The People page's stand-in for memo, with made-up people only. `?people=none` knows only the owner, `missing` has
// no memo, `old` an older memo. `?people-fail=read` fails the read (another sync holds the store),
// `?people-fail=write` fails every decision the same way, `?people-fail=stale` refuses a confirm as `identity.stale`.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("people")
const fail = params.get("people-fail")
const BUSY = "another process holds the store (store.busy); try again in a minute"

const DAY = 86_400_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

type Held = Omit<PersonDetail, "matches">

function seed(): Held[] {
  return [
    { ref: "person:1", name: null, mergedInto: null, identities: [], merges: [] },
    {
      ref: "person:7",
      name: "Lena Ortiz",
      mergedInto: null,
      identities: [
        {
          identity: "telegram:4411",
          provider: "telegram",
          name: "Lena",
          username: "lena_o",
          seenIn: [{ account: "1", scope: "personal" }],
          method: "account",
          linkedBy: "memo",
          linkedAt: ago(40 * DAY),
        },
        {
          identity: "email:lena@example.org",
          provider: "email",
          name: "Lena Ortiz",
          username: null,
          seenIn: [
            { account: "2", scope: "work" },
            { account: "3", scope: "personal" },
          ],
          method: "same-email",
          linkedBy: "memo",
          linkedAt: ago(12 * DAY),
        },
        {
          identity: "crm:acct/88",
          provider: "crm",
          name: "Lena O.",
          username: null,
          seenIn: [{ account: "acme", scope: "work" }],
          method: "manual",
          linkedBy: "owner",
          linkedAt: ago(3 * DAY),
        },
      ],
      merges: [
        {
          id: "merge:7-12",
          from: "person:12",
          identities: [{ identity: "email:lena@example.org", name: "Lena Ortiz" }],
          method: "same-email",
          by: "memo",
          at: ago(12 * DAY),
        },
      ],
    },
    {
      ref: "person:9",
      name: "Lena Ortiz",
      mergedInto: null,
      identities: [
        {
          identity: "max:9020",
          provider: "max",
          name: "Лена Ортис",
          username: null,
          seenIn: [{ account: "5", scope: "personal" }],
          method: "account",
          linkedBy: "memo",
          linkedAt: ago(20 * DAY),
        },
      ],
      merges: [],
    },
    {
      ref: "person:4",
      name: "Kai Moreno",
      mergedInto: null,
      identities: [
        {
          identity: "telegram:5120",
          provider: "telegram",
          name: "Kai",
          username: "kai_m",
          seenIn: [
            { account: "1", scope: "personal" },
            { account: "6", scope: "work" },
          ],
          method: "account",
          linkedBy: "memo",
          linkedAt: ago(60 * DAY),
        },
      ],
      merges: [],
    },
  ]
}

const MATCHES: Match[] = [
  {
    id: "17100",
    persons: ["person:7", "person:9"],
    summary: "telegram:4411 and max:9020",
    reason: "The same phone number, +34 600 000 000, and no one else has it.",
    evidence: ["telegram:4411", "max:9020"],
    proposedBy: "memo",
    createdAt: ago(DAY),
  },
]

export function peopleMock(): Pick<
  Platform,
  "peopleRead" | "peopleShow" | "peopleDecide" | "peopleUnlink" | "peopleUnmerge"
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
  const write = async () => {
    await delay(500)
    if (fail === "write") throw new Error(BUSY)
  }
  const listed = (p: Held): Listed => ({ ref: p.ref, name: p.name, owner: p.ref === "person:1", tasks: 0 })

  return {
    async peopleRead() {
      await delay(600)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.131.63", need: "0.132.0" }
      if (fail === "read") throw new Error(BUSY)
      return { kind: "ready", people: people.map(listed), matches }
    },
    async peopleShow(ref) {
      await delay(350)
      return shown(ref)
    },
    async peopleDecide(ref, id, answer, reason) {
      await write()
      const m = matches.find((x) => x.id === id && x.persons.includes(ref))
      if (!m) throw new Error("This match is not about this person any more. Read again.")
      if (answer === "reject" && !reason?.trim()) throw new Error("Say in a few words why they are not one person.")
      if (answer === "confirm" && fail === "stale") throw new Error("identity.stale")
      matches = matches.filter((x) => x.id !== id)
      if (answer === "confirm") {
        const [to, from] = m.persons as [string, string]
        const gone = find(from)
        people = people
          .filter((p) => p.ref !== from)
          .map((p) =>
            p.ref !== to
              ? p
              : {
                  ...p,
                  identities: [...p.identities, ...gone.identities],
                  merges: [
                    ...p.merges,
                    {
                      id: `merge:${to.slice(7)}-${from.slice(7)}`,
                      from,
                      identities: gone.identities.map((i) => ({ identity: i.identity, name: i.name })),
                      method: "manual",
                      by: "owner",
                      at: new Date().toISOString(),
                    },
                  ],
                },
          )
      }
      return shown(people.some((p) => p.ref === ref) ? ref : (m.persons[0] as string))
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
      const back = p.identities.filter((i) => undone.identities.some((u) => u.identity === i.identity))
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
}
