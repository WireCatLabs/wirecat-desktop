import { busiestOf } from "@/domain/clients"
import type {
  CrmAccount,
  CrmBaseEdit,
  CrmCard,
  CrmKind,
  CrmRead,
  CrmStage,
  CrmStageMap,
  CrmWritesWith,
} from "./bindings"
import { delay } from "./mock-delay"
import type { CrmAppliedScope, CrmScope, Platform } from "./types"

// The Clients page's stand-in for memo, with made-up companies and people only (Acme, Northstar). The owner's own
// Sales pipeline moves; the Northstar portal's is a CRM copy, read-only as in the released app until memo names b24
// as the CLI that writes it (`writes_with`). `?clients=` none (no deals or leads yet), missing (no memo), old (memo
// too old), fail (the read fails), loading (it never ends), crm-write (memo names b24 profile work: the portal's
// copies move through it and its scope switches), crm-profiles (two b24 profiles on the portal and none named: a
// drop asks which, and the choice holds for the session), move-fail (every move is refused), many (600 deals
// in the portal and its partners pipeline, more than one read holds), long-stages (a third CRM, Bitrix24 on
// saas.example, whose two pipelines hold many long Russian stage names, nearly all of them memo's suggestions);
// `?kind=lead` opens the leads.
//
// By default memo has base stages (cli-core #2720): the owner's only own pipeline of a kind is adopted as its base set
// (Sales, Leads), the board's columns are its stages, and a CRM pipeline's card stands under the base stage its stage
// is confirmed onto. Northstar sales maps onto it, with "Preparing documents" and "Invoice sent" both on Quote (a drop
// there asks which), none on Contract (a drop there is refused) and "Waiting for payment" unmapped; Northstar partners
// and the "In progress" lead stage are suggestions not confirmed yet. A second CRM, Acme on amoCRM, has one pipeline of
// stages and no cards; its Estimate is a suggestion not confirmed yet. Drops of the portal's cards need crm-write or
// crm-profiles.
// `?clients=no-base` is a memo without base stages: one pipeline's own stages, as before, with Partners.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const scenario = params.get("clients") ?? "default"
const BUSY = "another process holds the store (store.busy); try again in a minute"

export const NORTHSTAR: CrmAccount = { provider: "bitrix24", account: "northstar.example" }
/** A second CRM, with stages only: the mapping dialog switches between the two. */
const ACME: CrmAccount = { provider: "amocrm", account: "acme.example" }
/** `?clients=long-stages`: a portal with many long Russian stage names, for the mapping dialog's layout. */
const SAAS: CrmAccount = { provider: "bitrix24", account: "saas.example" }

type Pipe = {
  ref: string
  name: string
  kind: CrmKind
  account: CrmAccount | null
  stages: [string, string][]
  /** The pipeline adopted as its kind's base set. */
  base?: true
  /** Listed only with base stages, or only without. */
  only?: "base" | "legacy"
}

