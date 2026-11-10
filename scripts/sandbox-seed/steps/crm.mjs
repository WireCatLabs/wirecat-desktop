import { memo, memoEach } from "../lib.mjs"

// The owner's own pipelines, written with memo's commands: an imported CRM copy could not be moved on the board.
// Deals have no seed id in the store, so a deal is known by its title.
function ensurePipelines(pipelines) {
  const have = new Set(memo(["pipelines", "list"]).items.map((p) => p.name))
  let added = 0
  for (const p of pipelines.filter((p) => !have.has(p.name))) {
    memo(["pipelines", "add", p.name, ...p.stages.map((s) => s.name), "--kind", p.kind])
    added++
  }
  return added
}

function ensureCards(ctx, kind, cards, pipelines) {
  const stageName = (card) => pipelines[card.pipeline].stages.find((s) => s.id === card.stage)
  const have = new Map(memoEach([`${kind}s`, "list"], "status", ["open", "won", "lost"]).map((d) => [d.title, d]))
  let added = 0
  let moved = 0
  for (const card of cards) {
    const stage = stageName(card)
    const at = `${pipelines[card.pipeline].name}/${stage.name}`
    const old = have.get(card.title)
    if (!old) {
      const people = (card.people ?? []).flatMap((id) => ["--person", ctx.refs.get(id)])
      memo([
        `${kind}s`,
        "add",
        card.title,
        at,
        ...(card.amount ? [card.amount, card.currency] : []),
        ...(card.organization ? ["--organization", ctx.refs.get(card.organization)] : []),
        ...people,
      ])
      added++
    } else if (old.stage !== stage.name) {
      memo([`${kind}s`, "move", old.ref, stage.name])
      moved++
    }
  }
  return `${added} ${kind}s added, ${moved} moved`
}

/**
 * Each seed pipeline's stages onto memo's base set, the owner's "Map stages": open stages in order, then won and lost.
 * memo makes the base set on its first `stages show`; until a card's stage is mapped, Clients shows it as Unsorted.
 */
function mapStages(kind, pipelines) {
  const base = memo(["stages", "show", kind]).item
  const ofOutcome = (stages, outcome) => stages.filter((s) => s.outcome === outcome)
  let mapped = 0
  for (const p of pipelines.filter((p) => p.kind === kind)) {
    const own = memo(["stages", "list", "--", `kind:${kind}`]).items.filter((s) => s.pipeline_name === p.name)
    if (own[0]?.pipeline === base.pipeline) continue
    for (const outcome of ["open", "won", "lost"]) {
      const targets = ofOutcome(base.stages, outcome)
      ofOutcome(own, outcome).forEach((stage, i) => {
        const target = targets[Math.min(i, targets.length - 1)]
        if (!target || (stage.confirmed && stage.base_stage?.ref === target.ref)) return
        memo(["stages", "set", stage.ref, target.ref])
        mapped++
      })
    }
  }
  return mapped
}

export default function crm(ctx) {
  const { pipelines, deals, leads } = ctx.data("crm.json")
  const byId = Object.fromEntries(pipelines.map((p) => [p.id, p]))
  const added = ensurePipelines(pipelines)
  const summary = [
    `${added} pipelines added`,
    ensureCards(ctx, "deal", deals, byId),
    ensureCards(ctx, "lead", leads, byId),
  ]
  const mapped = ["deal", "lead"].reduce((n, kind) => n + mapStages(kind, pipelines), 0)
  return [...summary, `${mapped} stages mapped`].join(", ")
}
