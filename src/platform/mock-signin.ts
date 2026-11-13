import type { ZoomAppAnswer } from "./bindings"
import { delay } from "./mock-delay"
import { MOCK_CODES } from "./mock-qr"
import type { SignInEvent, SignInInputs } from "./signin-schemas"
import type { Platform } from "./types"

// Each tool's sign-in as it streams it off a terminal with `--json --answer-stdin`. `?signin-fail=wa` makes WhatsApp
// refuse after the first code, as when another wa holds the profile; `?signin-fail=zm` is Zoom without its own app's
// Public Client ID, until one is saved. Telegram: `?signin-fail=tg-apiid` refuses the app keys once (the next try signs
// in), `tg-flood` asks to wait seven minutes, `tg-code` says the login code expired, `tg-switch` refuses every run
// after the first, as when the last one has not stopped yet (a switch of method fails at once);
// `?signin-keyring=file` is tg with no system keyring, saving to a file instead. `?signin-fail=email` is a mail server
// refusing the app password; gcal refuses until the owner picks a client file of their own.
// `?signin-fail=<tool>:<reason>` fails any tool with one of the failures the window explains (`signin-failure.ts`):
// old, qr-expired, in-use, client-id, browser, denied, timeout, network, cancelled, ended. `?signin=max:token`
// opens MAX's token sign-in.
// `?signin=wa:phone` links WhatsApp by number: the number is asked, then a pairing code to type on the phone. Zoom:
// `?zm-client-id=ask` asks the Public Client ID in the window (zoom-cli PR #337), `?zoom-app=old` is a zm with no
// `zm app`, so the window uses its own list. Email (mail-cli PR #128): the address is asked when the plan leaves it
// empty, `?mail-server=manual` asks the server when discovery finds none, `?signin=email:microsoft` signs in by
// browser; `?signin=email:gmail&signin-fail=email:app-password|imap-off|refused|unreachable` fail with mail's reasons
// after the password, and `?signin-fail=drive:expired|signed-out|rate-limited` with Drive's.
// `?signin-scan-delay=12`: tg's code is scanned 2 s after it shows, and tg says nothing for 12 s, as after a real scan
// (Telegram moves the login to the account's data centre); `&signin-scanned=1` adds the progress line tg-cli could print
// at the scan.
// Bitrix24 (`?signin=bitrix`, `?signin-plan=bitrix&b24-step=webhook|paste`): the webhook is checked, then saved;
// `?signin-fail=bitrix:scope|malformed|webhook-refused|duplicate|network` fails with b24's reasons, and `?b24-same=1`
// has profile work already on acme.bitrix24.ru as employee 12, so the window refuses the sample webhook itself.
// The local application (`?signin=bitrix:app`, `?signin-plan=bitrix:app&b24-step=app`): the portal's page opens in the
// browser, then it is saved; `?signin-fail=bitrix:app-refused|app-payment|app-portal|app-timeout` fails with b24's
// reasons, the first three back on the application's form.
// Asterisk (`?signin-plan=asterisk:mysql`): the source is saved as settings, then checked; `?signin-fail=asterisk:network`.

const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const fails = query.get("signin-fail")
const [failTool, failReason] = fails?.includes(":") ? fails.split(":") : [null, null]
const keyringFile = query.get("signin-keyring") === "file"
const scanDelay = query.has("signin-scan-delay") ? Number(query.get("signin-scan-delay")) || 12 : null
const scanSays = query.get("signin-scanned") === "1"
const TG_SCAN = "scan in Telegram → Settings → Devices → Link Desktop Device"

const KEYRING_NOTE =
  "could not reach the OS keyring — it may be locked, or no keyring service is running (Platform failure: DBus " +
  "error: The name org.freedesktop.secrets was not provided by any .service files); using " +
  "~/.config/tg-cli/credentials.json instead, readable only by you"

let apiIdRefused = false
let tgRuns = 0

const WARNING = [
  "Before you link: wa is not an official WhatsApp app, and WhatsApp may ban an account that uses one.",
  "It also bans accounts that send in bulk or write to people who do not know them.",
  "wa writes only when a command asks, sends at most 30 messages an hour by default, and holds every",
  "write when WhatsApp says to slow down or restricts the account. Never send in bulk or to strangers.",
]
const RENEWS_MS = 4000

