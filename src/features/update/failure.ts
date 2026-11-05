import * as v from "valibot"
import { type UpdateFailure, UpdateFailureSchema } from "@/platform/update-schemas"

const SERVER = /status:? (403|429|5\d\d)\b|valid release JSON/i
const OFFLINE =
  /error sending request|connection (refused|reset|closed)|timed? ?out|dns error|failed to lookup|network is unreachable|no route to host/i

/** A package download fails with a reason from Rust; the self-update plugin only gives text, so the same reasons are
 * read from that text. */
export function failureOf(e: unknown): UpdateFailure {
  const parsed = v.safeParse(UpdateFailureSchema, e)
  if (parsed.success) return parsed.output
  const detail = e instanceof Error ? e.message : String(e)
  if (SERVER.test(detail)) return { reason: "server", detail }
  if (OFFLINE.test(detail)) return { reason: "offline", detail }
  return { reason: "other", detail }
}
