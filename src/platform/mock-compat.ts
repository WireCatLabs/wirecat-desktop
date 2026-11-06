import type { Preflight, StoreCompat, ToolView } from "@/domain/compat"
import { isNewer } from "@/domain/status"

// Tools on mixed store support, for a store at schema 33 that needs at least 32. Telegram and MAX read it; WhatsApp
// 0.6 is too old; Memo 0.93 and Zoom predate `store info`, and only Memo is in the store's list of clients. WhatsApp
// 0.7 and MAX 0.75 move the store to 34, which nothing older reads.

const FILE = { version: 33, minCompatible: 32 }
const MOVES = { version: 34, minCompatible: 34 }

/** `current` answers like a tool on cli-core with `schema.reason`; an older one prints only `speaks` and `writable`. */
const SUPPORT: Record<string, { speaks: number; current: boolean } | null> = {
  "tg@0.88.0": { speaks: 33, current: false },
  "tg@0.89.0": { speaks: 34, current: true },
  "max@0.74.0": { speaks: 33, current: false },
  "max@0.75.0": { speaks: 34, current: true },
  "wa@0.6.0": { speaks: 29, current: false },
  "wa@0.7.0": { speaks: 34, current: true },
  "memo@0.95.0": { speaks: 33, current: true },
  "drive@0.30.0": { speaks: 33, current: true },
}

const viewOf = (id: string, version: string): ToolView => {
  const support = SUPPORT[`${id}@${version}`]
  if (!support)
    return {
      id,
      outcome: "unknown",
      speaks: null,
      writable: null,
      reason: null,
      upgrade: null,
      file: null,
      exists: null,
      problem: null,
    }
  const { speaks, current } = support
  const older = speaks > FILE.version
  return {
    id,
    outcome: "answered",
    speaks,
    writable: speaks >= FILE.minCompatible,
    reason: current ? (older ? "older" : "current") : null,
    upgrade: current && older ? MOVES : null,
    file: FILE,
    exists: true,
    problem: null,
  }
}

export async function storeCompatMock(installed: ReadonlyMap<string, string>): Promise<StoreCompat> {
  await new Promise((r) => setTimeout(r, 300))
  return {
    tools: [...installed].map(([id, version]) => viewOf(id, version)),
    clients: [
      { command: "memo", version: "0.93.0", speaks: 31 },
      { command: "tg", version: "0.88.0", speaks: 33 },
    ],
  }
}

/** The installed tool that reads the newest schema, as Rust picks the one to answer `store info`. */
export function newestReader(installed: ReadonlyMap<string, string>): string | null {
  const ranked = [...installed]
    .map(([id, version]) => [id, SUPPORT[`${id}@${version}`]?.speaks ?? 0] as const)
    .filter(([, speaks]) => speaks > 0)
    .sort((a, b) => b[1] - a[1])
  return ranked[0]?.[0] ?? null
}

/**
 * `?store-check=cannot-open`: the newest version of the tool cannot open the store. `update-too`: every other installed
 * tool that reads the store stops, and those with a newer version (Telegram 0.89) read it after. `wait`: they all stop.
 */
export async function storePreflightMock(
  id: string,
  installed: ReadonlyMap<string, string>,
  latest: Readonly<Record<string, string>>,
  scenario: string | null,
): Promise<Preflight> {
  await new Promise((r) => setTimeout(r, 300))
  const version = latest[id] ?? null
  const none = { version, known: scenario !== null, cannotOpen: null, stops: [] }
  if (scenario === "cannot-open") return { ...none, cannotOpen: { speaks: 31, needs: FILE.minCompatible } }
  if (scenario !== "update-too" && scenario !== "wait") return none
  const stops = [...installed]
    .filter(([other, v]) => other !== id && SUPPORT[`${other}@${v}`])
    .map(([other, v]) => {
      const newest = latest[other]
      const fixed = scenario === "update-too" && newest && isNewer(newest, v) && SUPPORT[`${other}@${newest}`]
      return { id: other, fixedIn: fixed ? newest : null }
    })
  return { ...none, stops }
}