/** Every login page the mock shows carries this; `isMockLogin` keeps the browser build from opening it. */
const MOCK_CLIENT = "client_id=mock"
export const isMockLogin = (url: string) => url.includes(MOCK_CLIENT)

const SAMPLE = "Sample code, not scannable"
const upper = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Profiles a mock sign-in linked, so the account list shows them afterwards. */
export const linkedProfiles: string[] = []

type Script = {
  emit: (e: SignInEvent) => void
  /** Waits, ending early on a stop; true when stopped. */
  wait: (ms: number) => Promise<boolean>
  /** Asks a question and waits for `signInAnswer`; null when stopped. */
  ask: (field: string, prompt: string, secret: boolean, hint?: string) => Promise<string | null>
  profile: string
  id: string
}

const qrs = async ({ emit, wait }: Script, scan: string, count: number, expires = false) => {
  for (let n = 0; n < count; n++) {
    const expiresAt = expires ? new Date(Date.now() + RENEWS_MS).toISOString() : null
    emit({ event: "qr", text: MOCK_CODES[n % MOCK_CODES.length] ?? "", expiresAt, scan })
    if (await wait(RENEWS_MS)) return true
  }
  return false
}

const WA_PAIR =
  "WhatsApp on the phone: tap its notification, or Settings → Linked devices → Link a device → Link with phone number instead"
const zmAsks = query.get("zm-client-id") === "ask"
const zoomAppOld = query.get("zoom-app") === "old"
const manualServer = query.get("mail-server") === "manual"
const quick = query.has("drive-folders")

const kept = (messages: number): SignInEvent => ({
  event: "done",
  alreadyLinked: false,
  received: { chats: Math.ceil(messages / 60), messages, people: Math.ceil(messages / 130) },
})
const signedIn: SignInEvent = { event: "done", alreadyLinked: false, received: null }
const STOPPED: SignInEvent = { event: "stopped" }

let clientIdSaved = false
export const saveMockClientId = () => {
  clientIdSaved = true
}

const GOOGLE_URL = `https://accounts.google.com/o/oauth2/v2/auth?${MOCK_CLIENT}`
const ZOOM_REDIRECT = "https://wirecat.dev/zoom-callback"

