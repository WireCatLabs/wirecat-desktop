/**
 * USD per million tokens, as cli-core's price table has them (src/services/enrichment-setting.ts, from the providers'
 * pricing pages on 2026-11-08). Enrichment and search harder price the same models, so both mocks read this one.
 */
export const MODEL_PRICES: Readonly<Record<string, { input: number; output: number }>> = {
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "anthropic/claude-haiku-5-5": { input: 0.1, output: 0.5 },
}
