import { describe, expect, it } from "vitest"
import {
  actionSentence,
  actionTargetOf,
  approveMode,
  batchSubjectOf,
  byDay,
  byReviewRank,
  can,
  causeOf,
  createdTarget,
  entryInTab,
  findingsCounts,
  inTab,
  isCorrection,
  matchesFilter,
  memoryFilter,
  oneLine,
  refKind,
  reviewChoices,
  setMemoryField,
  sourceKindOf,
  stateLineOf,
  tabOf,
  tickedCount,
  toneOf,
  undoMenuKey,
  undoOf,
  withCleanNames,
} from "./memory"

const entry = (type: string, kind: string, status: string) => ({ type, kind, status, author: { type: "bot" } })

describe("memory records", () => {
  it("files every status under one tab, and an unknown one under All only", () => {
    expect(
      ["proposed", "confirmed", "accepted", "approved", "failed", "stale", "superseded", "rejected"].map(tabOf),
    ).toEqual(["review", "inuse", "inuse", "inuse", "inuse", "discarded", "discarded", "discarded"])
    expect(tabOf("archived")).toBeNull()
    expect(inTab("all", "archived")).toBe(true)
    expect(toneOf("failed")).toBe("bad")
  })

  it("offers only what memo 0.130.0 does with each record", () => {
    expect(can(entry("memory", "summary", "proposed"))).toEqual({
      confirm: true,
      discard: true,
      correct: true,
      forget: true,
    })
    expect(can(entry("memory", "summary", "superseded")).correct).toBe(false)
    expect(can(entry("fact", "decision", "accepted"))).toMatchObject({ discard: true, correct: true })
    expect(can(entry("fact", "promise", "accepted"))).toMatchObject({ discard: false, correct: true, forget: true })
    expect(can(entry("fact", "decision", "proposed"))).toMatchObject({ confirm: true, discard: true, correct: true })
    expect(can(entry("fact", "promise", "superseded")).correct).toBe(false)
    expect(can(entry("action", "reply", "proposed"))).toEqual({
      confirm: true,
      discard: true,
      correct: false,
      forget: false,
    })
    expect(can(entry("action", "reply", "approved")).discard).toBe(false)
  })

  it("edits a relationship only as a proposal or as a link the owner holds, never a proposal approved a moment ago", () => {
    const rel = (ref: string, status: string, standing: string) => ({
      ...entry("relationship", "member-of", status),
      ref,
      standing,
    })
    expect(can(rel("relationship:4", "proposed", "proposed")).correct).toBe(true)
    expect(can(rel("link:9", "confirmed", "confirmed")).correct).toBe(true)
    expect(can(rel("relationship:4", "confirmed", "confirmed")).correct).toBe(false)
    expect(can(rel("link:9", "confirmed", "reported")).correct).toBe(false)
  })

  it("takes back an approval the way memo can, and says when it cannot", () => {
    expect(undoOf(entry("memory", "summary", "confirmed"))).toBe("invalidate")
    expect(undoOf(entry("fact", "decision", "accepted"))).toBe("reverse")
    expect(undoOf(entry("fact", "promise", "accepted"))).toBe("none")
    expect(undoOf(entry("action", "reply", "approved"))).toBe("task")
    expect(undoOf({ ...entry("action", "evidence_findings", "approved"), findings: [] })).toBe("created")
    expect(undoOf(entry("fact", "decision", "proposed"))).toBe("reject")
    expect(undoOf(entry("memory", "summary", "stale"))).toBeNull()
  })

  it("takes back an agent's accepted fact once memo can, never the owner's own or a correction", () => {
    const promise = entry("fact", "promise", "accepted")
    expect(undoOf(promise, true)).toBe("revoke")
    expect(can(promise, true).discard).toBe(true)
    expect(undoOf({ ...promise, author: { type: "person" } }, true)).toBe("none")
    expect(undoOf({ ...promise, supersedes: "fact:7" }, true)).toBe("none")
    expect(can({ ...promise, supersedes: "fact:7" }, true).discard).toBe(false)
    expect(undoOf(entry("fact", "decision", "accepted"), true)).toBe("reverse")
  })

  it("groups a newest-first list into runs of one local day", () => {
    const at = (d: number, h: number) => ({ createdAt: new Date(2026, 9, d, h).toISOString() })
    const groups = byDay([at(31, 23), at(31, 1), at(30, 22), at(28, 9)])
    expect(groups.map((g) => g.entries.length)).toEqual([2, 1, 1])
    expect(groups[0]?.day).toBe("2026-10-31")
  })
})

