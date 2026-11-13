import { guidedProvider } from "@/shared/signin-store"

/**
 * The steps of each tool's sign-in, as the window lists them above the step on screen. A tool or method missing here
 * gets the steps its method kind implies. Their words are in `messages-wizard.ts`.
 */
export type WizardStep =
  | "intro"
  | "keys"
  | "app"
  | "scan"
  | "phone"
  | "code"
  | "pair"
  | "password"
  | "appPassword"
  | "server"
  | "token"
  | "browser"
  | "history"
  | "check"
  | "portal"
  | "webhook"
  | "paste"
  | "localApp"
  | "source"
  | "done"

const PATHS: Record<string, WizardStep[]> = {
  "tg:qr": ["intro", "keys", "scan", "password", "done"],
  "tg:phone": ["intro", "keys", "phone", "code", "password", "done"],
  "max:qr": ["intro", "scan", "password", "done"],
  "max:token": ["intro", "token", "done"],
  "wa:qr": ["intro", "scan", "history", "done"],
  "wa:phone": ["intro", "phone", "pair", "history", "done"],
  "zm:browser": ["intro", "app", "browser", "done"],
  "email:gmail": ["intro", "appPassword", "check", "done"],
  "email:gmail:browser": ["intro", "browser", "done"],
  "email:imap": ["intro", "server", "appPassword", "check", "done"],
  "email:imap:guided": ["intro", "appPassword", "check", "done"],
  "bitrix:webhook": ["portal", "webhook", "paste", "done"],
  "bitrix:app": ["portal", "localApp", "browser", "done"],
  "asterisk:csv": ["source", "done"],
  "asterisk:mysql": ["source", "check", "done"],
  "asterisk:postgres": ["source", "check", "done"],
}

const BY_KIND: Record<string, WizardStep[]> = {
  qr: ["intro", "scan", "done"],
  phone: ["intro", "phone", "code", "done"],
  token: ["intro", "token", "done"],
}

export const wizardPath = (tool: string, method: string | null, route: Route = null): WizardStep[] =>
  (route ? PATHS[`${tool}:${method}:${route}`] : undefined) ??
  PATHS[`${tool}:${method}`] ??
  BY_KIND[method ?? ""] ?? ["intro", "browser", "done"]

/**
 * A second way within one method: `guided` when the window asks the app password on its own step (a provider it knows
 * the steps of), `browser` for Gmail with the owner's own Google client.
 */
export type Route = "guided" | "browser" | null

export const routeOf = (s: Parameters<typeof guidedProvider>[0]): Route =>
  guidedProvider(s) ? "guided" : s.tool === "email" && s.method === "gmail" && s.way === "browser" ? "browser" : null

/** mail-cli asks these only when discovery finds no server; each may be left empty for its default. */
export const MAIL_SERVER_FIELDS = new Set(["imap_host", "imap_port", "smtp_host", "smtp_port"])

/**
 * Zoom's own app, as zoom-cli `docs/zoom-app.md` and `src/login.ts` describe it (zoom-cli 0.67). zm from PR #337 says
 * the same with `zm app --json`, which wins when it answers.
 */
export const ZOOM_APP = {
  marketplace: "https://marketplace.zoom.us/",
  redirect: "https://wirecat.dev/zoom-callback",
  scopes: [
    "meeting:read:list_meetings",
    "meeting:read:list_past_instances",
    "cloud_recording:read:meeting_transcript",
    "meeting:read:list_past_participants",
    "meeting:read:summary",
  ],
} as const

/**
 * max-cli keeps only the token from what web.max.ru stores under `__oneme_auth` (`src/session/browser.ts` `tokenIn`):
 * a JSON object with `token`, or the token alone. The owner may paste either; only the token is sent.
 */
export function maxTokenIn(pasted: string): string {
  const text = pasted.trim()
  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === "object" && parsed !== null && "token" in parsed) {
      const token = (parsed as { token: unknown }).token
      return typeof token === "string" ? token.trim() : ""
    }
    return typeof parsed === "string" ? parsed.trim() : text
  } catch {
    return text.replace(/^["']|["']$/g, "")
  }
}
