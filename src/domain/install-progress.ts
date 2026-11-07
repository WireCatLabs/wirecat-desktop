/**
 * What npm is doing during an install, read from its `--loglevel http` lines (`install.rs`). Measured on npm 11
 * (2026-11-02, @wirecat/tg-cli): about 300 lookups of package details, then one `http cache … .tgz` line for every
 * package to unpack, then, on a cold cache, one `http fetch GET 200 … .tgz` line as each download lands. A warm cache
 * prints only the `cache` lines, one as each package is unpacked, so no total is known.
 */
import type { InstallOutcome, InstallSession, InstallStep, VerifyCheck } from "./status"
export type NpmPhase = "resolve" | "fetch" | "setup"

export type NpmProgress = {
  /** null for pnpm, bun and anything else that never reports progress: they get elapsed time only. */
  phase: NpmPhase | null
  looked: number
  /** Packages known to be needed; null while that is not known yet, or never (a warm cache). */
  total: number | null
  done: number
  cached: ReadonlySet<string>
  fetched: ReadonlySet<string>
}

export const startProgress = (): NpmProgress => ({
  phase: null,
  looked: 0,
  total: null,
  done: 0,
  cached: new Set(),
  fetched: new Set(),
})

// `install.rs` echoes the command first, so npm shows its bar from the first second, not from its first http line.
const NPM_COMMAND = /^\$ npm install /
const HTTP = /^npm http (fetch|cache) /
const TARBALL = /(\S+\.tgz)\b/
const ADDED = /\b(?:added|changed) (\d+) packages?\b/

/** True for a line that only feeds progress; the readable log leaves it out, but keeps a failed fetch, which names the package. */
export const isProgressLine = (line: string) => /^npm http (fetch GET 200 |cache )/.test(line)

/** The progress after one more line of npm's output. */
export function readNpmLine(p: NpmProgress, line: string): NpmProgress {
  if (NPM_COMMAND.test(line)) return p.phase === null ? { ...p, phase: "resolve" } : p
  const added = ADDED.exec(line)
  if (added) {
    const n = Number(added[1])
    return { ...p, phase: "setup", total: n, done: n }
  }
  const http = HTTP.exec(line)
  if (!http) return p
  const tarball = TARBALL.exec(line)?.[1]
  if (!tarball) return p.phase === null || p.phase === "resolve" ? { ...p, phase: "resolve", looked: p.looked + 1 } : p
  const name = tarball.slice(tarball.lastIndexOf("/") + 1)
  const cached = http[1] === "cache" ? new Set(p.cached).add(name) : p.cached
  const fetched = http[1] === "fetch" ? new Set(p.fetched).add(name) : p.fetched
  const total = fetched.size > 0 ? Math.max(cached.size, fetched.size, p.total ?? 0) : null
  // A cold cache prints every `cache` line within milliseconds before its first download, so the count it starts
  // from is never drawn; from the first download on, only downloads count.
  const done = fetched.size > 0 ? fetched.size : cached.size
  const phase = total !== null && done >= total ? "setup" : "fetch"
  return { ...p, phase, cached, fetched, total, done }
}

/** 0 to 1 over the whole install; null for a manager that reports nothing, so it gets no bar at all. */
export function fraction(p: NpmProgress): number | null {
  if (p.phase === null) return null
  if (p.phase === "setup") return 1
  if (p.phase !== "fetch" || !p.total) return 0
  return Math.min(1, p.done / p.total)
}

type SessionEvent =
  | { event: "step"; step: InstallStep }
  | { event: "check"; what: VerifyCheck }
  | { event: "log"; line: string }
  | InstallOutcome

/** One event of `install.rs` applied to a session: the Tools page's store and the own-tool dialog read the same. */
export function applyInstallEvent(s: InstallSession, e: SessionEvent, now = Date.now()): InstallSession {
  if (e.event === "step") return { ...s, step: e.step, began: { ...s.began, [e.step]: now } }
  if (e.event === "check") return { ...s, verifying: e.what }
  if (e.event === "log") {
    const progress = readNpmLine(s.progress ?? startProgress(), e.line)
    // Hundreds of "fetched a package" lines would push the lines that explain a failure out of the log.
    if (isProgressLine(e.line)) return { ...s, progress }
    return { ...s, progress, log: [...s.log.slice(-499), e.line] }
  }
  return { ...s, outcome: e, ended: now }
}
