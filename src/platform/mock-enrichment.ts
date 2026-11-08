import type { Enrichment, EnrichmentStatus } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// memo's search rewriting: off at first. `?enrich=on` on since this morning with 284 records waiting,
// `?enrich=consent` off with the consent step open, `?enrich=fail` makes turning it on fail with memo's words,
// `?enrich=old` a memo without `models consents`.
export function enrichmentMock(
  params: URLSearchParams,
): Pick<Platform, "enrichmentStatus" | "enrichmentPreview" | "enrichmentOn" | "enrichmentOff"> {
  const scenario = params.get("enrich")
  const off = (records: number, deleted: number | null = null): EnrichmentStatus => ({
    on: false,
    provider: null,
    model: null,
    endpoint: null,
    consentedAt: null,
    records,
    enriched: 0,
    pending: records,
    estimate: { records, inputTokens: 689_496, outputTokens: 731_080, usd: null },
    deleted,
  })
  const on = (enriched: number): EnrichmentStatus => {
    const pending = 10_444 - enriched
    const share = pending / 10_444
    return {
      on: true,
      provider: "openai",
      model: "gpt-4o-mini",
      endpoint: "https://api.openai.com/v1",
      consentedAt: new Date(new Date().setHours(9, 12, 0, 0)).toISOString(),
      records: 10_444,
      enriched,
      pending,
      estimate: {
        records: pending,
        inputTokens: Math.round(689_496 * share),
        outputTokens: Math.round(731_080 * share),
        usd: Math.round(0.5186 * share * 10_000) / 10_000,
      },
      deleted: null,
    }
  }
  let status = scenario === "on" ? on(10_160) : off(10_444)
  return {
    async enrichmentStatus() {
      await delay(350)
      if (scenario === "old") return { state: "old", version: "0.131.50" } satisfies Enrichment
      return { state: "ready", status }
    },
    async enrichmentPreview() {
      await delay(600)
      return { ...status, estimate: { ...status.estimate, usd: 0.5186 } }
    },
    async enrichmentOn() {
      await delay(900)
      if (scenario === "fail") throw new Error("only the owner turns enrichment on, not an agent")
      status = on(0)
      return status
    },
    async enrichmentOff() {
      await delay(900)
      const deleted = status.enriched
      status = off(10_444, deleted)
      return status
    },
  }
}
