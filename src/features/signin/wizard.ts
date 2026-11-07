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
  | "password"
  | "token"
  | "browser"
  | "history"
  | "check"
  | "done"

const PATHS: Record<string, WizardStep[]> = {
  "tg:qr": ["intro", "keys", "scan", "password", "done"],
  "tg:phone": ["intro", "keys", "phone", "code", "password", "done"],
  "max:qr": ["intro", "scan", "password", "done"],
  "max:token": ["intro", "token", "done"],
  "wa:qr": ["intro", "scan", "history", "done"],
  "zm:browser": ["intro", "app", "browser", "done"],
  "email:gmail": ["intro", "check", "done"],
  "email:imap": ["intro", "check", "done"],
}

const BY_KIND: Record<string, WizardStep[]> = {
  qr: ["intro", "scan", "done"],
  phone: ["intro", "phone", "code", "done"],
  token: ["intro", "token", "done"],
}

export const wizardPath = (tool: string, method: string | null): WizardStep[] =>
  PATHS[`${tool}:${method}`] ?? BY_KIND[method ?? ""] ?? ["intro", "browser", "done"]

/** Zoom's own app, as zoom-cli `docs/zoom-app.md` and `src/login.ts` describe it (zoom-cli 0.67). */
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
