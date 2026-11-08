// The Clients page's plain logic: which card stands in which column, what the filter words keep, where a card may be
// dropped, and how a stage's sums read. Memo answers the cards and the sums; the filters narrow what one read holds.

import { freeWords, valuesOf } from "./query-terms"

export const KINDS = ["deal", "lead"] as const
export type Kind = (typeof KINDS)[number]

// The parts of Rust's answer (`CrmRead` in platform/bindings.ts) these rules read; domain imports nothing above it.
type CrmAccount = { provider: string; account: string }
type CrmCard = {
  ref: string
  title: string
  pipeline: string
  stage: string
  status: string
  amount: string | null
  organization: string | null
  people: { name: string | null; role: string }[]
}
type CrmStage = { name: string; outcome: string; amounts: { amount: string; currency: string }[] }
type Board<C extends CrmCard> = { stages: CrmStage[]; cards: C[] }

export const OWN = "own"
/** `bitrix24:northstar.example`, or `own` for the owner's own pipelines. */
export const accountKey = (account: CrmAccount | null) => (account ? `${account.provider}:${account.account}` : OWN)

/** Who is responsible: the CRM's assignee is a person on the card with the role `owner`. */
export const ownerOf = (card: CrmCard) => card.people.find((p) => p.role === "owner")?.name ?? null

export const NOBODY = "none"
const FIELDS = "owner|stage|amount"

/** `amount:>=1000`, `amount:<500`, `amount:[1000 TO 5000]`; anything else is no bound. */
export function amountRange(q: string): { min: number | null; max: number | null } {
  let min: number | null = null
  let max: number | null = null
  for (const raw of valuesOf(q, "amount")) {
    const range = /^\[\s*(\S+)\s+TO\s+(\S+)\s*\]$/.exec(raw)
    const bound = /^(>=|<=|>|<)?(\d+(?:\.\d+)?)$/.exec(raw)
    if (range) {
      min = Number.isFinite(Number(range[1])) ? Number(range[1]) : min
      max = Number.isFinite(Number(range[2])) ? Number(range[2]) : max
    } else if (bound) {
      const n = Number(bound[2])
      if (bound[1]?.startsWith("<")) max = n
      else if (bound[1]?.startsWith(">")) min = n
      else [min, max] = [n, n]
    }
  }
  return { min, max }
}

/** Whether a card stays under the filter words: owner, stage, amount and plain words over its title and names. */
export function matches(card: CrmCard, q: string): boolean {
  const owners = valuesOf(q, "owner")
  const owner = ownerOf(card)
  if (owners.length && !owners.includes(owner ?? NOBODY)) return false
  const stages = valuesOf(q, "stage")
  if (stages.length && !stages.includes(card.stage)) return false
  const { min, max } = amountRange(q)
  if (min !== null || max !== null) {
    const amount = card.amount === null ? null : Number(card.amount)
    if (amount === null || (min !== null && amount < min) || (max !== null && amount > max)) return false
  }
  const text = [card.title, card.organization, ...card.people.map((p) => p.name)]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
  return freeWords(q, FIELDS).every((w) => text.includes(w.toLocaleLowerCase()))
}

/** Each stage's cards in Memo's order, newest first; a card whose stage the pipeline no longer lists is left out. */
export function columnsOf(stages: readonly CrmStage[], cards: readonly CrmCard[]): Map<string, string[]> {
  const columns = new Map(stages.map((s) => [s.name, [] as string[]]))
  for (const c of cards) columns.get(c.stage)?.push(c.ref)
  return columns
}

/** A card moves only within its own pipeline: a deal's stage stays in its category. */
export const canDrop = (card: CrmCard | undefined, pipeline: string | null, stages: readonly CrmStage[], to: string) =>
  card !== undefined && card.pipeline === pipeline && stages.some((s) => s.name === to)

/** The read with one card in another stage, as the board shows it while the write runs. */
export function withMove<C extends CrmCard, R extends Board<C>>(read: R, ref: string, to: string): R {
  const outcome = read.stages.find((s) => s.name === to)?.outcome ?? "open"
  return { ...read, cards: read.cards.map((c) => (c.ref === ref ? { ...c, stage: to, status: outcome } : c)) }
}

/** A column's sums over the cards a filter left, one per currency, added in cents so nothing is lost to floats. */
export function amountsOf(cards: readonly { amount: string | null; currency?: string | null }[]) {
  const sums = new Map<string, bigint>()
  for (const c of cards) {
    const cents = c.amount === null || !c.currency ? null : centsOf(c.amount)
    if (cents === null || !c.currency) continue
    sums.set(c.currency, (sums.get(c.currency) ?? 0n) + cents)
  }
  return [...sums].map(([currency, cents]) => ({
    amount: `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`,
    currency,
  }))
}

function centsOf(amount: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,2})\d*)?$/.exec(amount)
  return m ? BigInt(m[1] ?? "0") * 100n + BigInt((m[2] ?? "").padEnd(2, "0")) : null
}

/** The pipeline with the most open cards, the first on a tie; memo often lists an empty one first. */
export const busiestOf = <P extends { open: number }>(pipelines: readonly P[]): P | undefined =>
  pipelines.reduce<P | undefined>((best, p) => (best && best.open >= p.open ? best : p), undefined)

/** Every person responsible for a card on the board, for the filter's choices. */
export const ownersOf = (cards: readonly CrmCard[]) =>
  [...new Set(cards.map((c) => ownerOf(c) ?? NOBODY))].sort((a, b) =>
    a === NOBODY ? 1 : b === NOBODY ? -1 : a.localeCompare(b),
  )

/** One sum per currency, never converted: "500 000 ₽ · 1 200 €". */
export const sumsOf = (amounts: CrmStage["amounts"], lang: string) =>
  amounts.map((a) => moneyOf(a.amount, a.currency, lang)).join(" · ")

export function moneyOf(amount: string, currency: string, lang: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return `${amount} ${currency}`
  try {
    return new Intl.NumberFormat(lang, { style: "currency", currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return `${amount} ${currency}`
  }
}
