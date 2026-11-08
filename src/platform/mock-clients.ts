import type { CrmAccount, CrmCard, CrmKind, CrmRead, CrmStage } from "./bindings"
import { delay } from "./mock-delay"
import type { CrmScope, Platform } from "./types"

// The Clients page's stand-in for memo, with made-up companies and people only (Acme, Northstar). The owner's own
// Sales pipeline moves; the Northstar portal's is a CRM copy, read-only as in the real app until its CLI is in the
// catalog. `?clients=` none (no deals or leads yet), missing (no memo), old (memo too old), fail (the read fails),
// loading (it never ends), crm-write (the portal's copies move and its scope switches, as once b24 is in the
// catalog), move-fail (every move is refused), many (300 deals); `?kind=lead` opens the leads.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("clients") ?? "default"
const BUSY = "another process holds the store (store.busy); try again in a minute"

export const NORTHSTAR: CrmAccount = { provider: "bitrix24", account: "northstar.example" }

type Pipe = { ref: string; name: string; kind: CrmKind; account: CrmAccount | null; stages: [string, string][] }

const PIPES: Pipe[] = [
  {
    ref: "pipeline:2",
    name: "Sales",
    kind: "deal",
    account: null,
    stages: [
      ["Call", "open"],
      ["Quote", "open"],
      ["Contract", "open"],
      ["Won", "won"],
      ["Lost", "lost"],
    ],
  },
  {
    ref: "pipeline:7",
    name: "Northstar sales",
    kind: "deal",
    account: NORTHSTAR,
    stages: [
      ["New", "open"],
      ["Preparing documents", "open"],
      ["Invoice sent", "open"],
      ["Deal won", "won"],
      ["Deal lost", "lost"],
    ],
  },
  {
    ref: "pipeline:1",
    name: "Leads",
    kind: "lead",
    account: null,
    stages: [
      ["new", "open"],
      ["contacted", "open"],
      ["qualified", "open"],
      ["won", "won"],
      ["lost", "lost"],
    ],
  },
  {
    ref: "pipeline:8",
    name: "Northstar leads",
    kind: "lead",
    account: NORTHSTAR,
    stages: [
      ["Not processed", "open"],
      ["In progress", "open"],
      ["Good lead", "won"],
      ["Junk lead", "lost"],
    ],
  },
]

const person = (name: string, role: string) => ({ name, role })
const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

let id = 0
const card = (kind: CrmKind, pipe: string, stage: string, title: string, more: Partial<CrmCard> = {}): CrmCard => {
  id += 1
  const p = PIPES.find((x) => x.ref === pipe)
  return {
    ref: `${kind}:${id}`,
    title,
    pipeline: pipe,
    stage,
    status: p?.stages.find(([s]) => s === stage)?.[1] ?? "open",
    amount: null,
    currency: null,
    organization: null,
    people: [],
    closeDate: null,
    closedDate: null,
    closedReason: null,
    projectName: null,
    account: p?.account ?? null,
    createdAt: ago(id),
    updatedAt: ago(id / 2),
    ...more,
  }
}

const money = (amount: string, currency: string) => ({ amount, currency })

function seeds(): CrmCard[] {
  id = 0
  const own = (stage: string, title: string, more?: Partial<CrmCard>) => card("deal", "pipeline:2", stage, title, more)
  const portal = (stage: string, title: string, more?: Partial<CrmCard>) =>
    card("deal", "pipeline:7", stage, title, more)
  const lead = (pipe: string, stage: string, title: string, more?: Partial<CrmCard>) =>
    card("lead", pipe, stage, title, more)
  const many =
    scenario === "many"
      ? Array.from({ length: 300 }, (_, i) =>
          portal(["New", "Preparing documents", "Invoice sent"][i % 3] ?? "New", `Example order ${i + 1}`, {
            ...money(`${(i + 1) * 100}.00`, "EUR"),
            people: [person(i % 2 ? "Bob Lee" : "Alice Moreno", "owner")],
          }),
        )
      : []
  return [
    own("Quote", "Site for Northstar", {
      ...money("500000.00", "RUB"),
      organization: "Northstar Labs",
      people: [person("Alice Moreno", "decision-maker")],
      closeDate: "2026-12-01",
      projectName: "Northstar site",
    }),
    own("Call", "Support contract", { ...money("1200.00", "EUR"), organization: "Acme Corp" }),
    own("Won", "Logo refresh", { ...money("800.00", "EUR"), organization: "Acme Corp", closedDate: "2026-10-20" }),
    portal("New", "Northstar: 40 office chairs", {
      ...money("9600.00", "EUR"),
      organization: "Northstar Labs",
      people: [person("Bob Lee", "owner"), person("Dana Fox", "contact")],
      closeDate: "2026-11-30",
    }),
    portal("New", "Acme: meeting room", {
      ...money("3400.00", "EUR"),
      organization: "Acme Corp",
      people: [person("Alice Moreno", "owner")],
    }),
    portal("Preparing documents", "Northstar: standing desks", {
      ...money("12500.00", "EUR"),
      organization: "Northstar Labs",
      people: [person("Bob Lee", "owner"), person("Emma Ruiz", "decision-maker")],
      closeDate: "2026-12-15",
    }),
    portal("Invoice sent", "Acme: reception sofa", {
      ...money("2100.00", "EUR"),
      organization: "Acme Corp",
      people: [person("Alice Moreno", "owner")],
    }),
    portal("Invoice sent", "Unassigned enquiry from the site", { ...money("450.00", "USD") }),
    portal("Deal won", "Northstar: lamps", {
      ...money("700.00", "EUR"),
      organization: "Northstar Labs",
      people: [person("Bob Lee", "owner")],
      closedDate: "2026-10-28",
    }),
    portal("Deal lost", "Acme: carpets", {
      ...money("1800.00", "EUR"),
      organization: "Acme Corp",
      people: [person("Alice Moreno", "owner")],
      closedReason: "Example: chose another supplier",
    }),
    lead("pipeline:1", "new", "Call from the site"),
    lead("pipeline:1", "contacted", "Referral from Acme", { organization: "Acme Corp" }),
    lead("pipeline:8", "Not processed", "Form: office fit-out", { people: [person("Bob Lee", "owner")] }),
    lead("pipeline:8", "In progress", "Northstar: second office", {
      organization: "Northstar Labs",
      people: [person("Alice Moreno", "owner")],
    }),
    ...many,
  ]
}

