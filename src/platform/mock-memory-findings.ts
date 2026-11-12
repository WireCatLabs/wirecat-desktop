import type { MemoryEntry } from "./memory-schemas"
import type { Platform } from "./types"

// The findings of a staged batch as memo 0.131.86 answers them. `?memory-edit=old` is a memo before `actions edit`,
// `stale` refuses the first edit as an agent restaged the batch. `?memory-partial=on` shows a batch decided in part at
// a terminal: its first finding accepted, the rest still waiting.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
export const findingsEditOpen = params.get("memory-edit") !== "old"

/** The fields of a finding a message names, as Rust's `editable` gives them: its words first, then why. */
const MAIN = ["title", "statement", "body", "name", "detail"]
const EDITS: Record<string, string[]> = {
  task: ["title", "reason"],
  fact: ["statement"],
  memory: ["body", "reason"],
  new_contact: ["name", "reason"],
  invoice: ["reason"],
}

export function partly(e: MemoryEntry): MemoryEntry {
  if (params.get("memory-partial") !== "on" || e.ref !== "action:7" || !e.findings) return e
  const [first, ...rest] = e.findings
  if (!first) return e
  return { ...e, findings: [{ ...first, outcome: "accepted", created: "fact:22" }, ...rest] }
}

/** A waiting finding's fields, as Rust reads them from the payload memo gives. */
export function withEdits(e: MemoryEntry): MemoryEntry {
  if (!e.findings || e.status !== "proposed") return e
  const findings = e.findings.map((f) =>
    f.outcome
      ? f
      : {
          ...f,
          edits: (EDITS[f.kind] ?? []).map((name) => ({ name, value: name === "reason" ? f.reason : f.text })),
        },
  )
  return { ...e, findings }
}

/** A confirm names the approved findings, a reject follows for the other waiting ones, an earlier outcome stays. */
export function decide(e: MemoryEntry, accept: string[], created: (kind: string) => string | null) {
  return (e.findings ?? []).map((f) => {
    if (f.outcome) return f
    const accepted = accept.includes(f.id)
    return { ...f, outcome: accepted ? "accepted" : "rejected", created: accepted ? created(f.kind) : null, edits: [] }
  })
}

export function findingEditMock(
  find: (ref: string) => MemoryEntry,
  put: (e: MemoryEntry) => void,
  write: () => Promise<void>,
): Pick<Platform, "memoryFindingEdit"> {
  let restaged = params.get("memory-edit") !== "stale"
  let next = 50
  return {
    async memoryFindingEdit(ref, finding, fingerprint, changes) {
      await write()
      const e = find(ref)
      if (!restaged) {
        // An agent staged the batch again meanwhile: the page holds the old fingerprint.
        restaged = true
        put({ ...e, fingerprint: "77c0de" })
        throw new Error("findings.stale")
      }
      if (e.fingerprint !== fingerprint) throw new Error("findings.stale")
      const findings = (e.findings ?? []).map((f) => {
        if (f.id !== finding) return f
        const changed = (name: string) => changes.find((c) => c.name === name)
        const main = MAIN.map(changed).find(Boolean)
        const reason = changed("reason")
        return {
          ...f,
          text: main?.value ?? f.text,
          reason: reason ? reason.value : f.reason,
          edits: (f.edits ?? []).map((x) => {
            const c = changed(x.name)
            return c ? { ...x, value: c.value } : x
          }),
        }
      })
      const done = { ...e, findings, fingerprint: `${fingerprint.slice(0, 3)}${next++}` }
      put(done)
      return done
    },
  }
}
