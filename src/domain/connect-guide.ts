/** The ways the owner's server gets a public address; `wirecat` is the Tailscale choice through WireCat's own connection. */
export type Tunnel = "tailscale" | "wirecat" | "cloudflare" | "own"
export type Phase = "idle" | "tunnel" | "server" | "failed"
export type Failure = { at: "tunnel" | "server"; message: string }
export type LampState = "busy" | "done" | "todo" | "failed"

type Serving = { connectorUrl: string | null }

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** What the Stop button on a Tailscale approval raises; the guide goes back a step instead of showing a failure. */
export const wasStopped = (e: unknown) => errorMessage(e) === "Stopped."

export const viaTailscale = (t: Tunnel) => t === "tailscale" || t === "wirecat"

/** The wirecat choice is a variant of the Tailscale card, so it lights the same one. */
export const choiceOf = (t: Tunnel): Exclude<Tunnel, "wirecat"> => (t === "wirecat" ? "tailscale" : t)

/** A tunnel on this computer only (http://127.0.0.1) has no public name to look up. */
export const isLocalAddress = (server: Serving | null) => server?.connectorUrl?.startsWith("http://") ?? false

/** The Funnel the server's address rides on has stopped, for a server that is up. */
export const funnelStopped = (tunnel: Tunnel, running: boolean, funnel: { live: boolean } | null) =>
  viaTailscale(tunnel) && running && funnel !== null && !funnel.live

/** The Cloudflare tunnel has stopped while the server's address is on it. */
export const tunnelStopped = (server: Serving | null, running: boolean, route: { live: boolean; url: string } | null) =>
  running && route !== null && !route.live && (server?.connectorUrl?.startsWith(route.url) ?? false)

/** Which dots the Start step shows: opening the address, then starting the server. */
export function startProgress(phase: Phase, failure: Failure | null): { open: LampState; server: LampState } {
  const failedAt = phase === "failed" ? failure?.at : undefined
  return {
    open: phase === "tunnel" ? "busy" : failedAt === "tunnel" ? "failed" : phase === "idle" ? "todo" : "done",
    server: phase === "server" ? "busy" : failedAt === "server" ? "failed" : "todo",
  }
}

export const portInUse = (message: string) => /in use|EADDRINUSE/i.test(message)

type Reach = { state: "checking" | "publishing" | "live" | "wrong" | "unknown" }

/** The dot of the address check; a repeat check of a name that is live or wrong shows busy only while asking. */
export function reachLamp(reach: Reach, checking: boolean): LampState {
  if (reach.state === "checking" || (checking && reach.state !== "publishing")) return "busy"
  if (reach.state === "publishing") return "busy"
  return reach.state === "unknown" ? "failed" : "done"
}

/** Tailscale's own figure for a new Funnel name to appear in public DNS. */
export const PUBLISH_MS = 10 * 60_000

export function publishWait(waited: number): { share: number; minutes: number } {
  return { share: Math.min(waited / PUBLISH_MS, 1), minutes: Math.floor(waited / 60_000) }
}

/** A Funnel name is Tailscale's to publish, slowly; on a tunnel of the owner's the record already exists. */
export const isFunnelHost = (host: string) => host.endsWith(".ts.net")

/** How long the test waits before it suggests what may be wrong. */
export const QUIET_MS = 60_000

export const quietDelay = (since: number, now: number) => Math.max(QUIET_MS - (now - since), 0)

/** Other tools with an MCP server that are installed, to offer after the first call. */
export function otherServerTools<T extends { id: string; mcpServer?: unknown }>(
  all: readonly T[],
  current: string,
  installs: Record<string, readonly unknown[] | undefined>,
): T[] {
  return all.filter((t) => t.mcpServer && t.id !== current && (installs[t.id]?.length ?? 0) > 0)
}
