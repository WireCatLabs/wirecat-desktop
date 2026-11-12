import type { Enrichment, EnrichmentOffer, EnrichmentStatus, EnrichmentTarget } from "./bindings"
import { delay } from "./mock-delay"
import { memoDefault } from "./mock-memo"
import { MODEL_PRICES } from "./mock-model-prices"
import { providerKeys } from "./mock-provider-keys"
import type { EnrichmentChoice, Platform } from "./types"

// memo's search rewriting, in the shape memo 0.131.61 prints: off at first, with the default offer priced.
// `?enrich=on` on since this morning with 284 records waiting, `?enrich=consent` off with the consent step open,
// `?enrich=nokey` on with no OpenAI key found, `?enrich=fail` makes turning it on fail with memo's words,
// `?enrich=old` a memo without `models consents`, `?enrich=local` on with a model at an address on this computer,
// `?enrich=address` the consent step open on a plain-http address on another computer, which memo refuses. A memo sync after `?enrich=on` reports what it rewrote
// (`src/platform/mock-sync.ts`). Keys: `?enrich-key=old` a memo without `models keys` (the window names the variable),
// `?enrich-key=env` the key comes from an environment variable (nothing to remove), `?enrich-key-fail=1` saving fails.
// The mock never keeps what is typed into the key field.
const RECORDS = 10_444
const HOSTS: Record<string, string> = { openai: "api.openai.com", anthropic: "api.anthropic.com" }
const ENV: Record<string, string> = { openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }

const offer = (provider: string, model: string, isDefault: boolean): EnrichmentOffer => ({
  provider,
  model,
  default: isDefault,
  usdPerMillionInput: MODEL_PRICES[`${provider}/${model}`]?.input ?? null,
  usdPerMillionOutput: MODEL_PRICES[`${provider}/${model}`]?.output ?? null,
})
const offered: EnrichmentOffer[] = [offer("openai", "gpt-4o-mini", true), offer("anthropic", "claude-haiku-5-5", false)]
const OFFER: EnrichmentChoice = { provider: "openai", model: "gpt-4o-mini", baseUrl: null }
const LOCAL: EnrichmentChoice = { provider: "openai", model: "llama3.1:8b", baseUrl: "http://localhost:11434/v1" }
const onThisComputer = (url: string) => /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?(\/|$)/.test(url)
/** memo's `refuseModelAddress`: https anywhere, plain http only to this computer. */
const refused = (c: EnrichmentChoice) => c.baseUrl !== null && /^http:/.test(c.baseUrl) && !onThisComputer(c.baseUrl)

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
  const scenario = params.get("enrich") ?? memoDefault({ old: "old" })
  const keyScenario = params.get("enrich-key")
  providerKeys.found = scenario !== "nokey"
  const keySource = keyScenario === "env" ? "env" : "keyring"
  const target = ({ provider, model, baseUrl }: EnrichmentChoice): EnrichmentTarget => {
    const local = baseUrl !== null && onThisComputer(baseUrl)
    return {
      provider,
      model,
      endpointHost: baseUrl ? new URL(baseUrl).host : (HOSTS[provider] ?? provider),
      baseUrl,
      key:
        providerKeys.found && !local
          ? { present: true, source: keySource, envVar: ENV[provider] ?? null }
          : { present: false, source: null, envVar: ENV[provider] ?? null },
      priceKnown: baseUrl === null,
    }
  }
  const status = (on: boolean, choice: EnrichmentChoice, enriched: number): EnrichmentStatus => {
    const pending = RECORDS - enriched
    const price = choice.baseUrl ? undefined : MODEL_PRICES[`${choice.provider}/${choice.model}`]
    const input = Math.round(66 * pending)
    const output = 70 * pending
    return {
      on,
      consentedAt: on ? new Date(new Date().setHours(9, 12, 0, 0)).toISOString() : null,
      target: target(choice),
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
      addresses: true,
      deleted: null,
    }
  }
  let chosen = scenario === "local" ? LOCAL : OFFER
  let current =
    scenario === "on" || scenario === "nokey" || scenario === "local"
      ? status(true, chosen, 10_160)
      : status(false, chosen, 0)
  return {
    async enrichmentStatus() {
      await delay(350)
      if (scenario === "old") return { state: "old", version: "0.131.50" } satisfies Enrichment
      return { state: "ready", status: current }
    },
    async enrichmentPreview(_id, choice) {
      await delay(600)
      if (refused(choice)) throw new Error("model.address-refused")
      return status(false, choice, 0)
    },
    async enrichmentOn(_id, choice) {
      await delay(900)
      if (scenario === "fail") throw new Error("could not write ~/.config/WireCat/config.json: permission denied")
      if (refused(choice)) throw new Error("model.address-refused")
      chosen = choice
      current = status(true, chosen, 0)
      return current
    },
    async enrichmentKeySet() {
      await delay(700)
      if (params.get("enrich-key-fail")) throw new Error("could not reach the system keyring or write the key file")
      providerKeys.found = true
      current = { ...current, target: current.target && target(chosen) }
      return current
    },
    async enrichmentKeyRemove() {
      await delay(600)
      providerKeys.found = false
      current = { ...current, target: current.target && target(chosen) }
      return current
    },
    async enrichmentOff() {
      await delay(900)
      const deleted = current.enriched
      chosen = OFFER
      current = { ...status(false, chosen, 0), deleted }
      return current
    },
  }
}
