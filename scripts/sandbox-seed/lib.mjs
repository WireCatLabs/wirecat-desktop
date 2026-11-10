import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

export class SeedError extends Error {}

/** Runs a tool with --json and returns its parsed answer; an agent's run waits for the owner, as a real agent's does. */
export function runTool(bin, args, { agent = false, path } = {}) {
  const env = { ...process.env }
  if (agent) env.AI_AGENT = "sandbox-seed"
  if (path) env.PATH = `${path}:${env.PATH}`
  let out
  try {
    const [head, query] = splitQuery(args)
    out = execFileSync(bin, [...head, "--json", ...query], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
  } catch (e) {
    out = e.stdout || ""
    if (!out.trim()) throw new SeedError(`${bin} ${args.join(" ")}: ${(e.stderr || e.message).trim()}`)
  }
  const answer = JSON.parse(out)
  if (answer.error) throw new SeedError(`${bin} ${args.join(" ")}: ${answer.error.message}`)
  return answer
}

export const memo = (args, options) => runTool("memo", args, options)

/**
 * Every page of a memo list, so a lookup never misses a row past the first page. Lists page by number or by cursor;
 * the answer says which.
 */
export function memoAll(args, limit = 500) {
  const [head, query] = splitQuery(args)
  const items = []
  let next = []
  for (;;) {
    const answer = memo([...head, "--limit", String(limit), ...next, ...query])
    items.push(...(answer.items ?? []))
    const page = answer.page ?? {}
    if (!page.has_more) return items
    if (page.next_cursor) next = ["--cursor", page.next_cursor]
    else if (page.next_page) next = ["--page", String(page.next_page)]
    else throw new SeedError(`memo ${args.join(" ")}: more rows than one page, and no way to the next`)
  }
}

/** Lists that take only AND-joined terms: one list per status, merged. */
export const memoEach = (args, field, values) => values.flatMap((v) => memoAll([...args, "--", `${field}:${v}`]))

const splitQuery = (args) => {
  const at = args.indexOf("--")
  return at < 0 ? [args, []] : [args.slice(0, at), args.slice(at)]
}

/** Writes only when the text differs, so an unchanged seed leaves files and their times alone. */
export function writeIfChanged(file, text) {
  let old = null
  try {
    old = readFileSync(file, "utf8")
  } catch {}
  if (old === text) return false
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text, { mode: 0o600 })
  return true
}

export const readJson = (dir, name) => JSON.parse(readFileSync(join(dir, name), "utf8"))

/**
 * Seed dates count back from the day of the first load, kept in the sandbox: the data looks recent then, and a later
 * run writes the same dates, so it changes nothing.
 */
export function anchorOf(file) {
  try {
    return new Date(readFileSync(file, "utf8").trim())
  } catch {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    writeIfChanged(file, `${today.toISOString()}\n`)
    return today
  }
}

export function dayOf(anchor, daysAgo, time = "09:00") {
  const [h, m] = time.split(":").map(Number)
  const d = new Date(anchor)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return d
}
