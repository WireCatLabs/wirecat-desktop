import * as v from "valibot"

/** cli-core's `storeDamageReport`, as `<tool> store recover --json` prints it; `runnable` is the app's own mark. */
export const DamageReportSchema = v.object({
  what_happened: v.string(),
  likely_causes: v.array(v.object({ cause: v.string(), check: v.optional(v.string()) })),
  impact: v.array(v.string()),
  external_data_safe: v.string(),
  last_ok_at: v.optional(v.nullable(v.string()), null),
  loss: v.optional(v.string()),
  steps: v.array(v.object({ command: v.string(), why: v.string(), destructive: v.boolean(), runnable: v.boolean() })),
})
export type DamageReport = v.InferOutput<typeof DamageReportSchema>

/** Doctor names a damaged store under `store.damage` (cli-core marks the store when a run finds it damaged). */
export function storeDamaged(report: unknown): boolean {
  const store = (report as { item?: { store?: { damage?: unknown } } } | null)?.item?.store
  return Boolean(store?.damage && typeof store.damage === "object")
}
