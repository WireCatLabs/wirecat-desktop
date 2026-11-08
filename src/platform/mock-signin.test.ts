import { describe, expect, it } from "vitest"
import { isMockLogin, signInMock } from "./mock-signin"
import type { SignInEvent } from "./signin-schemas"

async function firstStep<K extends SignInEvent["event"]>(tool: string, event: K) {
  const mock = signInMock()
  const seen: SignInEvent[] = []
  const run = mock.signIn(tool, "qr", "personal", (e) => seen.push(e))
  await expect.poll(() => seen.find((e) => e.event === event), { timeout: 3000 }).toBeDefined()
  await mock.signInStop(tool)
  await run
  return seen.find((e): e is Extract<SignInEvent, { event: K }> => e.event === event)
}

describe("the browser build's sign-in", () => {
  it("labels every WhatsApp code as a sample", async () => {
    const qr = await firstStep("wa", "qr")
    expect(qr?.scan).toMatch(/^Sample code, not scannable\. Scan in WhatsApp/)
  })

  it("shows Zoom's page with a redirect address, and never opens a mock login", async () => {
    const step = await firstStep("zm", "openUrl")
    const url = new URL(step?.url ?? "")
    expect(url.searchParams.get("redirect_uri")).toBe("https://wirecat.dev/zoom-callback")
    expect(isMockLogin(url.toString())).toBe(true)
    expect(isMockLogin("https://wirecat.dev/en/docs/wa")).toBe(false)
  })
})