const stagesOf = (pipe: Pipe, cards: CrmCard[]): CrmStage[] =>
  pipe.stages.map(([name, outcome]) => {
    const here = cards.filter((c) => c.pipeline === pipe.ref && c.stage === name)
    const sums = new Map<string, { units: number; items: number }>()
    for (const c of here) {
      if (!c.amount || !c.currency) continue
      const s = sums.get(c.currency) ?? { units: 0, items: 0 }
      sums.set(c.currency, { units: s.units + Math.round(Number(c.amount) * 100), items: s.items + 1 })
    }
    return {
      name,
      outcome,
      items: here.length,
      amounts: [...sums].map(([currency, s]) => ({ amount: (s.units / 100).toFixed(2), currency, items: s.items })),
    }
  })

type ClientsApi = Pick<Platform, "clientsRead" | "clientsMove" | "clientsScope" | "clientsScopeSet">

export function clientsMock(): ClientsApi {
  let cards = scenario === "none" ? [] : seeds()
  const scopes = new Map<string, "mine" | "all">()
  const writable = (pipe: Pipe | undefined) => pipe?.account === null || scenario === "crm-write"
  return {
    async clientsRead(kind, pipeline) {
      await delay(350)
      if (scenario === "loading") await new Promise(() => undefined)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.131.54", need: "0.131.56" }
      if (scenario === "fail") throw new Error(BUSY)
      const pipes = PIPES.filter((p) => p.kind === kind)
      const chosen = pipes.find((p) => p.ref === pipeline) ?? pipes[0]
      const read: CrmRead = {
        kind: "ready",
        pipelines: pipes.map(({ ref, name, account }) => ({ ref, name, account })),
        pipeline: chosen?.ref ?? null,
        stages: chosen ? stagesOf(chosen, cards) : [],
        cards: cards.filter((c) => c.pipeline === chosen?.ref).slice(0, 500),
        more: cards.filter((c) => c.pipeline === chosen?.ref).length > 500,
        movable: writable(chosen) ? { kind: "yes" } : { kind: "no", why: "crmCli" },
      }
      return read
    },
    async clientsMove(_kind, ref, stage) {
      await delay(600)
      if (scenario === "move-fail") throw new Error("the portal refused the change: access denied (crm.permission)")
      const found = cards.find((c) => c.ref === ref)
      const pipe = PIPES.find((p) => p.ref === found?.pipeline)
      const outcome = pipe?.stages.find(([s]) => s === stage)?.[1]
      if (!found || !outcome) throw new Error(`no stage ${stage} in this pipeline`)
      if (!writable(pipe)) throw new Error(`${ref} is a copy from bitrix24; change it there`)
      const moved = { ...found, stage, status: outcome, updatedAt: new Date().toISOString() }
      cards = cards.map((c) => (c.ref === ref ? moved : c))
      return moved
    },
    async clientsScope(account): Promise<CrmScope> {
      await delay(200)
      const scope = scopes.get(`${account.provider}:${account.account}`) ?? "mine"
      return scenario === "crm-write" ? { kind: "settable", scope } : { kind: "unavailable", scope, why: "crmCli" }
    },
    async clientsScopeSet(account, scope) {
      await delay(900)
      scopes.set(`${account.provider}:${account.account}`, scope)
    },
  }
}
