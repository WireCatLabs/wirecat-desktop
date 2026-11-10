/** Why memo refused a task's write, in words the page can explain; memo's own text stays behind a click. */
export type TaskFailure = "account" | "projectOnly" | "busy" | "timeout" | "missing" | "other"

// memo's messages (cli-memo `src/tasks/shared.ts`, `src/tasks/tasks.ts`, cli-core's store) carry no reason of their
// own for these: every one is `input.invalid`.
const RULES: [TaskFailure, RegExp][] = [
  ["account", /\bgive --(account|source)\b/],
  ["projectOnly", /only a project task|are for a project task|are for a task in a project/],
  ["busy", /\b(database is locked|SQLITE_BUSY|holds the store|another memo process)\b/i],
  ["timeout", /\btimed? ?out\b/i],
  ["missing", /\bMemo is not installed\b/],
]

export function taskFailure(raw: string): TaskFailure {
  return RULES.find(([, re]) => re.test(raw))?.[0] ?? "other"
}
