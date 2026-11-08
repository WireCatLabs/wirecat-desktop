import { busiestOf } from "@/domain/clients"
import type { CrmAccount, CrmBaseEdit, CrmCard, CrmKind, CrmRead, CrmStage, CrmStageMap } from "./bindings"
import { delay } from "./mock-delay"
import type { CrmAppliedScope, CrmScope, Platform } from "./types"

// The Clients page's stand-in for memo, with made-up companies and people only (Acme, Northstar). The owner's own
// Sales pipeline moves; the Northstar portal's is a CRM copy, read-only as in the real app until its CLI is in the
// catalog. `?clients=` none (no deals or leads yet), missing (no memo), old (memo too old), fail (the read fails),
// loading (it never ends), crm-write (the portal's copies move and its scope switches, as once b24 is in the
// catalog), move-fail (every move is refused), many (300 deals); `?kind=lead` opens the leads.
//
// By default memo has base stages: the board's columns are the base set and every pipeline's cards stand under the
// base stage their stage points to. Sales and Northstar sales map onto it: Sales' Quote and Contract both onto
// Proposal (a drop there asks which) and none onto New or Negotiation (a drop there is refused), Northstar's "Waiting
// for payment" onto nothing; Partners and Northstar's "In progress" lead stage are suggestions not confirmed yet. `?clients=no-base` is a memo without
// base stages: one pipeline's own stages, as before.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("clients") ?? "default"
const BUSY = "another process holds the store (store.busy); try again in a minute"

export const NORTHSTAR: CrmAccount = { provider: "bitrix24", account: "northstar.example" }

type Pipe = {
  ref: string
  name: string
  kind: CrmKind
  account: CrmAccount | null
  stages: [string, string][]
  /** The base set's own pipeline: listed only when memo has base stages. */
  base?: true
}

const ALL_PIPES: Pipe[] = [
  {
    ref: "pipeline:20",
    name: "Deal stages",
    kind: "deal",
    account: null,
    base: true,
    stages: [
      ["New", "open"],
      ["Qualification", "open"],
      ["Proposal", "open"],
      ["Negotiation", "open"],
      ["Won", "won"],
      ["Lost", "lost"],
    ],
  },
  {
    ref: "pipeline:21",
    name: "Lead stages",
    kind: "lead",
    account: null,
    base: true,
    stages: [
      ["New", "open"],
      ["Contacted", "open"],
      ["Qualified", "open"],
      ["Converted", "won"],
      ["Rejected", "lost"],
    ],
  },
  // Listed first and empty, as memo listed them for a real account: the board must not open on it.
  {
    ref: "pipeline:3",
    name: "Partners",
    kind: "deal",
    account: null,
    stages: [
      ["Intro", "open"],
      ["Signed", "won"],
      ["Dropped", "lost"],
    ],
  },
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
      ["Waiting for payment", "open"],
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
  const p = ALL_PIPES.find((x) => x.ref === pipe)
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
    baseStage: null,
    createdAt: ago(id),
    updatedAt: ago(id / 2),
    ...more,
  }
}

const money = (amount: string, currency: string) => ({ amount, currency })

function seeds(based: boolean): CrmCard[] {
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
    ...["Kiosk", "Newsletter", "Shop front", "Signage"].map((what) =>
      own("Contract", `Acme: ${what.toLowerCase()}`, { ...money("2500.00", "EUR"), organization: "Acme Corp" }),
    ),
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
    ...(based
      ? [
          portal("Waiting for payment", "Northstar: printer lease", {
            ...money("640.00", "EUR"),
            organization: "Northstar Labs",
            people: [person("Bob Lee", "owner")],
          }),
          card("deal", "pipeline:3", "Intro", "Acme: reseller agreement", { organization: "Acme Corp" }),
          card("deal", "pipeline:20", "Negotiation", "Acme: yearly audit", {
            ...money("4200.00", "EUR"),
            organization: "Acme Corp",
          }),
        ]
      : []),
    ...many,
  ]
}

type Base = { ref: string; name: string; outcome: string }

// Each pipeline's stage → the base stage's name and whether the owner confirmed it; a stage left out is unmapped.
const MAPS: Record<string, Record<string, [string, boolean]>> = {
  "pipeline:2": {
    Call: ["Qualification", true],
    Quote: ["Proposal", true],
    Contract: ["Proposal", true],
    Won: ["Won", true],
    Lost: ["Lost", true],
  },
  "pipeline:7": {
    New: ["New", true],
    "Preparing documents": ["Qualification", true],
    "Invoice sent": ["Negotiation", true],
    "Deal won": ["Won", true],
    "Deal lost": ["Lost", true],
  },
  "pipeline:3": { Intro: ["New", false], Signed: ["Won", false], Dropped: ["Lost", false] },
  "pipeline:1": {
    new: ["New", true],
    contacted: ["Contacted", true],
    qualified: ["Qualified", true],
    won: ["Converted", true],
    lost: ["Rejected", true],
  },
  "pipeline:8": {
    "Not processed": ["New", true],
    "In progress": ["Contacted", false],
    "Good lead": ["Converted", true],
    "Junk lead": ["Rejected", true],
  },
}

