import * as v from "valibot"
import { describe, expect, it } from "vitest"
import { PeopleReadSchema, PersonDetailSchema } from "./people-schemas"

// The shapes `answers_serialize_as_the_interface_reads_them` in people.rs checks Rust prints.
describe("People schemas", () => {
  it("reads a person with accounts in two scopes, a merge and a match", () => {
    const person = {
      ref: "person:7",
      name: "Lena Ortiz",
      mergedInto: null,
      identities: [
        {
          identity: "email:lena@example.org",
          provider: "email",
          name: "Lena Ortiz",
          username: null,
          seenIn: [
            { account: "2", scope: "work" },
            { account: "3", scope: "personal" },
          ],
          method: "same-email",
          linkedBy: "memo",
          linkedAt: "2026-10-02T10:00:00.000Z",
        },
      ],
      merges: [
        {
          id: "merge:7-12",
          from: "person:12",
          identities: [{ identity: "email:lena@example.org", name: "Lena Ortiz" }],
          method: "same-email",
          by: "memo",
          at: null,
        },
      ],
      matches: [
        {
          id: "17100",
          persons: ["person:7", "person:9"],
          summary: null,
          reason: "the same phone",
          evidence: ["telegram:4411"],
          proposedBy: "memo",
          createdAt: null,
        },
      ],
    }
    expect(v.parse(PersonDetailSchema, person)).toEqual(person)
  })

  it("reads every state of the page's read", () => {
    for (const read of [
      { kind: "missing" },
      { kind: "old", version: null, need: "0.132.0" },
      { kind: "ready", people: [{ ref: "person:1", name: null, owner: true, tasks: 0 }], matches: [] },
    ])
      expect(v.parse(PeopleReadSchema, read)).toEqual(read)
  })
})
