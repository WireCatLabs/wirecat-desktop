import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { dayOf, memo, writeIfChanged } from "../lib.mjs"

const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

/**
 * `memo digest add` refuses without the claude harness on PATH, and the sandbox hides your agents. A stub that only
 * fails goes on PATH for that one call: the digest is made paused, so nothing ever runs it.
 */
function stubClaude(ctx) {
  const dir = join(ctx.home, ".cache", "sandbox-seed", "stub")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "claude"), '#!/bin/sh\necho "sandbox seed: no agent runs here" >&2\nexit 1\n')
  chmodSync(join(dir, "claude"), 0o700)
  return dir
}

/** A run's time on its day, as the report writes it: "17:00" becomes that day's 17:00. */
const timed = (date, value) => (value && /^\d\d:\d\d$/.test(value) ? `${date}T${value}:00` : value)

/**
 * Past days are the files a digest run leaves, in the `wirecat.report/1` format the Digests page reads: the only way
 * to show them without a paid model run.
 */
export default function digests(ctx) {
  const { digest, days } = ctx.data("digests.json")
  const have = memo(["digest", "list"]).items.some((d) => d.name === digest.name)
  if (!have) {
    const path = stubClaude(ctx)
    memo(["digest", "add", digest.name, "--title", digest.title, "--at", digest.at, "--paused", "--from-app"], { path })
  }
  const runs = join(ctx.home, ".local", "share", "cli-memo", "schedules", digest.name, "runs")
  let written = 0
  for (const day of days) {
    const date = isoDay(dayOf(ctx.anchor, day.days_ago))
    const sections = day.report.sections.map((s) => ({
      ...s,
      items: s.items.map((i) => ({ ...i, due: timed(date, i.due), time: timed(date, i.time) })),
    }))
    const report = { ...day.report, date, sections }
    const stamp = `${date}T07-30-00Z`
    if (writeIfChanged(join(runs, `${stamp}.report.json`), `${JSON.stringify(report, null, 2)}\n`)) written++
    writeIfChanged(join(runs, `${stamp}.md`), day.text)
  }
  return `${have ? "digest kept" : "digest added (paused)"}, ${written} days written`
}