const scripts: Record<string, (s: Script, method: string, inputs: SignInInputs) => Promise<SignInEvent>> = {
  async asterisk(s) {
    if (await s.wait(1500)) return STOPPED
    return signedIn
  },
  async bitrix(s, method) {
    if (method === "app") {
      s.emit({
        event: "openUrl",
        url: "https://acme.bitrix24.ru/oauth/authorize/?client_id=local.0123abcd",
        purpose: null,
      })
      if (await s.wait(4000)) return STOPPED
    }
    if (await s.wait(1500)) return STOPPED
    return { event: "done", alreadyLinked: false, received: null }
  },
  async wa(s, method) {
    for (const text of WARNING) s.emit({ event: "note", text })
    if (method === "phone") {
      const asked = await s.ask(
        "phone",
        "phone number, international format",
        false,
        "with + and the country code, such as +34",
      )
      if (asked === null) return STOPPED
      s.emit({ event: "pairingCode", code: "WCAT-2026", place: WA_PAIR, expiresAt: null })
      if (await s.wait(6000)) return STOPPED
      return history(s)
    }
    s.emit({
      event: "qr",
      text: MOCK_CODES[0] ?? "",
      expiresAt: new Date(Date.now() + RENEWS_MS).toISOString(),
      scan: WA_SCAN,
    })
    if (fails === "wa") {
      await delay(1500)
      return {
        event: "failed",
        code: "provider_unavailable",
        message: `this WhatsApp login is in use by wa ${s.profile} serve; stop it with \`wa ${s.profile} server stop\``,
      }
    }
    if (await s.wait(RENEWS_MS)) return STOPPED
    if (await qrs(s, WA_SCAN, 2, true)) return STOPPED
    return history(s)
  },
  async tg(s, method) {
    tgRuns += 1
    if (fails === "tg-switch" && tgRuns > 1)
      return {
        event: "failed",
        code: null,
        message: "A Telegram sign-in is still running or stopping. Try again in a few seconds.",
      }
    if (keyringFile) s.emit({ event: "note", text: KEYRING_NOTE })
    s.emit({
      event: "openUrl",
      url: "https://my.telegram.org/apps",
      purpose:
        "Log in with your phone number; the site sends its code in the Telegram app. Open API development tools " +
        "(if no app exists, fill App title and Short name, choose Desktop, and create it), then copy App api_id and " +
        "App api_hash.",
    })
    if ((await s.ask("api_id", "App api_id", false)) === null) return STOPPED
    if ((await s.ask("api_hash", "App api_hash (not shown)", true)) === null) return STOPPED
    if (fails === "tg-apiid" && !apiIdRefused) {
      apiIdRefused = true
      return { event: "failed", code: "provider_error", message: "Telegram refused: API_ID_INVALID" }
    }
    if (method === "phone") {
      if ((await s.ask("phone", "phone number, international format", false)) === null) return STOPPED
      if ((await s.ask("code", "login code", false)) === null) return STOPPED
    } else if (scanDelay !== null) {
      const expiresAt = new Date(Date.now() + RENEWS_MS).toISOString()
      s.emit({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt, scan: TG_SCAN })
      if (await s.wait(2000)) return STOPPED
      if (scanSays) s.emit({ event: "progress", step: "scanned", message: "scan accepted, finishing sign-in" })
      if (await s.wait(scanDelay * 1000)) return STOPPED
    } else if (await qrs(s, TG_SCAN, 2, true)) return STOPPED
    if (fails === "tg-flood")
      return { event: "failed", code: "rate_limited", message: "Telegram asks to wait 420 s before the next request" }
    if (fails === "tg-code")
      return { event: "failed", code: "provider_error", message: "Telegram refused: PHONE_CODE_EXPIRED" }
    if ((await s.ask("password", "2FA password (not shown)", true, "the usual one")) === null) return STOPPED
    return signedIn
  },
  async max(s, method) {
    if (method === "token") {
      if ((await s.ask("token", "MAX token", true)) === null) return STOPPED
      return signedIn
    }
    if (await qrs(s, "scan in the MAX app on your phone", 2, true)) return STOPPED
    if ((await s.ask("password", "MAX password", true, "the cat")) === null) return STOPPED
    s.emit({
      event: "note",
      text: "max is not the official MAX app, and the MAX terms do not allow automated programs (legal.max.ru/ps, 4.3.7).",
    })
    return signedIn
  },
  async zm(s) {
    if (zmAsks && !clientIdSaved) {
      const id = await s.ask(
        "client_id",
        "Public Client ID of your Zoom app",
        false,
        "Build a General app (User-managed, Public Client OAuth) at https://marketplace.zoom.us/develop/create; zm app lists what to enter.",
      )
      if (id === null) return STOPPED
      clientIdSaved = true
    }
    if (fails === "zm" && !clientIdSaved)
      return {
        event: "failed",
        code: "configuration_error",
        message: "run zm config set zoom.client_id <Public Client ID> first",
        reason: "zoom.client-id-missing",
      }
    s.emit({
      event: "openUrl",
      url: `https://zoom.us/oauth/authorize?response_type=code&${MOCK_CLIENT}&redirect_uri=${encodeURIComponent(ZOOM_REDIRECT)}`,
      purpose: "Approve access to Zoom in the browser",
    })
    const pasted = await s.ask(
      "redirect",
      "If the browser does not come back by itself, the address it ended on (code=…&state=…)",
      true,
    )
    return pasted === null ? STOPPED : signedIn
  },
  async drive(s) {
    s.emit({
      event: "openUrl",
      url: GOOGLE_URL,
      purpose: "Choose the Google account and allow access to Drive",
    })
    return (await s.wait(quick ? 1500 : 6000)) ? STOPPED : signedIn
  },
  // gcal 0.19 has no WireCat app yet: without the owner's own, it refuses as the real one does.
  async gcal(s, _method, inputs) {
    if (!inputs.clientFile)
      return {
        event: "failed",
        code: "configuration_error",
        message:
          "no Google OAuth client is set up: set GCAL_GOOGLE_CLIENT_ID and GCAL_GOOGLE_CLIENT_SECRET to your own Desktop app client; or pass --client-file <path> with the Desktop app client JSON from Google Cloud Console",
      }
    s.emit({
      event: "openUrl",
      url: GOOGLE_URL,
      purpose: "Choose the Google account and allow read access to Calendar",
    })
    return (await s.wait(5000)) ? STOPPED : signedIn
  },
  async email(s, method, inputs) {
    const address = inputs.address ?? (await s.ask("address", "Mail address", false))
    if (address === null) return STOPPED
    const domain = address.split("@")[1] ?? "example.com"
    s.emit({ event: "progress", step: "discover", message: `finding the mail server for ${domain}` })
    if (await s.wait(1200)) return STOPPED
    let host = method === "gmail" ? "imap.gmail.com" : `imap.${domain}`
    if (manualServer) {
      const imap = await s.ask("imap_host", "IMAP server", false)
      if (imap === null) return STOPPED
      host = imap || host
      for (const [field, prompt] of [
        ["imap_port", "IMAP port"],
        ["smtp_host", "SMTP server"],
        ["smtp_port", "SMTP port"],
      ] as const)
        if ((await s.ask(field, prompt, false)) === null) return STOPPED
    }
    if (method === "microsoft" || inputs.clientFile || inputs.oauth) {
      const page =
        method === "microsoft" ? "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" : GOOGLE_URL
      s.emit({ event: "openUrl", url: `${page}?${MOCK_CLIENT}`, purpose: "Sign in to Microsoft and allow access" })
      if (await s.wait(5000)) return STOPPED
      s.emit({ event: "progress", step: "login", message: `checking the sign-in with ${host}` })
      return (await s.wait(1200)) ? STOPPED : signedIn
    }
    const gmail = method === "gmail" || domain === "gmail.com"
    for (const text of [
      `Server: ${host}:993 (tls), login [email]`,
      ...(gmail ? GMAIL_PREPARE : genericPrepare(domain)),
    ])
      s.emit({ event: "note", text })
    const hint = gmail
      ? "Gmail takes an app password, not your account password. How to make one: https://support.google.com/accounts/answer/185833"
      : `If your mail provider offers app passwords, use one: the account password is often refused. Providers: ${MAIL_PROVIDERS}`
    if ((await s.ask("password", `App password for ${address}`, true, hint)) === null) return STOPPED
    s.emit({ event: "progress", step: "login", message: `checking the password with ${host}` })
    if (await s.wait(1500)) return STOPPED
    if (fails === "email")
      return {
        event: "failed",
        code: "authentication_error",
        reason: "mail.login-refused",
        message: "the server refused the login: the password may be the account password instead of an app password",
      }
    return signedIn
  },
}

