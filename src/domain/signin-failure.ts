/**
 * Why a sign-in failed, in words the window can explain, and what it offers to do about it. The tools report a failure
 * as an English line and, since cli-core's sign-in steps, often a `code`; the code wins when it is there, the line is
 * read only for what no code names yet. Telegram's own refusals are read by `telegram-signin.ts` first.
 */
export type FailureReason =
  | "needsUpdate"
  | "qrExpired"
  | "loginInUse"
  | "clientIdMissing"
  | "mailRefused"
  | "mailAppPassword"
  | "mailImapOff"
  | "mailUnreachable"
  | "signedOut"
  | "signInExpired"
  | "rateLimited"
  | "browserNoReturn"
  | "denied"
  | "timeout"
  | "network"
  | "cancelled"
  | "ended"
  | "unknown"

/**
 * One button each. `retry` runs the same sign-in again; `otherMethod` the catalog's other way in; `update` opens the
 * tool's page, where it updates; `terminal` the tool's own setup in a terminal; `toolPage` the tool's page;
 * `copy` puts `copy` on the clipboard; `report` sends a bug report.
 */
export type FailureAction =
  | "retry"
  | "otherMethod"
  | "update"
  | "terminal"
  | "toolPage"
  | "copy"
  | "openPage"
  | "report"

export type ExplainedFailure = {
  reason: FailureReason
  primary: FailureAction
  fallback: FailureAction | null
  /** The text `copy` puts on the clipboard. */
  copy?: string
  /** The page `openPage` opens: where the provider makes an app password, for example. */
  page?: string
}

/** The step the window showed when the tool gave up; it tells a QR code nobody scanned from a page never finished. */
export type FailedAt = "starting" | "scan" | "pair" | "browser" | "answer" | "progress" | null

export type FailureInput = {
  tool: string
  profile: string
  message: string
  code: string | null
  /** cli-base's finer name, such as `device.in-use`; null from tools that send none. */
  reason?: string | null
  at: FailedAt
  /** The catalog has another way in for this tool, and the owner is not choosing a provider. */
  otherMethod: boolean
  /** The tool has a setup command a terminal can run. */
  terminal: boolean
  /** A page the tool named in its last question's hint, such as the provider's app password page. */
  page?: string | undefined
}

export const NETWORK =
  /did not answer in time|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ENETUNREACH|socket hang up|fetch failed|network|could not connect|connection (?:closed|lost|refused)|offline/i

/**
 * zoom-cli from PR #337 sends the reason; an older zm says it only in words ("run zm config set zoom.client_id …").
 */
export const zoomNeedsClientId = (tool: string, message: string, reason?: string | null) =>
  tool === "zm" && (reason === "zoom.client-id-missing" || message.includes("zoom.client_id"))

/** Google's pages for Gmail's two refusals; mail-cli names the reason, not the page. */
export const GMAIL_APP_PASSWORDS = "https://myaccount.google.com/apppasswords"
export const GMAIL_IMAP_HELP = "https://support.google.com/mail/answer/7126229"

/**
 * Texts and codes checked in the tools' source (2026-11-07): whatsapp-cli `engine/cmd/wa-engine/device.go` ("this
 * WhatsApp login is in use by …", reason `device.in-use`) and `link.go` ("the login code expired before the phone
 * confirmed it", code `timeout`); max-cli `src/session/login.ts` ("the QR code expired before it was scanned", code
 * `timeout`); zoom-cli `src/login.ts` ("Zoom login timed out", "Zoom login was not approved", "could not open the
 * browser"); cli-core `sign-in-steps.ts` (code `cancelled`, reason `input.closed`).
 */
const IN_USE = /\bin use by\b|server stop/i
const QR_EXPIRED =
  /\b(?:qr|login) code expired|\bqr\b.*\b(?:expired|timed out)|not scanned|ended before the phone confirmed/i
const DENIED = /access_denied|access denied|was not approved|declined|cancell?ed by (?:the )?user/i
const BROWSER = /login timed out|could not open the browser|callback|redirect|state mismatch|matching code and state/i

const NEEDS_UPDATE = "needs_update"
const ENDED = "ended"
/** `signin.rs`: the run passed the app's own time limit. */
export const TOOK_TOO_LONG = "took_too_long"

export function explainFailure(f: FailureInput): ExplainedFailure {
  const other = f.otherMethod ? "otherMethod" : null
  const retry = (reason: FailureReason, fallback: FailureAction | null = other): ExplainedFailure => ({
    reason,
    primary: "retry",
    fallback,
  })
  if (f.code === NEEDS_UPDATE)
    return { reason: "needsUpdate", primary: "update", fallback: f.terminal ? "terminal" : null }
  if (zoomNeedsClientId(f.tool, f.message, f.reason))
    return { reason: "clientIdMissing", primary: "retry", fallback: null }
  // mail-cli PR #128 and drive-cli PR #335: stable reasons, so their server's wording never has to be read.
  switch (f.reason) {
    case "mail.app-password-required":
      return { reason: "mailAppPassword", primary: "openPage", fallback: "retry", page: f.page ?? GMAIL_APP_PASSWORDS }
    case "mail.imap-disabled":
      return { reason: "mailImapOff", primary: "openPage", fallback: "retry", page: GMAIL_IMAP_HELP }
    case "mail.login-refused":
      return f.page
        ? { reason: "mailRefused", primary: "retry", fallback: "openPage", page: f.page }
        : { reason: "mailRefused", primary: "retry", fallback: null }
    case "mail.host-unreachable":
      return retry("mailUnreachable", null)
    case "oauth.missing":
      return retry("signedOut", null)
    case "oauth.expired":
      return retry("signInExpired", null)
    case "oauth.timeout":
      return retry("browserNoReturn")
    case "provider.rate-limited":
      return retry("rateLimited", null)
  }
  if (f.reason === "device.in-use" || (f.tool === "wa" && IN_USE.test(f.message)))
    return { reason: "loginInUse", primary: "toolPage", fallback: "copy", copy: `wa ${f.profile} server stop` }
  if (f.code === "cancelled") return retry("cancelled")
  if (DENIED.test(f.message)) return retry("denied")
  if (QR_EXPIRED.test(f.message) || (f.code === "timeout" && f.at === "scan")) return retry("qrExpired")
  if (f.code === TOOK_TOO_LONG)
    return retry(f.at === "browser" ? "browserNoReturn" : f.at === "scan" ? "qrExpired" : "timeout")
  if (BROWSER.test(f.message) && (f.at === "browser" || f.at === "answer" || f.tool === "zm"))
    return retry("browserNoReturn")
  if (f.code === "network_error" || NETWORK.test(f.message)) return retry("network", null)
  if (f.code === "timeout") return retry("timeout")
  if (f.code === ENDED) return retry("ended", other ?? (f.terminal ? "terminal" : "report"))
  return retry("unknown", other ?? "report")
}
