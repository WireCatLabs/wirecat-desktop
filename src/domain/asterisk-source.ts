/**
 * asterisk reads a profile's calls from where `config set` points it: Master.csv on this computer, or a CDR database.
 * The plan saves these settings before `session start` checks them (asterisk-cli `src/config.ts`, 0.1.0). The method
 * is `cdr_source` itself; only a database takes a password, on stdin.
 */
export const ASTERISK = "asterisk"

export type SourceField = "cdr_csv_path" | "db_host" | "db_port" | "db_name" | "db_user" | "db_tls" | "recordings_path"

const FIELDS: Record<string, SourceField[]> = {
  csv: ["cdr_csv_path", "recordings_path"],
  mysql: ["db_host", "db_port", "db_name", "db_user", "db_tls", "recordings_path"],
  postgres: ["db_host", "db_port", "db_name", "db_user", "db_tls", "recordings_path"],
}

const REQUIRED = new Set<SourceField>(["cdr_csv_path", "db_host", "db_name", "db_user"])

export const sourceFields = (method: string | null): SourceField[] => FIELDS[method ?? ""] ?? []

export const isRequired = (field: SourceField) => REQUIRED.has(field)

type SourceProblem = { field: SourceField; kind: "empty" | "port" }

const portOk = (text: string) => /^\d{1,5}$/.test(text) && Number(text) >= 1 && Number(text) <= 65535

/** The first field Start cannot go on without, in the order the plan shows them. */
export function sourceProblem(method: string | null, typed: Record<string, string>): SourceProblem | null {
  for (const field of sourceFields(method)) {
    const value = typed[field]?.trim() ?? ""
    if (REQUIRED.has(field) && !value) return { field, kind: "empty" }
    if (field === "db_port" && value && !portOk(value)) return { field, kind: "port" }
  }
  return null
}

/** What `config set` saves, `cdr_source` first; an optional field left empty keeps the tool's default. */
export function sourceSettings(method: string | null, typed: Record<string, string>): [string, string][] {
  const fields = sourceFields(method)
  if (!method || fields.length === 0) return []
  const set: [string, string][] = [["cdr_source", method]]
  for (const field of fields) {
    const value = field === "db_tls" ? String(typed[field] === "true") : (typed[field]?.trim() ?? "")
    if (value) set.push([field, value])
  }
  return set
}