/** mail-cli 0.20's `prepareText`, line by line as `signin_steps.rs` reads it off stderr. */
const MAIL_PROVIDERS = "https://github.com/WireCatLabs/mail-cli/blob/main/docs/providers.md"
const GMAIL_PREPARE = [
  "Prepare the Gmail mailbox first:",
  '  1. Personal Google Account: IMAP is always on, nothing to switch. Google Workspace: the administrator controls it, and the "Forwarding and POP/IMAP" tab in Gmail Settings, "See all settings", may be missing.',
  "  2. Turn on 2-Step Verification for the Google Account.",
  "  3. Open https://myaccount.google.com/apppasswords and create an app password. Google's help page does not list the labels of that screen, so none are quoted here.",
  "  4. Copy the 16 digit password and use it instead of the account password.",
  "  Note: App passwords are not offered if 2-Step Verification is set up only for security keys, on a work or school account, or with Advanced Protection on.",
  "  Sources: https://support.google.com/mail/answer/7126229 https://support.google.com/accounts/answer/185833",
  `  All providers: ${MAIL_PROVIDERS}`,
]
const genericPrepare = (domain: string) => [
  `About the ${domain} mailbox:`,
  "  Note: Make sure IMAP is on for the mailbox and, if the provider offers app passwords, make one: a normal password is often refused.",
  `  All providers: ${MAIL_PROVIDERS}`,
]

const WA_SCAN = "scan in WhatsApp → Settings → Linked devices → Link a device"

async function history(s: Script) {
  s.emit({
    event: "progress",
    step: "history",
    message: "receiving history from the phone; keep WhatsApp open on it. Ctrl+C stops — `serve` picks up the rest.",
  })
  if (await s.wait(3000)) return kept(120)
  s.emit({ event: "progress", step: "waiting", message: null })
  if (await s.wait(2500)) return kept(900)
  return kept(18_400)
}

const FAILURES: Record<
  string,
  {
    first?: "qr" | "browser" | "password"
    code: string | null
    reason?: string
    message: (profile: string) => string
  }