const ALL_PIPES: Pipe[] = [
  // Listed first and empty, as memo listed them for a real account: the board must not open on it.
  {
    ref: "pipeline:3",
    name: "Partners",
    kind: "deal",
    account: null,
    // A second own pipeline would stop memo adopting Sales as the base set.
    only: "legacy",
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
    base: true,
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
    base: true,
    stages: [
      ["new", "open"],
      ["contacted", "open"],
      ["qualified", "open"],
      ["won", "won"],
      ["lost", "lost"],
    ],
  },
  {
    ref: "pipeline:9",
    name: "Northstar partners",
    kind: "deal",
    account: NORTHSTAR,
    only: "base",
    stages: [
      ["Lead in", "open"],
      ["Offer", "open"],
      ["Signed", "won"],
      ["Rejected", "lost"],
    ],
  },
  {
    ref: "pipeline:11",
    name: "Acme projects",
    kind: "deal",
    account: ACME,
    only: "base",
    stages: [
      ["Brief", "open"],
      ["Estimate", "open"],
      ["Done", "won"],
      ["Cancelled", "lost"],
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

type Row = [name: string, outcome: string, base: string | null, confirmed: boolean]
// cspell:disable
const SAAS_STAGES: Row[] = [
  ["Новая", "open", "Call", true],
  ["На стопе", "open", "Call", false],
  ["Запись на демо", "open", "Call", false],
  ["Предложил тестовый период", "open", "Quote", false],
  ["На тестовом периоде", "open", "Quote", true],
  ["Актуализировать потребность", "open", "Quote", false],
  ["Скинул вводный урок", "open", "Quote", true],
  ["Жду решения", "open", "Contract", false],
  ["В работе", "open", "Contract", false],
  ["Согласование договора с юристами клиента", "open", "Contract", false],
  ["Ожидает оплаты", "open", null, false],
  ["Сделка успешна", "won", "Won", false],
  ["Сделка провалена", "lost", "Lost", false],
  ["Не вышел на связь после демонстрации", "lost", "Lost", false],
]
const SAAS_PARTNER_STAGES: Row[] = [
  ["Первичный контакт", "open", "Call", false],
  ["Подписание партнерского соглашения", "open", "Contract", false],
  ["Партнер активен", "won", "Won", false],
  ["Отказ", "lost", "Lost", false],
]
// cspell:enable
const saasPipe = (ref: string, name: string, rows: Row[]): Pipe => ({
  ref,
  name,
  kind: "deal",
  account: SAAS,
  only: "base",
  stages: rows.map(([n, outcome]) => [n, outcome]),
})
const saasMap = (rows: Row[]): Record<string, [string, boolean]> =>
  Object.fromEntries(rows.flatMap(([n, , to, ok]) => (to ? [[n, [to, ok] as [string, boolean]]] : [])))
if (scenario === "long-stages") {
  ALL_PIPES.push(
    saasPipe("pipeline:21", "SAAS Покупатели", SAAS_STAGES),
    saasPipe("pipeline:22", "SAAS Партнеры", SAAS_PARTNER_STAGES),
  )
}

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
      ? Array.from({ length: 600 }, (_, i) => {
          const stages = i % 2 ? ["New", "Preparing documents", "Invoice sent"] : ["Lead in", "Offer"]
          return card(
            "deal",
            i % 2 ? "pipeline:7" : "pipeline:9",
            stages[Math.floor(i / 2) % stages.length] ?? "New",
            `Order ${i + 1}`,
            {
              ...money(`${(i + 1) * 100}.00`, "EUR"),
              people: [person(i % 2 ? "Bob Lee" : "Alice Moreno", "owner")],
            },
          )
        })
      : []
  const saas =
    scenario === "long-stages"
      ? SAAS_STAGES.flatMap(([stage], i) =>
          Array.from({ length: (i * 7) % 5 }, (_, k) => card("deal", "pipeline:21", stage, `Клиент ${i + 1}.${k + 1}`)),
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
          card("deal", "pipeline:9", "Offer", "Acme: showroom partnership", {
            ...money("4200.00", "EUR"),
            organization: "Acme Corp",
            people: [person("Alice Moreno", "owner")],
          }),
        ]
      : []),
    ...many,
    ...saas,
  ]
}

type Base = { ref: string; name: string; outcome: string }

