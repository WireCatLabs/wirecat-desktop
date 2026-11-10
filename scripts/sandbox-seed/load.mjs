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

const STEPS = { notes, contacts, phone, mail, crm, tasks, memory, matches, digests }

const [anchorFile] = process.argv.slice(2)
if (!anchorFile || !process.env.WIRECAT_SANDBOX) {
  console.error("sandbox-seed: run through bin/sandbox <name> --seed demo, never against your own store")
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
