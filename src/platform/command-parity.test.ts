import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = join(__dirname, "../..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

const OPEN = "({[<"
const CLOSE = ")}]>"

function closing(text: string, open: number, angles = false): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === "-" && text[i + 1] === ">") i++
    else if (OPEN.includes(c) && (angles || c !== "<")) depth++
    else if (CLOSE.includes(c) && (angles || c !== ">") && --depth === 0) return i
  }
  return -1
}

function topLevel(body: string, angles = false): string[] {
  const parts = [""]
  let depth = 0
  for (const c of body) {
    if (OPEN.includes(c) && (angles || c !== "<")) depth++
    if (CLOSE.includes(c) && (angles || c !== ">")) depth--
    if (c === "," && depth === 0) parts.push("")
    else parts[parts.length - 1] += c
  }
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** The keys of every outermost object literal in an argument, so `agent ? { agent } : {}` gives `agent`. */
function keysOf(arg: string): string[] {
  const keys: string[] = []
  for (let i = 0; i < arg.length; i++) {
    if (arg[i] !== "{") continue
    const end = closing(arg, i)
    keys.push(...topLevel(arg.slice(i + 1, end)).map((p) => p.split(":")[0].trim()))
    i = end
  }
  return keys
}

/** Every command the interface invokes, with the argument keys it passes; null when the argument is not literal. */
function invoked(): Map<string, string[] | null> {
  const bridge = read("src/platform/bridge.ts")
  const calls = new Map<string, string[] | null>()
  for (const m of bridge.matchAll(/\b(invoke|call)(?:<[^>(]*>)?\(/g)) {
    const open = (m.index ?? 0) + m[0].length - 1
    const args = topLevel(bridge.slice(open + 1, closing(bridge, open)))
    const at = m[1] === "call" ? 1 : 0
    const name = args[at]?.match(/^"(\w+)"$/)?.[1]
    if (!name) continue
    const arg = args[at + 1]
    calls.set(name, arg === undefined ? [] : arg.includes("{") ? keysOf(arg) : null)
  }
  return calls
}

const INJECTED = /^(?:tauri::)?(?:State|AppHandle|Window|Webview|WebviewWindow|ipc::Request)\b/
const camel = (name: string) => name.replace(/^mut /, "").replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

type Param = { key: string; optional: boolean }

/** Every `#[tauri::command]` in lib.rs and src-tauri/src/commands, with the keys Tauri reads from its arguments. */
function commands(): Map<string, Param[]> {
  const dir = "src-tauri/src/commands"
  const sources = [read("src-tauri/src/lib.rs"), ...readdirSync(join(ROOT, dir)).map((f) => read(`${dir}/${f}`))]
  const found = new Map<string, Param[]>()
  for (const src of sources) {
    for (const m of src.matchAll(
      /#\[tauri::command\]\s*(?:(?:#\[[^\]]*\]|\/\/\/[^\n]*)\s*)*pub (?:async )?fn (\w+)[^(]*\(/g,
    )) {
      const open = (m.index ?? 0) + m[0].length - 1
      const params = topLevel(src.slice(open + 1, closing(src, open, true)), true)
        .map((p) => p.split(/:(.*)/s).map((s) => s.trim()))
        .filter(([, type]) => !INJECTED.test(type))
        .map(([name, type]) => ({ key: camel(name), optional: type.startsWith("Option<") }))
      found.set(m[1], params)
    }
  }
  return found
}

const registered = () =>
  [
    ...(read("src-tauri/src/lib.rs").match(/generate_handler!\[([^\]]*)\]/)?.[1] ?? "").matchAll(/(\w+)\s*(?:,|$)/g),
  ].map((m) => m[1])

describe("the interface and Rust agree on every command", () => {
  const calls = invoked()
  const rust = commands()
  const handlers = registered()

  it("finds the commands on both sides", () => {
    expect(calls.size).toBeGreaterThan(200)
    expect(handlers.length).toBeGreaterThan(200)
  })

  it("invokes only registered commands, and registers only what it invokes", () => {
    expect([...calls.keys()].filter((name) => !handlers.includes(name))).toEqual([])
    expect(handlers.filter((name) => !calls.has(name))).toEqual([])
    expect(handlers.filter((name) => !rust.has(name))).toEqual([])
  })

  it("passes every argument by its camelCased Rust name, and every required one", () => {
    // A wrong key for an optional parameter would otherwise arrive silently as None.
    const wrong = [...calls].flatMap(([name, keys]) => {
      const params = rust.get(name)
      if (!params) return []
      if (keys === null) return [`${name}: pass its arguments as an object literal`]
      const unknown = keys.filter((k) => !params.some((p) => p.key === k)).map((k) => `${name}: unknown ${k}`)
      const missing = params.filter((p) => !p.optional && !keys.includes(p.key)).map((p) => `${name}: missing ${p.key}`)
      return [...unknown, ...missing]
    })
    expect(wrong).toEqual([])
  })
})
