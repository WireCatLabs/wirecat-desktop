import { describe, expect, it } from "vitest"
import {
  baseColumnsOf,
  crmsOf,
  crmToOpen,
  dropOf,
  mapColumnsOf,
  mapDropOf,
  nameProblem,
  preferred,
  removable,
  stepTo,
  UNMAPPED,
  UNSORTED,
  unconfirmedOf,
  withBaseMove,
  withMapping,
} from "./base-stages"

const base = [
  { ref: "stage:1", name: "New", outcome: "open" },
  { ref: "stage:3", name: "Proposal", outcome: "open" },
  { ref: "stage:5", name: "Won", outcome: "won" },
  { ref: "stage:6", name: "Lost", outcome: "lost" },
]
const to = (ref: string) => ({ ref, name: base.find((b) => b.ref === ref)?.name ?? "" })
const entry = (ref: string, pipeline: string, name: string, b: string | null, confirmed = true) => ({
  ref,
  name,
  outcome: "open",
  pipeline,
  base: b ? to(b) : null,
  confirmed,
})
const mapping = [
  entry("stage:40", "pipeline:7", "New", "stage:1"),
  entry("stage:41", "pipeline:7", "Preparing documents", "stage:3"),
  entry("stage:42", "pipeline:7", "Invoice sent", "stage:3"),
  entry("stage:43", "pipeline:7", "Waiting for payment", null, false),
  entry("stage:50", "pipeline:3", "Intro", "stage:1", false),
]
const card = (ref: string, pipeline: string, stage: string, baseStage: string | null = null) => ({
  ref,
  pipeline,
  stage,
  status: "open",
  baseStage: baseStage ? to(baseStage) : null,
})
const read = { base, mapping }

describe("the base board's columns", () => {
  it("puts a card under the base stage memo names for it, and one with none (unmapped or unconfirmed) in Unsorted first", () => {
    const columns = baseColumnsOf(base, [
      card("deal:1", "pipeline:7", "Invoice sent", "stage:3"),
      card("deal:2", "pipeline:7", "Waiting for payment"),
      card("deal:3", "pipeline:3", "Intro"),
      card("deal:4", "pipeline:20", "Proposal", "stage:3"),
    ])
    expect([...columns.keys()][0]).toBe(UNSORTED)
    expect(columns.get(UNSORTED)).toEqual(["deal:2", "deal:3"])
    expect(columns.get("stage:3")).toEqual(["deal:1", "deal:4"])
  })
})

describe("a drop onto a base column", () => {
  it("moves to the one stage of the card's pipeline mapped there", () => {
    expect(dropOf(card("deal:1", "pipeline:7", "Invoice sent"), "stage:1", read, true)).toEqual({
      kind: "move",
      stage: "New",
    })
  })

  it("asks among several stages of the card's pipeline mapped there", () => {
    expect(dropOf(card("deal:1", "pipeline:7", "New"), "stage:3", read, true)).toEqual({
      kind: "choose",
      stages: ["Preparing documents", "Invoice sent"],
    })
  })

  it("refuses a column with no stage of the pipeline, and says when the only one is a suggestion", () => {
    expect(dropOf(card("deal:1", "pipeline:7", "New"), "stage:5", read, true)).toEqual({
      kind: "refuse",
      why: "unmapped",
    })
    expect(dropOf(card("deal:2", "pipeline:3", "Intro"), "stage:1", read, true)).toEqual({
      kind: "refuse",
      why: "unconfirmed",
    })
  })

  it("refuses a CRM's read-only card and a drop on Unsorted before anything else", () => {
    expect(dropOf(card("deal:1", "pipeline:7", "New"), "stage:3", read, false)).toMatchObject({ why: "readOnly" })
    expect(dropOf(card("deal:1", "pipeline:7", "New"), UNSORTED, read, true)).toMatchObject({ why: "unsorted" })
  })

  it("moves a card of the base set's own pipeline to the column's own stage", () => {
    expect(dropOf(card("deal:4", "pipeline:20", "New", "stage:1"), "stage:5", read, true)).toEqual({
      kind: "move",
      stage: "Won",
    })
  })

  it("preselects the stage picked last for this pipeline and column while it is still offered", () => {
    expect(preferred(["Preparing documents", "Invoice sent"], "Invoice sent")).toBe("Invoice sent")
    expect(preferred(["Preparing documents", "Invoice sent"], "Gone")).toBe("Preparing documents")
  })

  it("shows the moved card in its new stage under the base stage that stage points to", () => {
    const before = { base, mapping, cards: [card("deal:1", "pipeline:7", "New", "stage:1")] }
    expect(withBaseMove(before, "deal:1", "Invoice sent").cards[0]).toMatchObject({
      stage: "Invoice sent",
      baseStage: { ref: "stage:3" },
    })
  })
})

