import type {
  InstallEvent,
  OwnCommand,
  OwnDiscovery,
  OwnRefusal,
  OwnReview,
  OwnSignal,
  OwnStatus,
  OwnUpdate,
} from "./bindings"
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

/** An own tool as Desktop saves it after a review: `?own=1` lists it with the Not verified badge. */
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

/** A list kept 24 days more; `?registry=expiring` leaves it three days, `expired` ran out two days ago. */
export function registryMock(params: URLSearchParams): Pick<CommunityStatus, "state" | "expiresAt"> {
  const registry = params.get("registry")
  const days = registry === "expiring" ? 3 : registry === "expired" ? -2 : 24
  return {
    state: registry === "expiring" || registry === "expired" ? registry : "fresh",
    expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
  }
}

/** Set once the mock adds or removes Acme CRM, so the catalog reloads with it as the real app's does. */
let ownAdded: boolean | null = null
/** The switch as Settings last set it; the list follows it at once, as the real app's reload does. */
let ownShown: boolean | null = null

export function extraToolsMock(params: URLSearchParams): ExtraTools {
  const community = params.get("community")
  const listed = community === "1" || community === "bad" || params.has("registry") ? [ACME] : []
  if (community === "bad") listed.push({ ...ACME, id: "evil", package: "@wirecat/evil" })
  const own = (ownShown ?? true) && (ownAdded ?? params.get("own") === "1") ? [OWN] : []
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

/** The Settings switch; `?community=1`, `bad` or `?registry=` starts it on, as the list could only have been read then. */
export function communityMock(params: URLSearchParams) {
  let show = params.has("community") || params.has("registry")
  const available = params.get("community-key") !== "none"
  return {
    async communityStatus(): Promise<CommunityStatus> {
      const listed = extraToolsMock(params).tools.filter((t) => t.source === "community").length
      return { show, available, listed, ...registryMock(params) }
    },
    async setCommunityShown(next: boolean) {
      show = next
    },
  }
}

const command = (
  words: string,
  remote: OwnCommand["remote"],
  local: OwnCommand["local"],
  summary: string | null = null,
  entity: string | null = null,
): OwnCommand => ({ words, remote, local, summary, entity })

/** Acme CRM's commands as cli-base#529 writes them, with summaries and entities. */
export const ACME_COMMANDS: OwnCommand[] = [
  command("session start", "read", "write"),
  command("session status", "read", "read"),
  command("sync", "read", "write", "copy contacts, deals and invoices"),
  command("contacts list", "read", "read", "list contacts", "contact"),
  command("contacts show", "read", "read", "show one contact", "contact"),
  command("deals list", "none", "read", "list deals", "deal"),
  command("deals update", "write", "none", "change a deal's stage", "deal"),
  command("invoices list", "none", "read", "list invoices", "invoice"),
  command("doctor", "read", "read"),
  command("skill install", "none", "write"),
  command("mcp server start", "none", "write"),
  command("runs list", "none", "read"),
]

/** What Rust answers today for Acme CRM 0.2.0: npm's facts only, before GitHub's arrive. */
export const ACME_SIGNALS: OwnSignal[] = [{ kind: "newPackage", days: 1 }, { kind: "onePublisher" }]

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
    commands: ACME_COMMANDS,
    syncWhat: "contacts, deals and invoices",
    usesCore: true,
    hosts: ["api.acme-crm.example"],
    userHosts: null,
    entities: { contact: ["name", "email", "phone", "company"], deal: ["title", "stage", "amount"] },
    signals: ACME_SIGNALS,
    links: {
      npm: "https://www.npmjs.com/package/@example/acme-crm-cli/v/0.3.0",
      publishers: [{ label: "example", url: "https://www.npmjs.com/~example" }],
      commit: `${OWN.repo}/commit/97acc2d215230a12c904c36273ea04db6c69fefe`,
      run: `${OWN.repo}/actions/runs/42432235252/attempts/1`,
      log: "https://search.sigstore.dev/?logIndex=3747723084",
    },
    tarball: "https://registry.npmjs.org/@example/acme-crm-cli/-/acme-crm-cli-0.3.0.tgz",
    integrity: `sha512-${"A".repeat(86)}==`,
    commit: "97acc2d215230a12c904c36273ea04db6c69fefe",
    entry: OWN,
    ...overrides,
  }
}

/** `?own-discover=risky`: a package with most things worth a second look. */
export function riskyReview(pkg: string): OwnReview {
  return ownReview({
    package: pkg,
    built: null,
    commit: null,
    usesCore: false,
    hosts: null,
    commands: ACME_COMMANDS.map((c) => ({ ...c, summary: null, entity: null })),
    entities: {},
    links: { ...ownReview().links, commit: null, run: null, log: null },
    signals: [
      { kind: "newPackage", days: 3 },
      { kind: "fewVersions", count: 1 },
      { kind: "onePublisher" },
      { kind: "noProvenance" },
      { kind: "coreOutOfRange", found: null, min: "0.603.0" },
      { kind: "noHosts" },
      { kind: "networkCode", modules: ["https", "fetch"] },
      { kind: "undeclaredHosts", hosts: ["collector.acme-metrics.io"], more: 0 },
      { kind: "startsPrograms" },
    ],
  })
}

/** GitHub's answer: `?own-github=risky` (young, quiet, no standard checks), `fail` (the hourly limit is used up). */
function risksMock(params: URLSearchParams): OwnSignal[] {
  const github = params.get("own-github") ?? (params.get("own-discover") === "risky" ? "risky" : null)
  if (github === "fail") return [{ kind: "githubUnchecked", reason: "limit" }]
  if (github === "risky")
    return [
      { kind: "repoNew", days: 4 },
      { kind: "fewStars", stars: 0 },
      { kind: "noStandardChecks", missing: ["node-ci.yml", "release-checks.yml"] },
    ]
  return [{ kind: "fewStars", stars: 3 }]
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
 * collision with a listed tool), `noprov` finds no provenance and no repository, `risky` most things to check, `old`
 * a manifest from before summaries, entities and hosts, `update` reviews an update with a new repository and new write
 * access; `?own-github=risky|fail` is GitHub's answer; a pasted `desktop` object passes a `no_manifest`. `?own-add=describe` refuses after
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
      ownShown = next
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
      if (discovered === "risky") return { outcome: "review", review: riskyReview(pkg) }
      if (discovered === "old") {
        const commands = ACME_COMMANDS.map((c) => ({ ...c, summary: null, entity: null }))
        return { outcome: "review", review: ownReview({ package: pkg, commands, entities: {}, hosts: null }) }
      }
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
    async ownToolRisks(_token: string): Promise<OwnSignal[]> {
      await delay(1200)
      return risksMock(params)
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
      ownAdded = true
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
      ownAdded = false
    },
  }
}
