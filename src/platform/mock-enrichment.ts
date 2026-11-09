import type { Enrichment, EnrichmentOffer, EnrichmentStatus, EnrichmentTarget } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// memo's search rewriting, in the shape memo 0.131.61 prints: off at first, with the default offer priced.
// `?enrich=on` on since this morning with 284 records waiting, `?enrich=consent` off with the consent step open,
// `?enrich=nokey` on with no OpenAI key found, `?enrich=fail` makes turning it on fail with memo's words,
// `?enrich=old` a memo without `models consents`. A memo sync after `?enrich=on` reports what it rewrote
// (`src/platform/mock-sync.ts`). Keys: `?enrich-key=old` a memo without `models keys` (the window names the variable),
// `?enrich-key=env` the key comes from an environment variable (nothing to remove), `?enrich-key-fail=1` saving fails.
// The mock never keeps what is typed into the key field.
const RECORDS = 10_444
const PRICES: Record<string, { input: number; output: number }> = {
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "anthropic/claude-haiku-5-5": { input: 0.1, output: 0.5 },
}
const HOSTS: Record<string, string> = { openai: "api.openai.com", anthropic: "api.anthropic.com" }
const ENV: Record<string, string> = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }

const offered: EnrichmentOffer[] = [
  { provider: "openai", model: "gpt-4o-mini", default: true, usdPerMillionInput: 0.15, usdPerMillionOutput: 0.6 },
  {
    provider: "anthropic",
    model: "claude-haiku-5-5",
    default: false,
    usdPerMillionInput: 0.1,
    usdPerMillionOutput: 0.5,
  },
]

export function enrichmentMock(
  params: URLSearchParams,
): Pick<
  Platform,
  | "enrichmentStatus"
  | "enrichmentPreview"
  | "enrichmentOn"
  | "enrichmentOff"
  | "enrichmentKeySet"
  | "enrichmentKeyRemove"
> {
  const scenario = params.get("enrich")
  const keyScenario = params.get("enrich-key")
  let keyFound = scenario !== "nokey"
  const keySource = keyScenario === "env" ? "env" : "keyring"
  const target = (provider: string, model: string): EnrichmentTarget => ({
    provider,
    model,
    endpointHost: HOSTS[provider] ?? provider,
    key: keyFound
      ? { present: true, source: keySource, envVar: ENV[provider] ?? null }
      : { present: false, source: null, envVar: ENV[provider] ?? null },
    priceKnown: true,
  })
  const status = (on: boolean, provider: string, model: string, enriched: number): EnrichmentStatus => {
    const pending = RECORDS - enriched
    const price = PRICES[`${provider}/${model}`]
    const input = Math.round(66 * pending)
    const output = 70 * pending
    return {
      on,
      consentedAt: on ? new Date(new Date().setHours(9, 12, 0, 0)).toISOString() : null,
      target: target(provider, model),
      records: RECORDS,
      enriched,
      pending,
      estimate: {
        records: pending,
        inputTokens: input,
        outputTokens: output,
        usd: price ? Math.round(input * price.input + output * price.output) / 1_000_000 : null,
      },
      perSync: 600,
      syncsNeeded: Math.ceil(pending / 600),
      offered,
      measured: { rewordedOff: 0.62, rewordedOn: 0.79, ownWordsFirstOff: 0.54, ownWordsFirstOn: 0.48 },
      keys: keyScenario !== "old",
      deleted: null,
    }
  }
  let current =
    scenario === "on" || scenario === "nokey"
      ? status(true, "openai", "gpt-4o-mini", 10_160)
      : status(false, "openai", "gpt-4o-mini", 0)
  return {
    async enrichmentStatus() {
      await delay(350)
      if (scenario === "old") return { state: "old", version: "0.131.50" } satisfies Enrichment
      return { state: "ready", status: current }
    },
    async enrichmentPreview(_id, provider, model) {
      await delay(600)
      return status(false, provider, model, 0)
    },
    async enrichmentOn(_id, provider, model) {
      await delay(900)
      if (scenario === "fail") throw new Error("could not write ~/.config/WireCat/config.json: permission denied")
      current = status(true, provider, model, 0)
      return current
    },
    async enrichmentKeySet() {
      await delay(700)
      if (params.get("enrich-key-fail")) throw new Error("could not reach the system keyring or write the key file")
      keyFound = true
      current = { ...current, target: current.target && target(current.target.provider, current.target.model) }
      return current
    },
    async enrichmentKeyRemove() {
      await delay(600)
      keyFound = false
      current = { ...current, target: current.target && target(current.target.provider, current.target.model) }
      return current
    },
    async enrichmentOff() {
      await delay(900)
      const deleted = current.enriched
      current = { ...status(false, "openai", "gpt-4o-mini", 0), deleted }
      return current
    },
  }
}
