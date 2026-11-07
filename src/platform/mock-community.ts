import type { InstallEvent, OwnDiscovery, OwnRefusal, OwnReview, OwnStatus, OwnUpdate } from "./bindings"
import type { CommunityStatus, ExtraTools } from "./community-schemas"
import { delay } from "./mock-delay"

/** A community tool as the signed list would hold it; `?community=1` lists it, `?community=bad` adds a second entry
 * Rust would have refused, `?community-key=none` is a build without the list's key. */
export const ACME = {
  id: "acme",
  community: true,
  name: "Acme Notes",
  tagline: "Acme notes, searchable with your WireCat data",
  bin: "acme",
  package: "@example/acme-cli",
  summary: "Your Acme notes kept as local text, so search and agents can read them offline.",
  docs: "https://example.com/acme-cli",
  repo: "https://github.com/example/acme-cli",
  profiles: { args: ["profile", "list", "--json", "--no-record"], shape: "items" },
  doctor: ["{profile}", "doctor", "--json", "--record"],
  runs: null,
  search: null,
  setup: ["{profile}", "setup"],
  signIn: { gives: "your Acme notes", asks: "an Acme API token" },
  skill: null,
  mcpServer: null,
  tasks: null,
  sync: null,
  storeInfo: null,
  storeTables: null,
  storeTableSizes: null,
  storeCheck: null,
  storeBackup: null,
  storeBackupEncrypted: null,
  storeResetPreview: null,
  storeReset: null,
  storage: { app: "acme-cli", env: "ACME" },
  settings: null,
}

/** An own tool as Desktop saves it after a review: `?own=1` lists it with the Not checked badge. */
export const OWN = {
  ...ACME,
  id: "acmecrm",
  name: "Acme CRM",
  tagline: "Acme CRM contacts and deals",
  bin: "wcat-acme-crm",
  package: "@example/acme-crm-cli",
  summary: "Contacts and deals from Acme CRM, kept locally for search and agents.",
  docs: "https://example.com/acme-crm",
  repo: "https://github.com/example/acme-crm-cli",
  signIn: { gives: "your contacts and deals", asks: "an Acme API token" },
  storage: { app: "example-acme-crm-cli", env: "ACME_CRM" },
}

export function extraToolsMock(params: URLSearchParams): ExtraTools {
  const community = params.get("community")
  const listed = community === "1" || community === "bad" ? [ACME] : []
  if (community === "bad") listed.push({ ...ACME, id: "evil", package: "@wirecat/evil" })
  const own = params.get("own") === "1" ? [OWN] : []
  const rejected: ExtraTools["rejected"] =
    community === "bad" ? [{ source: "community", text: 'shady: the command word "setup;rm" is not allowed.' }] : []
  return {
    tools: [
      ...listed.map((entry) => ({ source: "community" as const, entry })),
      ...own.map((entry) => ({ source: "own" as const, entry })),
    ],
    rejected,
  }
}

/** The Settings switch; `?community=1` or `bad` starts it on, as the list could only have been read then. */
export function communityMock(params: URLSearchParams) {
  let show = params.has("community")
  const available = params.get("community-key") !== "none"
  return {
    async communityStatus(): Promise<CommunityStatus> {
      return { show, available, listed: extraToolsMock(params).tools.filter((t) => t.source === "community").length }
    },
    async setCommunityShown(next: boolean) {
      show = next
    },
  }
}

export function ownReview(overrides: Partial<OwnReview> = {}): OwnReview {
  return {
    token: "review-1",
    id: OWN.id,
    name: OWN.name,
    package: OWN.package,
    version: "0.3.0",
    summary: OWN.summary,
    publishers: ["example"],
    repo: OWN.repo,
    built: { repo: OWN.repo, workflow: ".github/workflows/release.yml@refs/heads/main" },
    access: { reads: ["contacts list", "deals list"], changes: ["deals update"], writes: ["sync"], unknown: false },
    signIn: OWN.signIn,
    syncs: true,
    skill: true,
    mcp: false,
    described: true,
    update: null,
    entry: OWN,
    ...overrides,
  }
}

/** An update of Acme CRM that asks for nothing new since 0.2.0. */
export const UNCHANGED: OwnUpdate = {
  fromVersion: "0.2.0",
  repoChanged: false,
  fromRepo: OWN.repo,
  provenanceChanged: false,
  fromBuilt: { repo: OWN.repo, workflow: ".github/workflows/release.yml@refs/heads/main" },
  publishersChanged: false,
  fromPublishers: ["example"],
  newCommands: [],
  newWrites: [],
  newParts: [],
  changedParts: [],
  confirm: false,
}

