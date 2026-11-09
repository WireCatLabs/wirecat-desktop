import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { AddedSourceSchema, ReaderSchema } from "./memory-add-schemas"
import { MemoryEntrySchema, SourceReviewSchema } from "./memory-schemas"

// The same literals `answers_serialize_as_the_interface_reads_them` in memory_add.rs asserts Rust prints.
const ADDED = {
  ref: "document:42",
  created: true,
  duplicateOf: null,
  title: "Call with Lena",
  kind: "text",
  mime: null,
  bytes: 812,
  chars: 800,
  truncated: false,
  read: "extracted",
  url: null,
  kept: "text",
  searchableWords: true,
  searchableMeaning: false,
  subjects: ["person:7"],
}

const READER = {
  id: "ollama",
  available: true,
  signedIn: null,
  model: "llama3.2",
  provider: null,
  leavesComputer: false,
  readsFiles: false,
  chosen: false,
}

const ENTRY = {
  ref: "memory:3",
  type: "memory",
  kind: "summary",
  text: "Delivery is on the 28th",
  summary: null,
  verb: null,
  targetName: null,
  chatName: null,
  counts: null,
  status: "confirmed",
  subject: null,
  subjectName: null,
  subjectIsOwner: false,
  author: null,
  scope: "work",
  project: null,
  projectName: null,
  supersedes: null,
  links: 1,
  reason: null,
  account: null,
  target: null,
  createdAt: "2026-11-01T10:00:00.000Z",
  updatedAt: null,
  findings: null,
  task: null,
  model: null,
  confidence: null,
}

describe("Add to Memory schemas", () => {
  it("reads what memory_add.rs answers", () => {
    expect(v.parse(AddedSourceSchema, ADDED)).toEqual(ADDED)
    expect(v.parse(ReaderSchema, READER)).toEqual(READER)
  })

  it("reads a record with a source review, and one from before memo had them", () => {
    const marked = { ...ENTRY, sourceReview: { id: "17090", cause: "changed" } }
    expect(v.parse(MemoryEntrySchema, marked).sourceReview).toEqual({ id: "17090", cause: "changed" })
    expect(v.parse(MemoryEntrySchema, ENTRY).sourceReview).toBeNull()
  })

  it("reads a review whose source is gone", () => {
    const review = {
      id: "17091",
      cause: "deleted",
      raisedAt: null,
      sources: [{ ref: null, kind: "note", cause: "deleted", replacement: null, quote: null, cited: "x", now: null }],
      challenges: [],
      suggestions: [],
    }
    expect(v.parse(SourceReviewSchema, review)).toEqual(review)
  })
})