> = {
  old: { code: "needs_update", message: () => "This version cannot sign in here yet." },
  "qr-expired": {
    first: "qr",
    code: "timeout",
    message: () => "the QR code expired before it was scanned — run the command again",
  },
  "in-use": {
    first: "qr",
    code: "provider_unavailable",
    message: (p) => `this WhatsApp login is in use by wa ${p} serve; WhatsApp allows one connection per linked device`,
  },
  "client-id": {
    code: "configuration_error",
    reason: "zoom.client-id-missing",
    message: () => "run zm config set zoom.client_id <Public Client ID> first, or set ZM_ZOOM_CLIENT_ID",
  },
  browser: { first: "browser", code: "took_too_long", message: () => "The sign-in took longer than 15 minutes." },
  denied: { first: "browser", code: "authentication_error", message: () => "access_denied: the user declined access" },
  timeout: { code: "took_too_long", message: () => "The sign-in took longer than 15 minutes." },
  network: { code: "network_error", message: () => "getaddrinfo ENOTFOUND api.example.com" },
  cancelled: { code: "cancelled", message: () => "the input closed before the answer came" },
  ended: { code: "ended", message: () => "The sign-in ended without saying how." },
  "app-password": {
    first: "password",
    code: "authentication_error",
    reason: "mail.app-password-required",
    message: () => "the server asks for an app password",
  },
  "imap-off": {
    first: "password",
    code: "authentication_error",
    reason: "mail.imap-disabled",
    message: () => "IMAP is turned off for this mailbox",
  },
  refused: {
    first: "password",
    code: "authentication_error",
    reason: "mail.login-refused",
    message: () => "the server refused the login",
  },
  unreachable: {
    code: "network_error",
    reason: "mail.host-unreachable",
    message: () => "could not reach imap.example.com:993",
  },
  expired: {
    first: "browser",
    code: "authentication_error",
    reason: "oauth.expired",
    message: () => "the sign-in expired",
  },
  "signed-out": { code: "authentication_error", reason: "oauth.missing", message: () => "no saved sign-in" },
  "rate-limited": { code: "rate_limited", reason: "provider.rate-limited", message: () => "Google asks to slow down" },
  scope: {
    code: "permission_error",
    reason: "webhook.scope-missing",
    message: () => "this webhook has no user scope for user.current (INSUFFICIENT_SCOPE); add it in Bitrix24",
  },
  malformed: {
    code: "validation_error",
    reason: "webhook.malformed",
    message: () => "that is not a Bitrix24 incoming webhook address: its path is not /rest/<user id>/<secret>/",
  },
  "webhook-refused": {
    code: "authentication_error",
    reason: "webhook.refused",
    message: () => "Bitrix24 refused this webhook (NO_AUTH_FOUND)",
  },
  "app-refused": {
    first: "browser",
    code: "authentication_error",
    reason: "oauth.expired",
    message: () =>
      "Bitrix24 refused the application's code or key (INVALID_CLIENT): check both, and that the local application is saved in this portal",
  },
  "app-payment": {
    first: "browser",
    code: "authentication_error",
    reason: "oauth.expired",
    message: () => "Bitrix24 issues no tokens until the portal's plan is paid (PAYMENT_REQUIRED)",
  },
  "app-portal": {
    first: "browser",
    code: "authentication_error",
    reason: "oauth.mismatch",
    message: () => "Bitrix24 signed in to another portal than acme.bitrix24.ru; sign in with that portal's address",
  },
  "app-timeout": {
    first: "browser",
    code: "timeout",
    reason: "oauth.timeout",
    message: () => "Bitrix24 sign-in timed out",
  },
  duplicate: {
    code: "conflict",
    reason: "session.duplicate",
    message: () =>
      "profile work already uses this webhook (acme.bitrix24.ru, user 12). Use `b24 work`, or end it first",
  },
}