describe("the mapping dialog", () => {
  it("puts unconfirmed stages in Unmapped first, suggested or not, and the confirmed under their base stage", () => {
    const columns = mapColumnsOf(base, mapping, [{ ref: "pipeline:3" }, { ref: "pipeline:7" }])
    expect([...columns.keys()][0]).toBe(UNMAPPED)
    expect(columns.get(UNMAPPED)).toEqual(["stage:50", "stage:43"])
    expect(columns.get("stage:1")).toEqual(["stage:40"])
    expect(columns.get("stage:3")).toEqual(["stage:41", "stage:42"])
    expect(mapDropOf(UNMAPPED)).toBe("unmapped")
    expect(mapDropOf("stage:3")).toBe(true)
  })

  it("has no Unmapped column once every stage is confirmed", () => {
    const confirmed = mapping.filter((m) => m.confirmed)
    expect([...mapColumnsOf(base, confirmed, [{ ref: "pipeline:7" }]).keys()]).toEqual(base.map((b) => b.ref))
  })

  it("lists each CRM account with its pipelines and its unconfirmed stages, and opens on one that has some", () => {
    const north = { provider: "bitrix24", account: "north" }
    const acme = { provider: "amocrm", account: "acme" }
    const crms = crmsOf(
      [
        { ref: "pipeline:2", account: null },
        { ref: "pipeline:7", account: acme },
        { ref: "pipeline:3", account: north },
        { ref: "pipeline:9", account: north },
      ],
      mapping.filter((m) => m.ref !== "stage:43"),
    )
    expect([...crms.entries()]).toEqual([
      ["amocrm:acme", { account: acme, pipelines: ["pipeline:7"], waiting: 0 }],
      ["bitrix24:north", { account: north, pipelines: ["pipeline:3"], waiting: 1 }],
    ])
    expect(crmToOpen(crms, null)).toBe("bitrix24:north")
    expect(crmToOpen(crms, "amocrm:acme")).toBe("amocrm:acme")
    expect(crmToOpen(crms, "gone")).toBe("bitrix24:north")
  })

  it("confirms a stage it maps, and counts each pipeline's suggestions to confirm, not its unmapped stages", () => {
    const mapped = withMapping(mapping, "stage:43", to("stage:3"))
    expect(mapped.find((m) => m.ref === "stage:43")).toMatchObject({ base: { ref: "stage:3" }, confirmed: true })
    expect(unconfirmedOf(mapping, [{ ref: "pipeline:7" }, { ref: "pipeline:3" }, { ref: "pipeline:2" }])).toEqual([
      { pipeline: "pipeline:3", count: 1 },
    ])
  })
})

describe("editing the base set", () => {
  it("keeps one stage per outcome", () => {
    expect(removable(base, "stage:3")).toBe(true)
    expect(removable(base, "stage:5")).toBe(false)
    expect(removable(base, "stage:99")).toBe(false)
  })

  it("wants a name that is one short line and not another stage's", () => {
    expect(nameProblem(base, "  ")).toBe("empty")
    expect(nameProblem(base, "--all")).toBe("long")
    expect(nameProblem(base, "proposal")).toBe("taken")
    expect(nameProblem(base, "Proposal", "stage:3")).toBeNull()
    expect(nameProblem(base, "Demo")).toBeNull()
  })

  it("moves a stage one place left or right, never past the set's edge", () => {
    expect(stepTo(base, "stage:3", -1)).toBe(1)
    expect(stepTo(base, "stage:3", 1)).toBe(3)
    expect(stepTo(base, "stage:1", -1)).toBeNull()
    expect(stepTo(base, "stage:6", 1)).toBeNull()
  })
})
