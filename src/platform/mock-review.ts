import type { AgentMerge, Match, MatchSide, PersonDetail, Strength } from "./people-schemas"

const weak = (why: string, kind?: string, value?: string, others = 0): Strength => ({
  strong: false,
  weak: why,
  facts: kind && value ? [{ kind, value, others, strong: false, weak: why }] : [],
})

/** Why memo did not join a mock match on its own, as it words it. */
export const WEAK = {
  company: weak("company", "phone", "+34912400188"),
  role: weak("role-address", "email", "info@harbour.example", 1),
  nothing: weak("nothing-shared"),
}

/** An agent's join on Nora's mobile, as `people show` lists it on her. */
export const NORA_MERGE: PersonDetail["merges"][number] = {
  id: "merge:60-61",
  from: "person:61",
  identities: ["whatsapp:34600606060"],
  method: "agent",
  at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  agent: { name: "claude-code", reason: "Nora's mobile is the same in Telegram and WhatsApp." },
}

/** As memo's `people review --kind merged`: an agent's join is listed until it is undone. */
export const agentMergesOf = (people: Pick<PersonDetail, "ref" | "merges">[]): AgentMerge[] =>
  people.flatMap((p) =>
    p.merges
      .filter((m) => m.method === "agent")
      .map((m) => ({
        id: m.id,
        person: p.ref,
        from: m.from,
        identities: m.identities,
        agent: m.agent?.name ?? null,
        reason: m.agent?.reason ?? null,
        at: m.at,
        evidence: {
          strong: true,
          weak: null,
          facts: [{ kind: "phone", value: "+34600606060", others: 0, strong: true, weak: null }],
        },
      })),
  )

const DAY = 24 * 3600 * 1000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const said = (days: number, source: string, text: string, fromMe = false) => ({
  at: ago(days),
  kind: "message",
  source,
  from_me: fromMe,
  text,
})

/** As memo's review gives each person of a match: last messages or calls, companies and deals. */
const SIDES: Record<string, MatchSide> = {
  "person:7": {
    person: "person:7",
    last: [
      said(1, "telegram", "Sending the signed contract tonight, sorry for the delay."),
      { at: ago(3), kind: "call", source: "phone", from_me: true, text: "Call with Lena about the Harbour fit-out" },
    ],
    organizations: ["Acme Ltd"],
    deals: ["Harbour fit-out · Contract"],
  },
  "person:9": {
    person: "person:9",
    last: [said(2, "max", "Лена, это мой новый номер в MAX. Договор подпишу в четверг.")],
    organizations: [],
    deals: [],
  },
  "person:21": {
    person: "person:21",
    last: [said(6, "whatsapp", "Here are the photos of the studio floor plan", true)],
    organizations: ["Studio Gil"],
    deals: [],
  },
  "person:22": { person: "person:22", last: [], organizations: ["Studio Gil"], deals: ["Studio rebrand · Proposal"] },
}

/** A mock match with its people's context, as a memo that merges for agents reads it. */
export const withSides = (match: Match): Match => ({
  ...match,
  sides: match.persons.flatMap((person) => (SIDES[person] ? [SIDES[person]] : [])),
})
