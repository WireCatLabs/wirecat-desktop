/**
 * pbx (asterisk-cli) reads a profile's calls from where `config set` points it: Master.csv on this computer, or a CDR database.
 * The plan saves these settings before `session start` checks them (asterisk-cli `src/config.ts`, 0.4.0). The method
 * is `cdr_source` itself; only a database takes a password, on stdin. `phone_region` names the countries whose
 * numbers the phone lines write without their code, so a caller links to a contact by the full number.
 */
export const ASTERISK = "pbx"

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

/** The countries cli-core's phone rules know (`PHONE_COUNTRIES` in `@wirecat/cli-core`), in its order. */
export const PHONE_COUNTRIES = [
  "us",
  "ca",
  "gb",
  "ie",
  "es",
  "pt",
  "fr",
  "be",
  "nl",
  "lu",
  "de",
  "at",
  "ch",
  "li",
  "it",
  "mt",
  "si",
  "hr",
  "ba",
  "rs",
  "me",
  "mk",
  "al",
  "gr",
  "cy",
  "bg",
  "ro",
  "md",
  "hu",
  "sk",
  "cz",
  "pl",
  "lt",
  "lv",
  "ee",
  "fi",
  "se",
  "no",
  "dk",
  "is",
  "ua",
  "by",
  "ru",
  "kz",
  "ge",
  "am",
  "tr",
] as const

/** The region of the first system language that names one pbx knows: `ru-RU` is Russia, a bare `ru` names none. */
export function localCountry(languages: readonly string[]): string | null {
  for (const tag of languages) {
    let region: string | undefined
    try {
      region = new Intl.Locale(tag).region?.toLowerCase()
    } catch {
      continue
    }
    if (region && (PHONE_COUNTRIES as readonly string[]).includes(region)) return region
  }
  return null
}

/** The countries chosen, in the order chosen; `fallback` until the owner touches the list. */
export const phoneRegions = (typed: Record<string, string>, fallback: string | null): string[] => {
  const saved = typed.phone_region
  if (saved === undefined) return fallback ? [fallback] : []
  return saved.split(",").filter(Boolean)
}

/** What `config set` saves, `cdr_source` first; an optional field left empty keeps the tool's default. */
export function sourceSettings(
  method: string | null,
  typed: Record<string, string>,
  country: string | null,
): [string, string][] {
  const fields = sourceFields(method)
  if (!method || fields.length === 0) return []
  const set: [string, string][] = [["cdr_source", method]]
  for (const field of fields) {
    const value = field === "db_tls" ? String(typed[field] === "true") : (typed[field]?.trim() ?? "")
    if (value) set.push([field, value])
  }
  const regions = phoneRegions(typed, country)
  if (regions.length > 0) set.push(["phone_region", regions.join(",")])
  return set
}
