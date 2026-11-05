import type { CommunityStatus, ExtraTools } from "./community-schemas"

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
  mcp: null,
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

export function extraToolsMock(scenario: string | null): ExtraTools {
  if (scenario === "1") return { tools: [ACME], rejected: [] }
  if (scenario === "bad") return { tools: [ACME, { ...ACME, id: "evil", package: "@wirecat/evil" }], rejected: [] }
  return { tools: [], rejected: [] }
}

/** The Settings switch; `?community=1` or `bad` starts it on, as the list could only have been read then. */
export function communityMock(params: URLSearchParams) {
  let show = params.has("community")
  const available = params.get("community-key") !== "none"
  return {
    async communityStatus(): Promise<CommunityStatus> {
      return { show, available, listed: extraToolsMock(params.get("community")).tools.length }
    },
    async setCommunityShown(next: boolean) {
      show = next
    },
  }
}
