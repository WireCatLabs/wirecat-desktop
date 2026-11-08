import type { AddedSource, Mentions, Reader, StoredSource } from "./memory-add-schemas"
import type { MemoryEntry } from "./memory-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Add to Memory's stand-in for memo's `sources` commands, with made-up people only. Readers: Ollama is the owner's
// pick unless `?readers=unchosen` (found, none picked) or `?readers=none` (nothing found). `?add=open` opens the panel
// on load. `?add-fail=link` refuses a link (the site answers 404), `?add-fail=suggest` fails the reading (the local
// model is not running), `?add-fail=key` refuses the key.

const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const readersScenario = params.get("readers")
const fail = params.get("add-fail")

const READERS: Reader[] = [
  {
    id: "claude-code",
    available: true,
    signedIn: true,
    model: "claude-sonnet",
    provider: "anthropic",
    leavesComputer: true,
    readsFiles: false,
    chosen: false,
  },
  {
    id: "codex",
    available: true,
    signedIn: true,
    model: "gpt-5-codex",
    provider: "openai",
    leavesComputer: true,
    readsFiles: true,
    chosen: false,
  },
  {
    id: "ollama",
    available: true,
    signedIn: null,
    model: "llama3.2",
    provider: null,
    leavesComputer: false,
    readsFiles: false,
    chosen: false,
  },
  {
    id: "key",
    available: false,
    signedIn: null,
    model: null,
    provider: "openai",
    leavesComputer: true,
    readsFiles: false,
    chosen: false,
  },
]

const MENTIONS: Mentions = {
  items: [
    { ref: "person:7", type: "person", name: "Lena Ortiz", foundAs: ["Lena"] },
    { ref: "organization:3", type: "organization", name: "Northbridge Bench", foundAs: ["Northbridge Bench"] },
  ],
  partial: false,
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

export function memoryAddMock(
  stage: (batch: MemoryEntry) => void,
): Pick<
  Platform,
  | "memoryPickFile"
  | "memorySourceAdd"
  | "memorySourceShow"
  | "memoryMentions"
  | "memorySourceSuggest"
  | "memoryReaders"
  | "memoryReaderChoose"
  | "memoryReaderKey"
> {
  let chosen = readersScenario === "unchosen" || readersScenario === "none" ? null : "ollama"
  let next = 42
  let keySaved = false
  const stored = new Map<string, StoredSource>()
  const readers = () =>
    readersScenario === "none"
      ? []
      : READERS.map((r) => ({ ...r, available: r.id === "key" ? keySaved : r.available, chosen: r.id === chosen }))

  return {
    async memoryPickFile() {
      await delay(300)
      return "/home/owner/Downloads/runner-notes.pdf"
    },
    async memorySourceAdd({ given, title }) {
      await delay(given.kind === "link" ? 1200 : 600)
      if (given.kind === "link" && fail === "link") throw new Error("source.url-status")
      const ref = `document:${next++}`
      const text =
        given.kind === "text"
          ? given.text
          : "Runner notes. Lena Ortiz says Northbridge Bench moves the eval set to 120 queries and delivery is on the 28th."
      const name = given.kind === "file" ? (given.path.split("/").pop() ?? null) : null
      const added: AddedSource = {
        ref,
        created: true,
        duplicateOf: null,
        title: title ?? name ?? (given.kind === "link" ? "Release notes" : (text.split("\n")[0] ?? "").slice(0, 60)),
        kind: given.kind === "link" ? "page" : given.kind,
        mime: given.kind === "file" ? "application/pdf" : given.kind === "link" ? "text/html" : null,
        bytes: given.kind === "file" ? 1_400_000 : text.length,
        chars: text.length,
        truncated: false,
        read: "extracted",
        url: given.kind === "link" ? given.url : null,
        kept: "text",
        searchableWords: true,
        searchableMeaning: false,
        subjects: [],
      }
      stored.set(ref, {
        ref,
        title: added.title,
        kind: added.kind,
        url: added.url,
        fileName: name,
        kept: "text",
        chars: text.length,
        text,
        textTruncated: false,
      })
      return added
    },
    async memorySourceShow(ref) {
      await delay(300)
      const s = stored.get(ref)
      if (!s) throw new Error(`${ref} is not a source`)
      return s
    },
    async memoryMentions() {
      await delay(400)
      return MENTIONS
    },
    async memorySourceSuggest(ref, reader, subjects) {
      await delay(2500)
      if (fail === "suggest") throw new Error("reader.not-running")
      const id = 900 + next++
      const quote = stored.get(ref)?.text.slice(0, 80) ?? ""
      const batch: MemoryEntry = {
        ref: `action:${id}`,
        type: "action",
        kind: "evidence_findings",
        text: null,
        summary: "Create 2 facts and 1 task",
        verb: "create",
        targetName: null,
        chatName: null,
        counts: { facts: 2, tasks: 1 },
        status: "proposed",
        subject: subjects[0] ?? null,
        subjectName: subjects[0] ? (MENTIONS.items.find((m) => m.ref === subjects[0])?.name ?? null) : null,
        subjectIsOwner: false,
        author: { type: "bot", name: "memo-reader" },
        scope: "work",
        project: null,
        projectName: null,
        supersedes: null,
        links: 1,
        reason: null,
        account: null,
        target: null,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        findings: [
          {
            id: "f1",
            kind: "fact",
            text: "The eval set moves to 120 queries.",
            reason: quote,
            evidence: [ref],
            outcome: null,
            created: null,
          },
          {
            id: "f2",
            kind: "fact",
            text: "Delivery is on the 28th.",
            reason: quote,
            evidence: [ref],
            outcome: null,
            created: null,
          },
          {
            id: "f3",
            kind: "task",
            text: "Send Lena the new query list",
            reason: quote,
            evidence: [ref],
            outcome: null,
            created: null,
          },
        ],
        task: null,
        model: `${reader}/${READERS.find((r) => r.id === reader)?.model ?? ""}`,
        confidence: null,
        sourceReview: null,
      }
      stage(batch)
      return { batch, reused: false }
    },
    async memoryReaders() {
      await delay(500)
      return readers()
    },
    async memoryReaderChoose(id) {
      await delay(300)
      chosen = id
      return readers()
    },
    async memoryReaderKey(provider, key) {
      await delay(400)
      if (fail === "key" || words(key) !== 1) throw new Error("the provider refused this key")
      keySaved = true
      return { provider, source: "keyring" }
    },
  }
}
