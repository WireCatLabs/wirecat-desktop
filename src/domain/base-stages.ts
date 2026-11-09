// The base-stage board's rules: which column a card stands in, what a drop onto a base column resolves to, where a
// pipeline's stage sits on the mapping screen, and what an edit of the base set may not break. Memo keeps the mapping;
// these rules only read it.

// The parts of Rust's `CrmRead` "base" answer (platform/bindings.ts) these rules read.
type BaseRef = { ref: string; name: string }
type BaseStage = { ref: string; name: string; outcome: string }
type StageMap = {
  ref: string
  name: string
  outcome: string
  pipeline: string
  base: BaseRef | null
  confirmed: boolean
}
type Card = { ref: string; pipeline: string; stage: string; baseStage: BaseRef | null }

/** The column of cards whose stage points to no base stage, or to one the owner has not confirmed yet. */
export const UNSORTED = "unsorted"
/** The mapping screen's column of stages that point to no base stage. */
export const UNMAPPED = "unmapped"

/** memo names a row's base stage only once its stage is confirmed onto one; until then it is unsorted. */
export const columnOf = (card: Card): string => card.baseStage?.ref ?? UNSORTED

/** Unsorted first, then the base set in its order; each column's cards in memo's order. */
export function baseColumnsOf(base: readonly BaseStage[], cards: readonly Card[]) {
  const columns = new Map<string, string[]>([[UNSORTED, []], ...base.map((b) => [b.ref, [] as string[]] as const)])
  for (const c of cards) (columns.get(columnOf(c)) ?? columns.get(UNSORTED))?.push(c.ref)
  return columns
}

/** The stages of the card's own pipeline the owner confirmed for this base stage. */
export const candidatesOf = (card: Card, base: string, mapping: readonly StageMap[]) =>
  mapping.filter((m) => m.pipeline === card.pipeline && m.confirmed && m.base?.ref === base).map((m) => m.name)

export type Refusal = "readOnly" | "unsorted" | "unmapped" | "unconfirmed"
export type Drop =
  | { kind: "refuse"; why: Refusal }
  | { kind: "move"; stage: string }
  | { kind: "choose"; stages: string[] }

/**
 * What a drop onto a column does. The base set's own pipeline moves to the stage itself; any other moves to the one
 * stage of its pipeline mapped there, asks among several, and refuses with none.
 */
export function dropOf(
  card: Card,
  to: string,
  read: { base: readonly BaseStage[]; mapping: readonly StageMap[] },
  movable: boolean,
): Drop {
  if (!movable) return { kind: "refuse", why: "readOnly" }
  if (to === UNSORTED) return { kind: "refuse", why: "unsorted" }
  const { base, mapping } = read
  if (!mapping.some((m) => m.pipeline === card.pipeline)) {
    const own = card.baseStage ? base.find((b) => b.ref === to) : undefined
    return own ? { kind: "move", stage: own.name } : { kind: "refuse", why: "unmapped" }
  }
  const stages = candidatesOf(card, to, mapping)
  if (stages.length === 1 && stages[0] !== undefined) return { kind: "move", stage: stages[0] }
  if (stages.length > 1) return { kind: "choose", stages }
  const suggested = mapping.some((m) => m.pipeline === card.pipeline && m.base?.ref === to)
  return { kind: "refuse", why: suggested ? "unconfirmed" : "unmapped" }
}

/** Where the last choice among several stages is remembered: per pipeline and base stage. */
export const choiceKey = (pipeline: string, base: string) => `${pipeline}|${base}`

/** The remembered stage when it is still one of the choices, else the first. */
export const preferred = (stages: readonly string[], remembered: string | undefined) =>
  remembered && stages.includes(remembered) ? remembered : (stages[0] ?? null)

/** The card as the board shows it while the write runs: in the chosen stage, under the base stage it points to. */
export function withBaseMove<C extends Card & { status: string }, R extends { cards: C[]; mapping: StageMap[] }>(
  read: R & { base: BaseStage[] },
  ref: string,
  stage: string,
): R {
  const card = read.cards.find((c) => c.ref === ref)
  if (!card) return read
  const entry = read.mapping.find((m) => m.pipeline === card.pipeline && m.name === stage)
  const own = read.base.find((b) => b.name === stage && card.baseStage !== null && !entry)
  const confirmed = entry?.confirmed ? entry.base : null
  const baseStage = entry ? confirmed : own ? { ref: own.ref, name: own.name } : card.baseStage
  const status = entry?.outcome ?? own?.outcome ?? card.status
  return { ...read, cards: read.cards.map((c) => (c.ref === ref ? { ...c, stage, baseStage, status } : c)) }
}

/** Mapping screen: the base set's columns and Unmapped last, stages grouped by pipeline in the order pipelines come. */
export function mapColumnsOf(
  base: readonly BaseStage[],
  mapping: readonly StageMap[],
  pipelines: readonly { ref: string }[],
) {
  const order = new Map(pipelines.map((p, i) => [p.ref, i]))
  const sorted = [...mapping].sort((a, b) => (order.get(a.pipeline) ?? 0) - (order.get(b.pipeline) ?? 0))
  const columns = new Map<string, string[]>([...base.map((b) => [b.ref, [] as string[]] as const), [UNMAPPED, []]])
  for (const m of sorted) (columns.get(m.base?.ref ?? UNMAPPED) ?? columns.get(UNMAPPED))?.push(m.ref)
  return columns
}

/** A pipeline's stage goes onto a base stage; Unmapped is where memo puts what it could not place, not a target. */
export const mapDropOf = (to: string): true | "unmapped" => (to === UNMAPPED ? "unmapped" : true)

/** The mapping with one stage pointed at a base stage, as memo keeps it after `stages map set`: confirmed. */
export function withMapping<M extends StageMap>(mapping: readonly M[], ref: string, to: BaseRef): M[] {
  return mapping.map((m) => (m.ref === ref ? { ...m, base: to, confirmed: true } : m))
}

/** Suggestions to confirm by pipeline, in the order pipelines come; an unmapped stage has none to confirm. */
export function unconfirmedOf(mapping: readonly StageMap[], pipelines: readonly { ref: string }[]) {
  const waiting = (m: StageMap, pipeline: string) => m.pipeline === pipeline && !m.confirmed && m.base !== null
  return pipelines
    .map((p) => ({ pipeline: p.ref, count: mapping.filter((m) => waiting(m, p.ref)).length }))
    .filter((p) => p.count > 0)
}

const MAX_NAME = 200

export type NameProblem = "empty" | "long" | "taken"

/** A base stage's name: one line, unique in its set (not counting the stage being renamed). */
export function nameProblem(base: readonly BaseStage[], name: string, except?: string): NameProblem | null {
  const n = name.trim()
  if (!n) return "empty"
  if ([...n].length > MAX_NAME || n.startsWith("-")) return "long"
  const lower = n.toLocaleLowerCase()
  return base.some((b) => b.ref !== except && b.name.toLocaleLowerCase() === lower) ? "taken" : null
}

/** A set keeps at least one stage per outcome: the last open, won or lost stage cannot go. */
export const removable = (base: readonly BaseStage[], ref: string) => {
  const stage = base.find((b) => b.ref === ref)
  return stage !== undefined && base.filter((b) => b.outcome === stage.outcome).length > 1
}

/** The 1-based place a stage moves to one step left or right, or null at the set's edge. */
export function stepTo(base: readonly BaseStage[], ref: string, by: -1 | 1): number | null {
  const i = base.findIndex((b) => b.ref === ref)
  if (i < 0) return null
  const to = i + by
  return to < 0 || to >= base.length ? null : to + 1
}