function baseSeeds() {
  let n = 100
  const bases: Record<CrmKind, Base[]> = { deal: [], lead: [] }
  for (const p of ALL_PIPES.filter((x) => x.base)) {
    bases[p.kind] = p.stages.map(([name, outcome]) => {
      n += 1
      return { ref: `stage:${n}`, name, outcome }
    })
  }
  const mapping: CrmStageMap[] = []
  for (const p of ALL_PIPES.filter((x) => !x.base)) {
    for (const [name, outcome] of p.stages) {
      n += 1
      const [to, confirmed] = MAPS[p.ref]?.[name] ?? [null, false]
      const b = bases[p.kind].find((x) => x.name === to)
      const base = b ? { ref: b.ref, name: b.name } : null
      mapping.push({ ref: `stage:${n}`, name, outcome, pipeline: p.ref, items: 0, base, confirmed })
    }
  }
  return { bases, mapping }
}

const stagesOf = (pipe: Pipe, cards: CrmCard[]): CrmStage[] =>
  pipe.stages.map(([name, outcome]) => {
    const here = cards.filter((c) => c.pipeline === pipe.ref && c.stage === name)
    return { name, outcome, items: here.length, amounts: sumsOf(here) }
  })

type ClientsApi = Pick<
  Platform,
  | "clientsRead"
  | "clientsMove"
  | "clientsScope"
  | "clientsScopeSet"
  | "clientsMapSet"
  | "clientsMapConfirm"
  | "clientsBaseEdit"
>

const sumsOf = (here: CrmCard[]) => {
  const sums = new Map<string, { units: number; items: number }>()
  for (const c of here) {
    if (!c.amount || !c.currency) continue
    const s = sums.get(c.currency) ?? { units: 0, items: 0 }
    sums.set(c.currency, { units: s.units + Math.round(Number(c.amount) * 100), items: s.items + 1 })
  }
  return [...sums].map(([currency, s]) => ({ amount: (s.units / 100).toFixed(2), currency, items: s.items }))
}

