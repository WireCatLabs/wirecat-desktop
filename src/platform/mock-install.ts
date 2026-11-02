import { delay } from "./mock-delay"

// Names from a real `npm install -g @wirecat/tg-cli`; the mock shortens its 324 lookups and 244 packages.
const NAMES = [
  "@wirecat/cli-core",
  "@wirecat/cli-base",
  "@mtcute/node",
  "undici",
  "valibot",
  "commander",
  "better-sqlite3",
  "sherpa-onnx",
  "echarts",
  "zrender",
  "linkedom",
  "mammoth",
  "defuddle",
  "unpdf",
  "yaml",
  "liquidjs",
  "fflate",
  "iconv-lite",
  "postal-mime",
  "string-width",
]

const LOOKUPS = 40
const PACKAGES = 60
const BATCH = 5
const name = (i: number) => `${NAMES[i % NAMES.length]}${i < NAMES.length ? "" : `-${i}`}`
const tarball = (i: number) => {
  const n = name(i)
  return `https://registry.npmjs.org/${n}/-/${n.split("/").at(-1)}-1.0.${i}.tgz`
}

/**
 * npm's `--loglevel http` output in the shape `install-progress.ts` reads: lookups, the burst of `cache` lines that
 * gives the total, then one download at a time. `quiet` prints only the last line, as pnpm and bun do. Resolves
 * false when `stop` says to stop; `hold` never resolves once part of the download has landed.
 */
export async function npmLines(
  pkg: string,
  send: (line: string) => void,
  opts: { stop: () => boolean; hold: boolean; quiet: boolean },
): Promise<boolean> {
  const batches: string[][] = []
  if (!opts.quiet) {
    const lookups = Array.from(
      { length: LOOKUPS },
      (_, i) => `npm http fetch GET 200 https://registry.npmjs.org/${i ? name(i) : pkg} ${40 + ((i * 37) % 300)}ms`,
    )
    for (let i = 0; i < lookups.length; i += BATCH) batches.push(lookups.slice(i, i + BATCH))
    batches.push(Array.from({ length: PACKAGES }, (_, i) => `npm http cache ${name(i)}@${tarball(i)} 0ms (cache hit)`))
    const fetches = Array.from(
      { length: PACKAGES },
      (_, i) => `npm http fetch GET 200 ${tarball(i)} ${120 + ((i * 53) % 900)}ms (cache miss)`,
    )
    for (let i = 0; i < fetches.length; i += BATCH) batches.push(fetches.slice(i, i + BATCH))
  }
  const holdAt = Math.floor(batches.length * 0.75)
  for (const [i, batch] of batches.entries()) {
    await delay(150)
    if (opts.stop()) return false
    for (const line of batch) send(line)
    if (opts.hold && i === holdAt) await new Promise(() => undefined)
  }
  await delay(opts.quiet ? 2500 : 600)
  if (opts.hold && opts.quiet) await new Promise(() => undefined)
  if (opts.stop()) return false
  send(`added ${PACKAGES} packages in 41s`)
  return true
}
