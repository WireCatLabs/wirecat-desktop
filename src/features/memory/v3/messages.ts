import { type Messages, plural } from "@/i18n"

export type View = "inbox" | "subjects" | "timeline"

const en = {
  intro:
    "Everything Memo knows, arranged by who or what it is about. New proposals from your agents wait in the inbox; nothing they write counts until you approve it.",
  views: { inbox: "Inbox", subjects: "People & projects", timeline: "Timeline" } satisfies Record<View, string>,
  show: "View",
  run: (what: string) => `proposed ${what}`,
  forSubject: "for",
  what: (counts: [string, number][]) =>
    counts.map(([word, n]) => plural("en", n, { one: `# ${word}`, other: `# ${word}s` })).join(" and "),
  words: { findings: "finding", memory: "memory", fact: "fact", action: "action" } as Record<string, string>,
  hint: "j k to move · a approve · e correct · d discard",
  inboxEmpty: "Nothing waits for you. New proposals from your agents land here.",
  approve: "Approve",
  confirm: "Confirm",
  discard: "Discard",
  correct: "Correct",
  save: "Save correction",
  cancel: "Cancel",
  fixLabel: "What is true instead",
  findingsLabel: "Findings to review",
  fact: "Fact",
  task: "Task",
  creates: (n: number, total: number, project: string) =>
    n === total
      ? `Approve creates all ${total} in ${project}.`
      : n === 0
        ? "Nothing is ticked: Approve would reject the whole batch."
        : `Approve creates ${n} of ${total} in ${project}; the rest are rejected.`,
  noContent: "Memo gives no content for this action.",
  notAbout: "Not about anyone",
  you: "You",
  unnamed: "Unnamed",
  counts: (waiting: number, kept: number) => `${waiting} waiting · ${kept} kept`,
  back: "All people and projects",
  kindLabel: { you: "You", person: "Person", project: "Project", other: "Other" } as Record<string, string>,
  search: (name: string) => `Search messages about ${name}`,
  waiting: "Waiting for you",
  knows: "What Memo knows",
  tasks: "Tasks",
  noTasks: "Tasks Memo creates for this project will show here.",
  writers: "Who wrote about it",
  details: "Details",
  writtenBy: "Written by",
  saved: "Saved",
  nothingKnown: "Memo holds nothing confirmed about this yet.",
  groups: {
    decision: "Decisions",
    promise: "Promises",
    preference: "Preferences",
    summary: "Summaries",
    digest: "Digests",
    statement: "Statements",
    fact: "Facts",
    question: "Questions",
  } as Record<string, string>,
  other: "Other",
  live: "Live",
  liveOff: "Updates on read",
  decided: {
    confirmed: (what: string) => `confirmed a ${what}`,
    discarded: (what: string) => `set aside a ${what}`,
  },
  failed: "failed",
  liveEvent: "codex-nbb-evaluation started a run on Northbridge Bench",
  timelineEmpty: "Nothing has happened yet.",
}

export const v3Messages: Messages<typeof en> = { en, ru: en, es: en }
export type V3 = typeof en
