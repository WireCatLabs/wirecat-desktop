import type { OwnRefusal } from "@/platform/bindings"
import type { OwnText } from "./messages-own"

/** What went wrong and what to do, for each kind Rust refuses with (`own_tools.rs`). */
export function refusalWords(r: OwnRefusal, m: OwnText["refusal"]): [string, string] {
  switch (r.kind) {
    case "bad_manifest":
      return m.bad_manifest(r.key, r.rule)
    case "collision":
      return r.listed ? m.listed(r.with) : m.collision(r.with)
    case "provenance_mismatch":
      return m.provenance_mismatch(r.claimed, r.built)
    case "too_large":
      return m.too_large(r.what)
    default:
      return m[r.kind]
  }
}
