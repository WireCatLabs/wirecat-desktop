// The `field:value` words a filter bar writes into its search text, and reads back out of it. Tasks hands the text to
// memo; Memory reads it here. Either way the filters and the typed text are one state.

const quote = (v: string) => (/^[\w*.-]+$/.test(v) ? v : `"${v.replaceAll('"', "")}"`)
const unquote = (v: string) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v)

// One term of a field: `field:value`, `field:"a b"`, `field:(a OR "b c")`, `field:[a TO b]`, with an optional NOT.
const VALUE = String.raw`(?:"[^"]*"|\([^)]*\)|\[[^\]]*\]|[^\s()]+)`
const term = (fields: string) => new RegExp(String.raw`(^|\s)(?:NOT\s+|-)?(?:${fields}):${VALUE}`, "g")

export const tidy = (q: string) => q.replace(/\s+/g, " ").trim()

/** The query without any term of the fields, given as `a|b`. */
export const dropFields = (q: string, fields: string) => tidy(q.replaceAll(term(fields), " "))

/** The values the query asks for in a field, as written: `project:(HRB OR OPS)` gives HRB and OPS. */
export function valuesOf(q: string, field: string): string[] {
  const out: string[] = []
  for (const m of q.matchAll(new RegExp(String.raw`(?:^|\s)${field}:(${VALUE})`, "g"))) {
    const raw = m[1] ?? ""
    if (raw.startsWith("(")) {
      for (const part of raw.slice(1, -1).split(/\s+OR\s+/)) if (part.trim()) out.push(unquote(part.trim()))
    } else out.push(unquote(raw))
  }
  return out
}

/** Writes one field's choices into the query, in place of what it said before. */
export function setField(q: string, field: string, values: readonly string[], owns = field): string {
  const rest = dropFields(q, owns)
  if (values.length === 0) return rest
  const words = values.map(quote)
  const written = words.length === 1 ? `${field}:${words[0]}` : `${field}:(${words.join(" OR ")})`
  return tidy(`${rest} ${written}`)
}

/** What is left once the fields' terms are taken out: plain words and quoted phrases, without their quotes. */
export function freeWords(q: string, fields: string): string[] {
  const rest = dropFields(q, fields)
  return [...rest.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => (m[1] ?? m[2] ?? "").trim()).filter(Boolean)
}
