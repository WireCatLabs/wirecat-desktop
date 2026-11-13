import type { Identity } from "@/platform/people-schemas"

export { SourceIcon, sourceOf } from "@/shared/SourceIcon"

/** One account in words: its name or handle, never memo's id, which for a CRM is a whole URL. */
export const accountName = (i: Pick<Identity, "name" | "username">) =>
  i.username ? `@${i.username.replace(/^@/, "")}` : (i.name?.trim() ?? null)
