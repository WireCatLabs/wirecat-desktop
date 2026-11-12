import { findTool } from "@/domain/catalog"
import type { AccountRemoval, Removal, RemovalEntry } from "./bindings"
import { delay } from "./mock-delay"

type Plan = { removed: RemovalEntry[]; kept: RemovalEntry[]; data: RemovalEntry[]; store: string; revokes: boolean }

const entry = (kind: RemovalEntry["kind"], target: string, reason: string | null = null): RemovalEntry => ({
  kind,
  target,
  reason,
  chosen: false,
})

/** What cli-core's `account remove` lists for tg and drive (`docs/dev/ACCOUNT-REMOVAL.md` in cli-core). */
const plans = (id: string, profile: string): Plan => {
  const state = `~/.local/state/${id}-cli`
  if (id === "tg")
    return {
      removed: [
        entry("signIn", "the Telegram session (Telegram ends it on its servers too)"),
        entry("keyring", `app-keys:${profile}`),
        entry("keyring", `session:${profile}`),
        entry("config", `profiles.${profile}`),
        entry("file", `${state}/accounts/${profile}.json`),
        entry("file", `${state}/checkpoints/${profile}`),
        entry("file", `${state}/pace/${profile}.json`),
        entry("unit", `~/.config/systemd/user/tg-serve-${profile}.service`),
        entry("schedule", `tg-${profile}-inbox`),
      ],
      kept: [entry("file", `${state}/sends/${profile}.jsonl`, "the record of what was sent for this account")],
      data: [entry("file", `~/.cache/tg-cli/media/${profile}`)],
      store: "telegram",
      revokes: false,
    }
  if (id === "drive")
    return {
      removed: [
        entry("signIn", "the Google sign-in"),
        entry("keyring", `oauth:google:${profile}`),
        entry("config", `profiles.${profile}`),
        entry("file", `${state}/accounts/${profile}.json`),
        entry("file", `${state}/checkpoints/${profile}`),
      ],
      kept: [],
      data: [entry("file", `~/.cache/drive-cli/exports/${profile}`)],
      store: "google",
      revokes: true,
    }
  return {
    removed: [
      entry("signIn", `the ${id} sign-in`),
      entry("config", `profiles.${profile}`),
      entry("file", `${state}/accounts/${profile}.json`),
    ],
    kept: [],
    data: [],
    store: id,
    revokes: false,
  }
}

const removal = (id: string, profile: string, del: boolean, dryRun: boolean): Removal => {
  const p = plans(id, profile)
  const store = entry("store", p.store)
  return {
    data: del ? "deleted" : "kept",
    dryRun,
    revoked: dryRun || !p.revokes ? null : true,
    configFile: `~/.config/${id}-cli/config.json`,
    removed: del ? [...p.removed, ...p.data, store] : p.removed,
    kept: del ? p.kept : [...p.kept, ...p.data.map((e) => ({ ...e, chosen: true })), { ...store, chosen: true }],
  }
}

/**
 * `?remove-old=<tool>`: that tool's installed version has no `account remove`, so the dialog signs out only.
 * `?remove-fail=<tool>`: its background service holds the account, so the tool refuses.
 */
export function accountRemoveMock(params: URLSearchParams, forget: (id: string, profile: string) => void) {
  const refusal = (id: string, profile: string): AccountRemoval | null =>
    params.get("remove-fail") === id
      ? {
          result: "refused",
          reason: "busy",
          holder: null,
          message: `\`${id} serve\` is running for ${profile} — stop it first (\`${id} ${profile} server stop\`), then remove the account`,
        }
      : null
  return {
    async accountRemoveSupported(id: string) {
      await delay(250)
      // As Rust: a catalog with no released version yet (tg) has no `account remove`.
      return params.get("remove-old") !== id && Boolean(findTool(id)?.accountRemove?.remove?.minVersion)
    },
    async accountRemovePlan(id: string, profile: string, deleteData: boolean): Promise<AccountRemoval> {
      await delay(700)
      if (params.get("remove-old") === id) return { result: "tooOld" }
      return refusal(id, profile) ?? { result: "answered", removal: removal(id, profile, deleteData, true) }
    },
    async accountRemove(id: string, profile: string, deleteData: boolean): Promise<AccountRemoval> {
      await delay(1400)
      if (params.get("remove-old") === id) return { result: "tooOld" }
      const refused = refusal(id, profile)
      if (refused) return refused
      forget(id, profile)
      return { result: "answered", removal: removal(id, profile, deleteData, false) }
    },
  }
}