/** One of the failures the window explains, after the step it happens on. */
async function failing(s: Script, reason: string): Promise<SignInEvent> {
  const f = FAILURES[reason] ?? FAILURES.ended
  if (!f) return STOPPED
  if (f.first === "qr") s.emit({ event: "qr", text: MOCK_CODES[0] ?? "", expiresAt: null, scan: null })
  if (f.first === "browser")
    s.emit({ event: "openUrl", url: `https://accounts.example.com/authorize?${MOCK_CLIENT}`, purpose: null })
  if (f.first === "password") {
    for (const text of ["Server: imap.gmail.com:993 (tls), login [email]", ...GMAIL_PREPARE])
      s.emit({ event: "note", text })
    const hint =
      "Gmail takes an app password, not your account password. How to make one: https://support.google.com/accounts/answer/185833"
    if ((await s.ask("password", "App password for me@gmail.com", true, hint)) === null) return STOPPED
    s.emit({ event: "progress", step: "login", message: "checking the password with imap.gmail.com" })
    if (await s.wait(1200)) return STOPPED
  } else if (f.first && (await s.wait(2500))) return STOPPED
  return { event: "failed", code: f.code, reason: f.reason ?? null, message: f.message(s.profile) }
}

const ZOOM_SCOPES = [
  ["meeting:read:list_meetings", true, "find your meetings and scheduled series"],
  ["meeting:read:list_past_instances", true, "find each meeting that ran"],
  ["cloud_recording:read:meeting_transcript", true, "read meeting transcripts"],
  ["meeting:read:list_past_participants", true, "read who joined and when"],
  ["meeting:read:summary", true, "read Zoom AI summaries"],
  ["cloud_recording:read:list_user_recordings", false, "find your cloud recordings"],
  ["user:read:user", false, "session status --check"],
  ["meeting:write:meeting", false, "create a meeting"],
] as const

/** zm's `app --json` as zoom-cli PR #337 prints it; `?zoom-app=old` is a zm from before it. */
async function zoomAppSetup(): Promise<ZoomAppAnswer> {
  await delay(400)
  if (zoomAppOld) return { state: "old" }
  return {
    state: "ready",
    setup: {
      marketplaceUrl: "https://marketplace.zoom.us/develop/create",
      guideUrl: "https://wirecat.dev/en/docs/zm/zoom-app",
      appType: "General app",
      management: "User-managed",
      oauth: "Public Client OAuth",
      redirectUrl: ZOOM_REDIRECT,
      allowList: [ZOOM_REDIRECT],
      scopes: ZOOM_SCOPES.map(([scope, required, purpose]) => ({ scope, required, purpose })),
      configKey: "zoom.client_id",
    },
  }
}

export function signInMock(): Pick<
  Platform,
  "signIn" | "signInAnswer" | "signInStop" | "zoomAppSetup" | "signInOnPortal"
> {
  let stop: (() => void) | null = null
  let reply: ((value: string) => void) | null = null

  return {
    async signIn(id, method, profile, onEvent, inputs = {}) {
      let stopped = false
      stop = () => {
        stopped = true
      }
      const wait = async (ms: number) => {
        const until = Date.now() + ms
        while (!stopped && Date.now() < until) await delay(100)
        return stopped
      }
      const ask: Script["ask"] = async (field, prompt, secret, hint) => {
        let answer: string | null = null
        reply = (value) => {
          answer = value
        }
        onEvent({ event: "needs", field, secret, prompt, hint: hint ?? null })
        while (!stopped && answer === null) await delay(100)
        reply = null
        if (stopped) return null
        onEvent({ event: "progress", step: "check", message: "checking" })
        await delay(700)
        return answer
      }
      const emit = (e: SignInEvent) =>
        onEvent(e.event === "qr" ? { ...e, scan: e.scan ? `${SAMPLE}. ${upper(e.scan)}` : `${SAMPLE}.` } : e)
      await delay(500)
      const script = failTool === id && failReason ? (s: Script) => failing(s, failReason) : scripts[id]
      const end = script
        ? await script({ emit, wait, ask, profile, id }, method, inputs)
        : ({ event: "failed", message: "This tool cannot sign in here.", code: null } as SignInEvent)
      await delay(400)
      if (end.event === "done" && !linkedProfiles.includes(profile)) linkedProfiles.push(profile)
      onEvent(end)
    },
    async signInAnswer(_id, value) {
      if (!reply) throw new Error("The sign-in has already ended.")
      reply(value)
    },
    async signInStop() {
      stop?.()
    },
    zoomAppSetup,
    async signInOnPortal(_id, host) {
      await delay(500)
      return query.get("b24-same") === "1" && host === "acme.bitrix24.ru" ? [{ profile: "work", user: "12" }] : []
    },
  }
}
