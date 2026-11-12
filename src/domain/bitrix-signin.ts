/**
 * Bitrix24's sign-in in the window: the owner's portal, the page to make an incoming webhook on, and what b24's
 * refusals mean. The webhook address is a secret: nothing here returns or logs it, only its portal and employee id.
 */

/** The host of a portal as typed: `mycompany.bitrix24.ru`, a full URL, or a self-hosted name. Null when not a host. */
export function portalHost(typed: string): string | null {
  const text = typed.trim()
  if (!text || /\s/.test(text)) return null
  let host: string
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`).hostname.toLowerCase()
  } catch {
    return null
  }
  const labels = host.split(".")
  const shaped =
    labels.length >= 2 &&
    labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) &&
    !/^\d+$/.test(labels.at(-1) ?? "")
  return shaped ? host : null
}

/**
 * The portal's Developer resources, where Other → Incoming webhook is. Only the menu path is documented
 * (apidocs.bitrix24.com/local-integrations/local-webhooks.html); `/devops/` is the section's address on the portal.
 */
export const webhookPage = (host: string) => `https://${host}/devops/`

/** The rights b24 needs, by the code Bitrix24 shows beside each. `user_basic` is what `user.current` asks. */
export const WEBHOOK_SCOPES = ["crm", "user_basic", "department"] as const
export type WebhookScope = (typeof WEBHOOK_SCOPES)[number]

const PATH = /^\/rest\/(?:api\/)?(\d+)\/[A-Za-z0-9_-]+(?:\/.*)?$/

/** The portal and the employee a pasted webhook acts as, read the way b24 reads it; null when it is no webhook. */
export function webhookParts(pasted: string): { host: string; user: string } | null {
  let url: URL
  try {
    url = new URL(pasted.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null
  const user = PATH.exec(url.pathname)?.[1]
  return user ? { host: url.hostname.toLowerCase(), user } : null
}

/** What the paste step says when the address cannot be used; each kind has its own words and fix. */
export type WebhookProblem =
  | { kind: "scope" | "malformed" | "refused" | "unreachable"; message: string }
  | { kind: "wrongPortal"; host: string }
  | { kind: "duplicate"; profile: string | null; message: string }

/** b24's reasons (`src/reasons.ts`, and `session.duplicate` from bitrix24-cli's account-remove branch). */
export function webhookProblem(failure: {
  message: string
  code: string | null
  reason?: string | null | undefined
}): WebhookProblem | null {
  const { message, code, reason } = failure
  if (reason === "session.duplicate" || /already uses this webhook/i.test(message))
    return { kind: "duplicate", profile: /profile (\S+) already uses/.exec(message)?.[1] ?? null, message }
  if (reason === "webhook.scope-missing" || /INSUFFICIENT_SCOPE|no (user )?scope/i.test(message))
    return { kind: "scope", message }
  if (reason === "webhook.malformed") return { kind: "malformed", message }
  if (reason === "webhook.refused" || /invalid_token|expired_token|NO_AUTH_FOUND/i.test(message))
    return { kind: "refused", message }
  if (code === "network_error" || /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|certificate/i.test(message))
    return { kind: "unreachable", message }
  return null
}

/**
 * The local application's handler path: Bitrix24 sends the browser there, and the page passes the code back to b24 on
 * this computer (bitrix24-cli `src/bitrix/oauth.ts` RELAY_URL).
 */
export const APP_HANDLER = "https://wirecat.dev/webhooks/apps/b24-callback"

/** b24's sign-in guide on wirecat.dev, in Russian or else in English: the site has no Spanish pages. */
export const appGuide = (lang: string) => `https://wirecat.dev/${lang === "ru" ? "ru" : "en"}/docs/b24/usage`

/** Bitrix24 shows the Application ID as `local.<hex>.<digits>`; this only keeps out what b24 would refuse anyway. */
export const appIdShaped = (typed: string) =>
  /^[A-Za-z0-9._-]{1,128}$/.test(typed.trim()) && !typed.trim().startsWith("-")

/** What the application's form says when b24 refused the sign-in; each kind has its own words and fix. */
export type AppProblem = {
  kind: "refused" | "payment" | "wrongPortal" | "unreachable" | "scope" | "invalid"
  message: string
}

/**
 * b24's refusals of a local application's sign-in (bitrix24-cli `src/bitrix/oauth.ts`, `src/commands/session.ts`).
 * Null for what the general failure screen says better: a browser that never came back, a denial, a stop.
 */
export function appProblem(failure: {
  message: string
  code: string | null
  reason?: string | null | undefined
}): AppProblem | null {
  const { message, code, reason } = failure
  if (/PAYMENT_REQUIRED/.test(message)) return { kind: "payment", message }
  if (reason === "oauth.mismatch" && /another portal/i.test(message)) return { kind: "wrongPortal", message }
  if (reason === "oauth.expired" || /INVALID_CLIENT|code or key/i.test(message)) return { kind: "refused", message }
  if (reason === "webhook.scope-missing" || /INSUFFICIENT_SCOPE/i.test(message)) return { kind: "scope", message }
  if (
    reason === "oauth.unavailable" ||
    reason === "oauth.no-response" ||
    code === "network_error" ||
    /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|certificate/i.test(message)
  )
    return { kind: "unreachable", message }
  if (code === "validation_error") return { kind: "invalid", message }
  return null
}
