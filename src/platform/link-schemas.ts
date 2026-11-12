import * as v from "valibot"
import type { DeepLinkTarget } from "@/domain/links"

const part = v.pipe(v.string(), v.minLength(1), v.maxLength(512))

// `deep_link.rs` sends what it parsed; the shape is checked again here, as every event from Rust is.
const DeepLinkTargetSchema = v.union([
  v.object({ type: v.literal("message"), provider: part, account: part, chat: part, message: part }),
  v.object({ type: v.literal("chat"), provider: part, account: part, chat: part }),
  v.object({ type: v.literal("task"), id: part }),
  v.object({ type: v.literal("tasks"), filter: v.picklist(["overdue", "today", "tomorrow", "undated"]) }),
  v.object({ type: v.literal("tasks"), filter: v.literal("new"), since: part }),
  v.object({ type: v.literal("proposal"), id: part }),
  v.object({ type: v.literal("digest"), date: part }),
  v.object({ type: v.literal("person"), id: part }),
  v.object({ type: v.literal("project"), key: part }),
  v.object({ type: v.literal("sync"), tool: part, account: v.exactOptional(part) }),
]) satisfies v.GenericSchema<unknown, DeepLinkTarget>

export const OpenedSchema = v.object({ target: v.nullable(DeepLinkTargetSchema) })