describe("Memory's search", () => {
  const entry = (over: Partial<Parameters<typeof matchesFilter>[0]> = {}) => ({
    type: "memory",
    kind: "preference",
    status: "confirmed",
    author: { type: "bot", name: "hermes" },
    subject: "person:7",
    subjectName: "James Mead",
    subjectIsOwner: false,
    project: null,
    projectName: null,
    text: "Prefers calls on Friday",
    summary: null,
    scope: "work",
    createdAt: new Date().toISOString(),
    ...over,
  })
  const hit = (q: string, e = entry()) => matchesFilter(e, memoryFilter(q))

  it("reads subject:me as the owner, never as a name containing the letters", () => {
    expect(hit("subject:me")).toBe(false)
    expect(hit("subject:me", entry({ subjectIsOwner: true, subjectName: null }))).toBe(true)
    expect(hit("subject:james")).toBe(true)
    expect(hit('subject:"person:7"')).toBe(true)
  })

  it("matches memo's kind and scope, the writer, and free words anywhere", () => {
    expect(hit("kind:preference scope:work by:hermes friday")).toBe(true)
    expect(hit("scope:personal")).toBe(false)
    expect(hit("by:me")).toBe(false)
    expect(hit("monday")).toBe(false)
  })

  it("chips write the same words a person types", () => {
    const q = setMemoryField("friday", "kind", ["decision", "preference"])
    expect(q).toBe("friday kind:(decision OR preference)")
    expect(memoryFilter(q)).toMatchObject({ kind: ["decision", "preference"], words: ["friday"] })
    expect(setMemoryField(q, "kind", [])).toBe("friday")
  })
})

describe("rules of a record's row", () => {
  it("puts a correction on one line and ignores one that changes nothing", () => {
    expect(oneLine("  a\n\n b\t c ")).toBe("a b c")
    expect(isCorrection("same\nthing", "same thing")).toBe(false)
    expect(isCorrection("  ", "x")).toBe(false)
    expect(isCorrection("new", null)).toBe(true)
  })

  it("counts what Approve would create", () => {
    const f = [
      { id: "a", kind: "fact" },
      { id: "b", kind: "task" },
    ]
    expect(tickedCount(f, ["b"])).toBe(1)
    expect(tickedCount(f, undefined)).toBe(2)
    expect(tickedCount(null, [])).toBe(0)
  })

  it("tells a batch by facts and tasks, then by created and left", () => {
    const f = [
      { id: "a", kind: "fact", outcome: "accepted" },
      { id: "b", kind: "task", outcome: "rejected" },
      { id: "c", kind: "fact" },
    ]
    expect(findingsCounts(f, "proposed")).toEqual({ reviewed: false, first: 2, second: 1 })
    expect(findingsCounts(f, "approved")).toEqual({ reviewed: true, first: 1, second: 2 })
  })

  it("picks a source's icon kind and a ref's kind", () => {
    expect(["meeting", "mail", "message", "msg", "doc", ""].map(sourceKindOf)).toEqual([
      "meeting",
      "mail",
      "message",
      "message",
      "note",
      "note",
    ])
    expect(refKind("mail:42")).toBe("mail")
    expect(refKind("")).toBe("")
  })

  it("opens what a finding made only when it is a fact or a task", () => {
    expect(createdTarget("task:9")).toBe("task")
    expect(createdTarget("fact:3")).toBe("fact")
    expect(createdTarget("memory:3")).toBeNull()
    expect(createdTarget(null)).toBeNull()
  })

  it("puts only memo's own ways back in the menu", () => {
    expect(["reject", "invalidate", "reverse", "revoke"].map((u) => undoMenuKey(u as never))).toEqual([
      "reject",
      "invalidate",
      "reverse",
      "revoke",
    ])
    expect(undoMenuKey("task")).toBeNull()
    expect(undoMenuKey("created")).toBeNull()
    expect(undoMenuKey("none")).toBeNull()
    expect(undoMenuKey(null)).toBeNull()
  })

  it("approves a batch only from its opened row", () => {
    expect(approveMode(false, false)).toBe("approve")
    expect(approveMode(true, false)).toBe("review")
    expect(approveMode(true, true)).toBe("approveFindings")
  })

  it("words the state by what the record is", () => {
    const base = { type: "memory", kind: "summary", author: null }
    expect(stateLineOf({ ...base, status: "proposed", findings: [] })).toBe("reviewFindings")
    expect(stateLineOf({ ...base, type: "action", status: "proposed" })).toBe("reviewAction")
    expect(stateLineOf({ ...base, status: "proposed" })).toBe("review")
    expect(stateLineOf({ ...base, status: "approved", findings: [] })).toBe("reviewed")
    expect(stateLineOf({ ...base, type: "action", status: "approved", task: "t" })).toBe("approved")
    expect(stateLineOf({ ...base, type: "action", status: "approved" })).toBe("approvedOld")
    expect(stateLineOf({ ...base, status: "confirmed" })).toEqual({ state: "inuse" })
  })

  it("builds an action's sentence from its verb, target and text", () => {
    expect(actionTargetOf({ targetName: "Kai", chatName: "Team" })).toBe("Kai")
    expect(actionTargetOf({ chatName: "Team" })).toBe("Team")
    expect(actionTargetOf({})).toBeNull()
    expect(actionSentence("Reply to", "Kai", "Hello")).toBe("Reply to Kai: Hello")
    expect(actionSentence("Reply", null, null)).toBe("Reply")
  })

  it("names a batch's subject from project, then subject, then ref", () => {
    const e = {
      subject: "person:1",
      subjectName: "Kai",
      subjectIsOwner: false,
      project: "project:2",
      projectName: null,
    }
    expect(batchSubjectOf(e, "Project")).toBe("Kai")
    expect(batchSubjectOf({ ...e, projectName: "Apollo" }, "Project")).toBe("Apollo")
    expect(batchSubjectOf({ ...e, subjectName: null }, "Project")).toBe("project:2")
    expect(batchSubjectOf({ ...e, subjectName: null, project: null }, "Project")).toBe("Project")
  })
})

