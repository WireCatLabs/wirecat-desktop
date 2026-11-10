#!/usr/bin/env node
// Loads the synthetic seed set into the sandbox it runs in, through the tools' own commands. Run by bin/sandbox inside
// the sandbox's environment; running it anywhere else would write into whatever store MESSAGING_STORE names.
// Every step looks up what is there first, so a second run adds nothing and a newer seed version updates what changed.
//
//   node scripts/sandbox-seed/load.mjs <anchor-file>
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { anchorOf, readJson, SeedError } from "./lib.mjs"
import contacts from "./steps/contacts.mjs"
import crm from "./steps/crm.mjs"
import digests from "./steps/digests.mjs"
import mail from "./steps/mail.mjs"
import matches from "./steps/matches.mjs"
import memory from "./steps/memory.mjs"
import notes from "./steps/notes.mjs"
import phone from "./steps/phone.mjs"
import tasks from "./steps/tasks.mjs"

// contacts fills ctx.refs for every step after it. Chat messages from tg, max and wa, once a command loads them, go in
// a step after phone: tasks and memory cite messages as evidence.
const STEPS = { notes, contacts, phone, mail, crm, tasks, memory, matches, digests }

/** Every reason this process could reach the owner's own notes, store, mail settings or keyring. */
function outsideSandbox(env) {
  const { WIRECAT_SANDBOX: name, HOME: home } = env
  if (!name) return ["WIRECAT_SANDBOX is not set"]
  const problems = []
  const inHome = (key) => env[key]?.startsWith(`${home}/`)
  if (!home?.endsWith(`/wirecat-sandbox/${name}/home`)) problems.push(`HOME is not …/wirecat-sandbox/${name}/home`)
  if (!inHome("MESSAGING_STORE")) problems.push("MESSAGING_STORE is not inside HOME")
  for (const key of ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME"]) {
    if (env[key] && !inHome(key)) problems.push(`${key} is not inside HOME`)
  }
  if (env.DBUS_SESSION_BUS_ADDRESS !== "disabled:") problems.push("DBUS_SESSION_BUS_ADDRESS is not disabled:")
  return problems
}

const [anchorFile] = process.argv.slice(2)
const problems = outsideSandbox(process.env)
if (!anchorFile || problems.length) {
  const why = problems.map((p) => `\n  ${p}`).join("")
  console.error(`sandbox-seed: run through bin/sandbox <name> --seed demo, never against your own store${why}`)
  process.exit(2)
}

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "data")
const ctx = {
  data: (name) => readJson(dataDir, name),
  version: readJson(dataDir, "seed.json").version,
  anchor: anchorOf(anchorFile),
  home: process.env.HOME,
  /** Seed id → store ref (person:12, organization:3), filled by the contacts step for the steps after it. */
  refs: new Map(),
}

try {
  for (const [name, step] of Object.entries(STEPS)) console.log(`  ${name}: ${step(ctx)}`)
} catch (e) {
  if (!(e instanceof SeedError)) throw e
  console.error(`sandbox-seed: ${e.message}`)
  process.exit(1)
}
