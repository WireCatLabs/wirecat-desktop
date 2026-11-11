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
          linkedAt: "2026-10-02T10:00:00.000Z",
          movable: true,
        },
      ],
      merges: [
        {
          id: "merge:7-12",
          from: "person:12",
          identities: ["email:lena@example.org"],
          method: "same-email",
          at: null,
        },
      ],
      matches: [
        {
          id: "17100",
          persons: ["person:9", "person:7"],
          identity: "max:9020",
          with: "telegram:4411",
          joins: "person",
          signal: "phone",
          score: null,
          shared: null,
          mailbox: null,
          candidates: [],
          reason: null,
          evidence: [],
          proposer: { kind: "rule", name: "rule" },
        },
      ],
    }
    expect(v.parse(PersonDetailSchema, person)).toMatchObject(person)
  })

  it("reads every state of the page's read", () => {
    for (const read of [
      { kind: "missing" },
      { kind: "old", version: null, need: "0.131.72" },
      {
        kind: "ready",
        people: [
          {
            ref: "person:1",
            name: null,
            owner: true,
            tasks: 2,
            displayName: null,
            kind: null,
            contact: null,
            messagesFrom: 3,
            lastContact: null,
          },
        ],
        peopleMore: true,
        matches: [],
        matchesMore: false,
        kinded: true,
      },
    ])
      expect(v.parse(PeopleReadSchema, read)).toMatchObject(read)
  })
})