describe("source reviews", () => {
  const marked = { id: "17090", cause: "changed" }

  it("shows a record whose source changed under Review as well as where its status puts it", () => {
    const e = { status: "confirmed", sourceReview: marked }
    expect(entryInTab("review", e)).toBe(true)
    expect(entryInTab("inuse", e)).toBe(true)
    expect(entryInTab("review", { status: "confirmed", sourceReview: null })).toBe(false)
    expect(entryInTab("review", { status: "confirmed" })).toBe(false)
  })

  it("reads an unknown cause from a newer memo as a plain change", () => {
    expect(causeOf("deleted")).toBe("deleted")
    expect(causeOf("expired")).toBe("changed")
  })

  it("offers Withdraw only where memo has a way to say it no longer holds", () => {
    expect(reviewChoices(entry("memory", "summary", "confirmed"))).toEqual([
      "stillTrue",
      "dismiss",
      "correct",
      "withdraw",
    ])
    expect(reviewChoices(entry("fact", "decision", "accepted"))).toContain("withdraw")
    expect(reviewChoices(entry("fact", "promise", "accepted"))).toEqual(["stillTrue", "dismiss", "correct"])
  })
})

describe("withCleanNames", () => {
  it("cleans a person's name and leaves a document's title as it is", () => {
    const e = { subject: "document:3", subjectName: "Release #12", target: "person:9", targetName: "Yaro null #907" }
    expect(withCleanNames(e)).toEqual({ ...e, targetName: "Yaro" })
  })
})

describe("Waiting for you's order", () => {
  it("puts findings and sourced facts first, then links, then the rest, newest first within each", () => {
    const e = (ref: string, type: string, createdAt: string, links = 0, findings: unknown[] | null = null) => ({
      ref,
      type,
      links,
      findings,
      createdAt,
    })
    const order = byReviewRank([
      e("bare fact", "fact", "2026-11-10T12:00:00Z"),
      e("link", "relationship", "2026-11-10T11:00:00Z"),
      e("old sourced fact", "fact", "2026-11-09T10:00:00Z", 2),
      e("findings", "memory", "2026-11-08T10:00:00Z", 0, []),
      e("new link", "relationship", "2026-11-10T13:00:00Z"),
    ]).map((x) => x.ref)
    expect(order).toEqual(["old sourced fact", "findings", "new link", "link", "bare fact"])
  })
})