/** `based` false is a memo without base stages, as `?clients=no-base`. */
export function clientsMock(based = scenario !== "no-base"): ClientsApi {
  const PIPES = ALL_PIPES.filter((p) => based || !p.base)
  let cards = scenario === "none" ? [] : seeds(based)
  const scopes = new Map<string, "mine" | "all">()
  const applied = new Map<string, CrmAppliedScope>()
  const writable = (pipe: Pipe | undefined) => pipe?.account === null || scenario === "crm-write"
  let { bases, mapping } = baseSeeds()
  const movable = (p: Pipe) => (writable(p) ? { kind: "yes" as const } : { kind: "no" as const, why: "crmCli" })
  const baseOf = (c: CrmCard) => {
    const pipe = PIPES.find((p) => p.ref === c.pipeline)
    if (pipe?.base) {
      const b = bases[pipe.kind].find((x) => x.name === c.stage)
      return b ? { ref: b.ref, name: b.name } : null
    }
    return mapping.find((m) => m.pipeline === c.pipeline && m.name === c.stage)?.base ?? null
  }
  const confirmedIn = (c: CrmCard) =>
    PIPES.find((p) => p.ref === c.pipeline)?.base === true ||
    mapping.some((m) => m.pipeline === c.pipeline && m.name === c.stage && m.confirmed)
  const baseRead = (kind: CrmKind): CrmRead => {
    const pipes = PIPES.filter((p) => p.kind === kind)
    const ours = cards
      .filter((c) => pipes.some((p) => p.ref === c.pipeline))
      .map((c) => ({ ...c, baseStage: baseOf(c) }))
    const open = (ref: string) => ours.filter((c) => c.pipeline === ref && c.status === "open").length
    return {
      kind: "base",
      pipelines: pipes.map((p) => ({
        ref: p.ref,
        name: p.name,
        account: p.account,
        open: open(p.ref),
        movable: movable(p),
      })),
      base: bases[kind].map((b) => {
        const here = ours.filter((c) => c.baseStage?.ref === b.ref && confirmedIn(c))
        return { ...b, items: here.length, amounts: sumsOf(here) }
      }),
      mapping: mapping
        .filter((m) => pipes.some((p) => p.ref === m.pipeline))
        .map((m) => ({ ...m, items: ours.filter((c) => c.pipeline === m.pipeline && c.stage === m.name).length })),
      cards: ours.slice(0, 500),
      more: ours.length > 500,
    }
  }
  return {
    async clientsRead(kind, pipeline) {
      await delay(350)
      if (scenario === "loading") await new Promise(() => undefined)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.131.54", need: "0.131.56" }
      if (scenario === "fail") throw new Error(BUSY)
      if (based) return baseRead(kind)
      const pipes = PIPES.filter((p) => p.kind === kind)
      const open = (ref: string) => cards.filter((c) => c.pipeline === ref && c.status === "open").length
      const chosen = pipes.find((p) => p.ref === pipeline) ?? busiestOf(pipes.map((p) => ({ ...p, open: open(p.ref) })))
      const read: CrmRead = {
        kind: "ready",
        pipelines: pipes.map((p) => ({
          ref: p.ref,
          name: p.name,
          account: p.account,
          open: open(p.ref),
          movable: movable(p),
        })),
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
      const outcome = pipe?.base
        ? bases[pipe.kind].find((b) => b.name === stage)?.outcome
        : pipe?.stages.find(([s]) => s === stage)?.[1]
      if (!found || !outcome) throw new Error(`no stage ${stage} in this pipeline`)
      if (!writable(pipe)) throw new Error(`${ref} is a copy from bitrix24; change it there`)
      const moved = { ...found, stage, status: outcome, updatedAt: new Date().toISOString() }
      cards = cards.map((c) => (c.ref === ref ? moved : c))
      return moved
    },
    async clientsScope(account): Promise<CrmScope> {
      await delay(200)
      const key = `${account.provider}:${account.account}`
      const scope = scopes.get(key) ?? "mine"
      return scenario === "crm-write"
        ? { kind: "settable", scope, applied: applied.get(key) ?? { mode: "mine", also: [] } }
        : { kind: "unavailable", scope, applied: null, why: "crmCli" }
    },
    async clientsScopeSet(account, scope) {
      await delay(900)
      const key = `${account.provider}:${account.account}`
      scopes.set(key, scope)
      applied.set(key, scope === "all" ? { mode: "all" } : { mode: "mine", also: [] })
    },
    async clientsMapSet(stage, base) {
      await delay(400)
      const to = [...bases.deal, ...bases.lead].find((b) => b.ref === base)
      if (!to || !mapping.some((m) => m.ref === stage)) throw new Error(`no stage ${stage} or ${base}`)
      mapping = mapping.map((m) =>
        m.ref === stage ? { ...m, base: { ref: to.ref, name: to.name }, confirmed: true } : m,
      )
    },
    async clientsMapConfirm(pipelines) {
      await delay(500)
      mapping = mapping.map((m) => (pipelines.includes(m.pipeline) && m.base ? { ...m, confirmed: true } : m))
    },
    async clientsBaseEdit(kind, edit) {
      await delay(400)
      bases = { ...bases, [kind]: editBase(bases[kind], edit, cards, kind) }
      const all = [...bases.deal, ...bases.lead]
      mapping = mapping.map((m) => {
        const b = all.find((x) => x.ref === m.base?.ref)
        return m.base && !b
          ? { ...m, base: null, confirmed: false }
          : b
            ? { ...m, base: { ref: b.ref, name: b.name } }
            : m
      })
    },
  }
}

let added = 900

/** memo's `stages base` edits, with its refusals: one stage per outcome stays, a name is unique, a used stage stays. */
function editBase(set: Base[], edit: CrmBaseEdit, cards: CrmCard[], kind: CrmKind): Base[] {
  const own = ALL_PIPES.find((p) => p.base && p.kind === kind)
  const taken = (name: string, except?: string) =>
    set.some((b) => b.ref !== except && b.name.toLowerCase() === name.trim().toLowerCase())
  switch (edit.op) {
    case "add": {
      if (taken(edit.name)) throw new Error(`a base stage named ${edit.name} exists (stage.name-taken)`)
      added += 1
      const stage = { ref: `stage:${added}`, name: edit.name.trim(), outcome: edit.outcome }
      const at = edit.outcome === "open" ? set.findIndex((b) => b.outcome !== "open") : -1
      return at < 0 ? [...set, stage] : [...set.slice(0, at), stage, ...set.slice(at)]
    }
    case "rename": {
      if (taken(edit.name, edit.ref)) throw new Error(`a base stage named ${edit.name} exists (stage.name-taken)`)
      const old = set.find((b) => b.ref === edit.ref)
      if (old && own)
        for (const c of cards) if (c.pipeline === own.ref && c.stage === old.name) c.stage = edit.name.trim()
      return set.map((b) => (b.ref === edit.ref ? { ...b, name: edit.name.trim() } : b))
    }
    case "move": {
      const stage = set.find((b) => b.ref === edit.ref)
      if (!stage) return set
      const rest = set.filter((b) => b.ref !== edit.ref)
      return [...rest.slice(0, edit.position - 1), stage, ...rest.slice(edit.position - 1)]
    }
    case "remove": {
      const stage = set.find((b) => b.ref === edit.ref)
      if (!stage) return set
      if (set.filter((b) => b.outcome === stage.outcome).length < 2) {
        throw new Error(`the base set keeps one ${stage.outcome} stage (stage.last-of-outcome)`)
      }
      if (own && cards.some((c) => c.pipeline === own.ref && c.stage === stage.name)) {
        throw new Error(`${stage.name} still holds cards of ${own.name}; move them first (stage.in-use)`)
      }
      return set.filter((b) => b.ref !== edit.ref)
    }
  }
}
