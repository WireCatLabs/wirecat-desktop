import type { AgentMerge, PersonDetail, Strength } from "./people-schemas"

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
