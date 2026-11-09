import type { HarderStatus, SearchHarder } from "./bindings"
import { delay } from "./mock-delay"
import { providerKeys } from "./mock-provider-keys"
import { searchMock } from "./mock-search"
import type { HarderChoice, Platform } from "./types"

// memo's search harder, in the shape cli-core #2792 prints: off at first, Anthropic proposed. `?harder=on` allowed this
// morning, `?harder=consent` off with the consent step open, `?harder=nokey` on with no key found, `?harder=router` on
// with an OpenRouter address and a model memo has no price for, `?harder=old` no memo with it released yet,
// `?harder=fail` turning it on fails because WireCat was started from an AI agent's terminal. A search harder puts the
// plain search's hits in another order; `?harder-run=kept` keeps memo's order because the model did not answer in time.
const DEFAULTS: Record<string, string> = { anthropic: "claude-haiku-5-5", openai: "gpt-4o-mini" }
const ENDPOINTS: Record<string, string> = { anthropic: "api.anthropic.com", openai: "api.openai.com" }
const ENV: Record<string, string> = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" }
const PRICES: Record<string, [number, number]> = {
  "anthropic/claude-haiku-5-5": [1, 5],
  "openai/gpt-4o-mini": [0.15, 0.6],
}

function status(on: boolean, choice: HarderChoice): HarderStatus {
  const model = choice.model?.trim() || DEFAULTS[choice.provider] || "claude-haiku-5-5"
  const price = choice.baseUrl ? undefined : PRICES[`${choice.provider}/${model}`]
  return {
    on,
    provider: choice.provider,
    model,
    endpointHost: choice.baseUrl ? new URL(choice.baseUrl).host : (ENDPOINTS[choice.provider] ?? choice.provider),
    baseUrl: choice.baseUrl,
    proposedFromEnrichment: false,
    consentedAt: on ? new Date(new Date().setHours(9, 12, 0, 0)).toISOString() : null,
    candidates: 30,
    charsPerHit: 400,
    usdPerMillionInput: price?.[0] ?? null,
    usdPerMillionOutput: price?.[1] ?? null,
    key: {
      present: providerKeys.found,
      source: providerKeys.found ? "keyring" : null,
      envVar: ENV[choice.provider] ?? null,
    },
  }
}

const ANTHROPIC: HarderChoice = { provider: "anthropic", model: null, baseUrl: null }
const ROUTER: HarderChoice = {
  provider: "openai",
  model: "deepseek/deepseek-chat",
  baseUrl: "https://openrouter.ai/api/v1",
}

export function searchHarderMock(
  params: URLSearchParams,
): Pick<
  Platform,
  "searchHarderStatus" | "searchHarderPreview" | "searchHarderOn" | "searchHarderOff" | "searchHarderRun"
> {
  const scenario = params.get("harder")
  if (scenario === "nokey") providerKeys.found = false
  let chosen = scenario === "router" ? ROUTER : ANTHROPIC
  let on = scenario === "on" || scenario === "nokey" || scenario === "router"
  return {
    async searchHarderStatus() {
      await delay(300)
      if (scenario === "old") return { state: "old", version: "0.131.73", need: null } satisfies SearchHarder
      return { state: "ready", status: status(on, chosen) }
    },
    async searchHarderPreview(_id, choice) {
      await delay(450)
      return status(false, choice)
    },
    async searchHarderOn(_id, choice) {
      await delay(700)
      if (scenario === "fail")
        throw new Error(
          "memo lets only you allow this, and WireCat was started from an AI agent's terminal. Open WireCat from the app menu and turn it on there.",
        )
      chosen = choice
      on = true
      return status(true, chosen)
    },
    async searchHarderOff() {
      await delay(500)
      on = false
      return status(false, chosen)
    },
    async searchHarderRun(id, query, limit) {
      const answer = await searchMock.searchStore(id, null, query, limit, 1)
      await delay(1200)
      if (answer.kind !== "hits") return { answer, outcome: null }
      const hits = answer.hits.slice(0, limit)
      if (!providerKeys.found)
        return {
          answer: { ...answer, hits, paged: false },
          outcome: { applied: false, why: "no key for the provider" },
        }
      if (params.get("harder-run") === "kept")
        return {
          answer: { ...answer, hits, paged: false },
          outcome: { applied: false, why: "the model did not answer within 5 s" },
        }
      const moved = [...hits.slice(0, 30).reverse(), ...hits.slice(30)]
      return { answer: { ...answer, hits: moved, hasMore: false, paged: false }, outcome: { applied: true, why: null } }
    },
  }
}
