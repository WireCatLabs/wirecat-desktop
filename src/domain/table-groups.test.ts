import { expect, it } from "vitest"
import { groupOf } from "./table-groups"

it("groups tables by what they hold, from the name the store gives them", () => {
  const data = (name: string) => groupOf({ name, kind: "data" })
  expect(data("messages")).toBe("messages")
  expect(data("email_threads")).toBe("mail")
  expect(data("calendar_entries")).toBe("meetings")
  expect(data("notes")).toBe("documents")
  expect(data("persons")).toBe("people")
  expect(data("task_events")).toBe("tasks")
  expect(data("facts")).toBe("memory")
  expect(data("taggings")).toBe("tags")
  expect(data("embeddings")).toBe("search")
  expect(data("note_index_pending")).toBe("search")
  expect(data("vector_index_1_rowids")).toBe("search")
  expect(data("sync_cursors")).toBe("system")
  expect(groupOf({ name: "messages_fts_data", kind: "search_index_part" })).toBe("search")
  expect(groupOf({ name: "sqlite_sequence", kind: "internal" })).toBe("system")
  expect(data("something_new")).toBe("other")
})