const REFUSALS: Record<string, OwnRefusal> = {
  not_found: { kind: "not_found" },
  not_scoped: { kind: "not_scoped" },
  wirecat_scope: { kind: "wirecat_scope" },
  no_manifest: { kind: "no_manifest" },
  bad_manifest: { kind: "bad_manifest", key: "setup", rule: 'the command word "setup;rm" is not allowed.' },
  collision: { kind: "collision", with: "Telegram", listed: false },
  listed: { kind: "collision", with: "Acme Listed", listed: true },
  provenance_mismatch: {
    kind: "provenance_mismatch",
    claimed: "https://github.com/example/acme-crm-cli",
    built: "https://github.com/someone-else/fork",
  },
  offline: { kind: "offline", detail: "getaddrinfo ENOTFOUND registry.npmjs.org" },
  too_large: { kind: "too_large", what: "package" },
}

/**
 * "Allow tools WireCat has not checked" and the Add your own tool dialog. `?own=on` starts the switch on, `?own=1`
 * also lists Acme CRM as an own tool; `?own-discover=<kind>` makes discovery refuse with that kind (`listed` is a
 * collision with a listed tool), `noprov` finds no provenance and no repository, `update` reviews an update with a new
 * repository and new write access; a pasted `desktop` object passes a `no_manifest`. `?own-add=describe` refuses after
 * the install (the tool names another manifest).
 */
export function ownToolsMock(params: URLSearchParams) {
  let allowed = params.get("own") === "on" || params.get("own") === "1"
  const discovered = params.get("own-discover")
  return {
    async ownToolsStatus(): Promise<OwnStatus> {
      return { allowed, flag: false, added: params.get("own") === "1" ? 1 : 0 }
    },
    async setOwnToolsAllowed(next: boolean) {
      allowed = next
    },
    async ownToolDiscover(pkg: string, desktop: string | null): Promise<OwnDiscovery> {
      await delay(900)
      if (!/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(pkg)) {
        return { outcome: "refused", refusal: { kind: pkg.startsWith("@wirecat/") ? "wirecat_scope" : "not_scoped" } }
      }
      if (pkg.startsWith("@wirecat/")) return { outcome: "refused", refusal: { kind: "wirecat_scope" } }
      if (discovered === "no_manifest" && desktop) {
        const access = { reads: [], changes: [], writes: [], unknown: true }
        return { outcome: "review", review: ownReview({ package: pkg, described: false, access }) }
      }
      const refusal = discovered ? REFUSALS[discovered] : undefined
      if (refusal) return { outcome: "refused", refusal }
      if (discovered === "noprov")
        return { outcome: "review", review: ownReview({ package: pkg, repo: null, built: null }) }
      if (discovered === "update") {
        const update = {
          ...UNCHANGED,
          repoChanged: true,
          fromRepo: "https://github.com/example/old-crm",
          publishersChanged: true,
          fromPublishers: ["old-maintainer"],
          newWrites: ["deals update"],
          newParts: ["mcpServer"],
          confirm: true,
        }
        return { outcome: "review", review: ownReview({ package: pkg, update }) }
      }
      return { outcome: "review", review: ownReview({ package: pkg }) }
    },
    async ownToolAdd(_token: string, onEvent: (e: InstallEvent) => void) {
      onEvent({ event: "step", step: "check" })
      onEvent({
        event: "log",
        line: "Built by https://github.com/example/acme-crm-cli on GitHub Actions.",
        stderr: false,
      })
      await delay(600)
      onEvent({ event: "step", step: "install" })
      onEvent({ event: "log", line: "$ npm install --global @example/acme-crm-cli@0.3.0", stderr: false })
      await delay(1200)
      onEvent({ event: "step", step: "verify" })
      onEvent({ event: "check", what: "start" })
      await delay(500)
      if (params.get("own-add") === "describe") {
        return onEvent({
          event: "failed",
          reason: "verify",
          message:
            "The installed tool describes itself differently from the package WireCat showed you, so it was not added.",
          hint: null,
        })
      }
      onEvent({
        event: "done",
        version: "0.3.0",
        path: "~/.npm-global/bin/wcat-acme-crm",
        shadowedBy: null,
        skills: { refreshed: [], failed: null },
        pathFix: null,
      })
    },
    async ownToolUninstall(_token: string, onEvent: (e: InstallEvent) => void) {
      onEvent({ event: "step", step: "remove" })
      await delay(700)
      onEvent({ event: "removed" })
    },
    async ownToolRemove(_id: string) {
      await delay(300)
    },
  }
}