// Each CRM pipeline's stage → the base stage's name and whether the owner confirmed it; a stage left out is unmapped.
const MAPS: Record<string, Record<string, [string, boolean]>> = {
  "pipeline:7": {
    New: ["Call", true],
    "Preparing documents": ["Quote", true],
    "Invoice sent": ["Quote", true],
    "Deal won": ["Won", true],
    "Deal lost": ["Lost", true],
  },
  "pipeline:9": {
    "Lead in": ["Call", false],
    Offer: ["Contract", false],
    Signed: ["Won", false],
    Rejected: ["Lost", false],
  },
  "pipeline:11": {
    Brief: ["Call", true],
    Estimate: ["Quote", false],
    Done: ["Won", true],
    Cancelled: ["Lost", true],
  },
  "pipeline:21": saasMap(SAAS_STAGES),
  "pipeline:22": saasMap(SAAS_PARTNER_STAGES),
  "pipeline:8": {
    "Not processed": ["new", true],
    "In progress": ["contacted", false],
    "Good lead": ["won", true],
    "Junk lead": ["lost", true],
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
  for (const p of ALL_PIPES.filter((x) => x.account !== null)) {
    for (const [name, outcome] of p.stages) {
      n += 1
      const [to, confirmed] = MAPS[p.ref]?.[name] ?? [null, false]
      const b = bases[p.kind].find((x) => x.name === to)
      const base = b ? { ref: b.ref, name: b.name } : null
      mapping.push({
        ref: `stage:${n}`,
        name,
        externalId: externalIdOf(p, name),
        outcome,
        pipeline: p.ref,
        open: 0,
        base,
        confirmed,
      })
    }
  }
  return { bases, mapping }
}

/** The portal's own ids of some stages, as Bitrix24 names them; "New" has none, so a move to it names the stage. */
const STAGE_IDS: Record<string, string> = {
  "Preparing documents": "C7:PREPARATION",
  "Invoice sent": "C7:EXECUTING",
  "Deal won": "C7:WON",
  "Deal lost": "C7:LOSE",
}

const externalIdOf = (pipe: Pipe, name: string) => (pipe.account ? (STAGE_IDS[name] ?? null) : null)

const stagesOf = (pipe: Pipe, cards: CrmCard[]): CrmStage[] =>
  pipe.stages.map(([name, outcome]) => {
    const here = cards.filter((c) => c.pipeline === pipe.ref && c.stage === name)
    return { name, externalId: externalIdOf(pipe, name), outcome, items: here.length, amounts: sumsOf(here) }
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

/** Whether memo names b24 for the portal: not at all (a memo before `writes_with`), one profile, or two to choose. */
export type CrmWriter = "none" | "one" | "choose"

const SCENARIO_WRITER: CrmWriter = scenario === "crm-write" ? "one" : scenario === "crm-profiles" ? "choose" : "none"

const writesWithOf = (writer: CrmWriter, account: CrmAccount | null): CrmWritesWith | null =>
  account?.account !== NORTHSTAR.account || writer === "none"
    ? null
    : writer === "one"
      ? { tool: "b24", account, profile: "work", profiles: ["work"], why: null }
      : {
          tool: "b24",
          account,
          profile: null,
          profiles: ["sales", "work"],
          why: "2 b24 profiles are on bitrix24:northstar.example; the owner chooses one",
        }

/** `based` false is a memo without base stages, as `?clients=no-base`; `writer` as `?clients=crm-write|crm-profiles`. */
export function clientsMock(based = scenario !== "no-base", writer: CrmWriter = SCENARIO_WRITER): ClientsApi {
  const PIPES = ALL_PIPES.filter((p) => p.only !== (based ? "legacy" : "base"))
  let cards = scenario === "none" ? [] : seeds(based)
  const scopes = new Map<string, "mine" | "all">()
  const applied = new Map<string, CrmAppliedScope>()
  const writable = (pipe: Pipe | undefined) => pipe?.account === null || writer !== "none"
  let { bases, mapping } = baseSeeds()
  const movable = (p: Pipe) => (writable(p) ? { kind: "yes" as const } : { kind: "no" as const, why: "crmCli" })
  // memo answers a row's base stage only once its stage is confirmed onto one; the base set's own rows stand in it.
  const baseOf = (c: CrmCard) => {
    const pipe = PIPES.find((p) => p.ref === c.pipeline)
    if (pipe?.base) {
      const b = bases[pipe.kind].find((x) => x.name === c.stage)
      return b ? { ref: b.ref, name: b.name } : null
    }
    const m = mapping.find((x) => x.pipeline === c.pipeline && x.name === c.stage)
    return m?.confirmed ? m.base : null
  }
  const baseRead = (kind: CrmKind): CrmRead => {
    const pipes = PIPES.filter((p) => p.kind === kind)
    const ours = cards
      .filter((c) => pipes.some((p) => p.ref === c.pipeline))
      .map((c) => ({ ...c, baseStage: baseOf(c) }))
    const openIn = (here: CrmCard[]) => here.filter((c) => c.status === "open").length
    const listed = mapping.filter((m) => pipes.some((p) => p.ref === m.pipeline))
    return {
      kind: "base",
      pipelines: pipes.map((p) => ({
        ref: p.ref,
        name: p.name,
        account: p.account,
        open: openIn(ours.filter((c) => c.pipeline === p.ref)),
        movable: movable(p),
        writesWith: writesWithOf(writer, p.account),
      })),
      base: bases[kind].map((b) => ({
        ...b,
        open: openIn(ours.filter((c) => c.baseStage?.ref === b.ref)),
        mapped: listed.filter((m) => m.confirmed && m.base?.ref === b.ref).length,
      })),
      unsorted: {
        open: openIn(ours.filter((c) => c.baseStage === null)),
        stages: listed.filter((m) => !m.confirmed || m.base === null).length,
      },
      mapping: listed.map((m) => ({
        ...m,
        open: openIn(ours.filter((c) => c.pipeline === m.pipeline && c.stage === m.name)),
      })),
      cards: ours.slice(0, 500),
      more: ours.length > 500,
    }
  }
  return {
    async clientsRead(kind, pipeline) {
      await delay(350)
      if (scenario === "loading") await new Promise(() => undefined)
      if (scenario === "missing") return { kind: "missing" }
      if (scenario === "old") return { kind: "old", version: "0.131.54", need: "0.131.71" }
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
          writesWith: writesWithOf(writer, p.account),
        })),
        pipeline: chosen?.ref ?? null,
        stages: chosen ? stagesOf(chosen, cards) : [],
        cards: cards.filter((c) => c.pipeline === chosen?.ref).slice(0, 500),
        more: cards.filter((c) => c.pipeline === chosen?.ref).length > 500,
        movable: writable(chosen) ? { kind: "yes" } : { kind: "no", why: "crmCli" },
      }
      return read
    },
    async clientsMove(_kind, ref, given, via) {
      await delay(600)
      if (scenario === "move-fail") throw new Error("the portal refused the change: access denied (crm.permission)")
      const found = cards.find((c) => c.ref === ref)
      const pipe = PIPES.find((p) => p.ref === found?.pipeline)
      if (pipe?.account && !via) throw new Error(`${ref} is a copy from bitrix24; change it there`)
      if (via && !writesWithOf(writer, pipe?.account ?? null)?.profiles.includes(via.profile)) {
        throw new Error(`${ref} is not a deal of this CRM account (not_found)`)
      }
      // As b24 does: the CRM's own stage id first, then a name.
      const stage = pipe?.stages.find(([name]) => externalIdOf(pipe, name) === given)?.[0] ?? given
      const outcome = pipe?.base
        ? bases[pipe.kind].find((b) => b.name === stage)?.outcome
        : pipe?.stages.find(([s]) => s === stage)?.[1]
      if (!found || !outcome) throw new Error(`no stage ${stage} in this pipeline`)
      if (!writable(pipe)) throw new Error(`${ref} is a copy from bitrix24; change it there`)
      const moved = { ...found, stage, status: outcome, updatedAt: new Date().toISOString() }
      cards = cards.map((c) => (c.ref === ref ? moved : c))
      return via ? null : moved
    },
    async clientsScope(account, profile): Promise<CrmScope> {
      await delay(200)
      const key = `${account.provider}:${account.account}`
      const scope = scopes.get(key) ?? "mine"
      if (writer === "none") return { kind: "unavailable", scope, applied: null, why: "crmCli" }
      if (profile === null) return { kind: "unavailable", scope, applied: null, why: "profile" }
      return { kind: "settable", scope, applied: applied.get(key) ?? { mode: "mine", also: [] } }
    },
    async clientsScopeSet(account, _profile, scope) {
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
    async clientsMapConfirm(kind, pipeline) {
      await delay(500)
      const ours = (m: CrmStageMap) =>
        pipeline === null ? ALL_PIPES.find((p) => p.ref === m.pipeline)?.kind === kind : m.pipeline === pipeline
      mapping = mapping.map((m) => (ours(m) && m.base ? { ...m, confirmed: true } : m))
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
      if (taken(edit.name)) throw new Error(`a base stage named ${edit.name} exists (stage.base-field)`)
      added += 1
      const stage = { ref: `stage:${added}`, name: edit.name.trim(), outcome: edit.outcome }
      const at = edit.outcome === "open" ? set.findIndex((b) => b.outcome !== "open") : -1
      return at < 0 ? [...set, stage] : [...set.slice(0, at), stage, ...set.slice(at)]
    }
    case "rename": {
      if (taken(edit.name, edit.ref)) throw new Error(`a base stage named ${edit.name} exists (stage.base-field)`)
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
        throw new Error(`the base set keeps one ${stage.outcome} stage (stage.base-outcome)`)
      }
      if (own && cards.some((c) => c.pipeline === own.ref && c.stage === stage.name)) {
        throw new Error(`${stage.name} still holds cards of ${own.name}; move them first (stage.base-in-use)`)
      }
      return set.filter((b) => b.ref !== edit.ref)
    }
  }
}
