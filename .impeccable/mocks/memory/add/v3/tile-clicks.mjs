// Clicks the File, Link and Text tiles of the "Add to memory" prototype fast, with the mouse and then the keyboard,
// and checks after every click that the right side shows the chosen input. Motion is on, as in the app.
//   node .impeccable/mocks/memory/add/v3/tile-clicks.mjs [--port 1436] [--rounds 20] [--gap 40]
import { existsSync } from "node:fs"
import { chromium } from "playwright-core"

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
const port = Number(flag("port", 1436))
const rounds = Number(flag("rounds", 20))
const gap = Number(flag("gap", 40))
const executablePath = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium"].find(
  (p) => p && existsSync(p),
)
const browser = await chromium.launch({ executablePath, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 840 }, reducedMotion: "no-preference" })
await page.goto(`http://localhost:${port}/?onboarding=off&add=source`)
await page.waitForSelector("#add-panel fieldset")

const shows = {
  file: () => document.querySelector("#add-panel")?.textContent?.includes("Drop a file here"),
  link: () => Boolean(document.querySelector("#add-panel input[type=url]")),
  text: () => Boolean(document.querySelector("#add-panel textarea")),
}
const tile = (way) => page.locator(`#add-panel fieldset input[type=radio][value=${way}]`).locator("xpath=..")
const ways = ["text", "link", "file"]
const failures = []
const slow = []

async function check(way, i, how) {
  const start = Date.now()
  try {
    await page.waitForFunction(shows[way], null, { timeout: 500, polling: "raf" })
  } catch {
    failures.push(`${how} #${i}: ${way} never showed`)
    return
  }
  const checked = await page.evaluate((w) => document.querySelector(`#add-panel input[value=${w}]`)?.checked, way)
  if (!checked) failures.push(`${how} #${i}: ${way} shown but its tile is not selected`)
  const ms = Date.now() - start
  if (ms > 100) slow.push(`${how} #${i}: ${way} took ${ms} ms`)
}

for (let i = 0; i < rounds; i++) {
  const way = ways[i % 3]
  const box = await tile(way).boundingBox()
  if (!box) {
    failures.push(`mouse #${i}: no ${way} tile`)
    continue
  }
  // Somewhere in the tile, not only its centre: the owner clicks the icon, the name or the hint.
  const x = box.x + 12 + ((i * 37) % Math.max(1, box.width - 24))
  const y = box.y + 8 + ((i * 13) % Math.max(1, box.height - 16))
  await page.mouse.click(x, y)
  await check(way, i, "mouse")
  await page.waitForTimeout(gap)
}

await tile(ways[0]).click()
await page.locator(`#add-panel input[value=${ways[0]}]`).focus()
for (let i = 0; i < rounds; i++) {
  await page.keyboard.press("ArrowDown")
  await check(ways[(i + 1) % 3], i, "key")
  await page.waitForTimeout(gap)
}

await browser.close()
for (const s of slow) console.log(`slow: ${s}`)
for (const f of failures) console.log(`FAIL: ${f}`)
console.log(`${failures.length ? "FAILED" : "passed"}: ${rounds} mouse clicks and ${rounds} arrow keys, ${failures.length} failures, ${slow.length} slow`)
process.exit(failures.length ? 1 : 0)
