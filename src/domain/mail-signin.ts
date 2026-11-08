/**
 * The mail providers whose app password the window walks through itself, and the domains that name them. Domains and
 * pages are mail-cli's own (`src/providers.ts`, 0.20); a provider missing there (Yahoo) gets the tool's text instead.
 */
export type AppPasswordProvider = "gmail" | "yandex" | "mailru" | "icloud"

const DOMAINS: Record<AppPasswordProvider, string[]> = {
  gmail: ["gmail.com", "googlemail.com"],
  yandex: ["yandex.ru", "yandex.com", "ya.ru", "yandex.by", "yandex.kz", "yandex.ua"],
  mailru: ["mail.ru", "inbox.ru", "list.ru", "bk.ru", "internet.ru"],
  icloud: ["icloud.com", "me.com", "mac.com"],
}

/** Where each provider makes the password; Yandex also needs IMAP turned on in its mail settings first. */
export const APP_PASSWORD_PAGES = {
  gmail: "https://myaccount.google.com/apppasswords",
  yandex: "https://id.yandex.ru/security",
  yandexImap: "https://mail.yandex.ru/#setup/client",
  mailru: "https://e.mail.ru/inbox",
  icloud: "https://account.apple.com",
} as const

/** mail-cli's table of every provider (`PROVIDERS_URL`), which its hints name when it knows no page of the provider's. */
export const MAIL_PROVIDERS_LIST = "github.com/WireCatLabs/mail-cli/blob/main/docs/providers.md"

/** Gmail signs in with an app password, or in the browser with the owner's own Google client. */
export type MailWay = "appPassword" | "browser"

export function appPasswordProvider(method: string | null, address: string): AppPasswordProvider | null {
  if (method === "gmail") return "gmail"
  if (method !== "imap") return null
  const domain = address.trim().toLowerCase().split("@")[1] ?? ""
  const found = Object.entries(DOMAINS).find(([, domains]) => domains.includes(domain))
  return found ? (found[0] as AppPasswordProvider) : null
}

/** Gmail's app password is 16 letters, shown in groups of four; the spaces a copy carries are not part of it. */
export const appPasswordValue = (provider: AppPasswordProvider | null, typed: string) =>
  provider === "gmail" ? typed.replace(/\s+/g, "") : typed.trim()

/** mail-cli's prepare text, as `session start` prints it line by line (`prepareText`, `src/providers.ts`). */
export type MailNotes = {
  /** `Server: imap.example.com:993 (tls), login …`: true, but only for the curious. */
  server: string | null
  steps: string[]
  notes: string[]
  /** Lines that are not part of the prepare text; the window shows them as the tool's own notes. */
  other: string[]
}

const SERVER = /^Server: /
const HEAD = /^(?:Prepare the .+ mailbox first|About the .+ mailbox):$/
const STEP = /^\d+\.\s+(.+)$/
const NOTE = /^Note:\s+(.+)$/
/** Written for the provider table's maintainers, not for the owner. */
const FOR_MAINTAINERS = /^(?:Sources|All providers):/
const MAINTAINER_SENTENCE = /help pages? (?:does|do) not (?:list|confirm)|none are quoted here/i

const forOwner = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !MAINTAINER_SENTENCE.test(sentence))
    .join(" ")

export function readMailNotes(lines: readonly string[]): MailNotes {
  const read: MailNotes = { server: null, steps: [], notes: [], other: [] }
  for (const raw of lines) {
    const line = raw.trim()
    const step = line.match(STEP)?.[1]
    const note = line.match(NOTE)?.[1]
    if (SERVER.test(line)) read.server = line.replace(SERVER, "")
    else if (HEAD.test(line) || FOR_MAINTAINERS.test(line) || !line) continue
    else if (step) read.steps.push(forOwner(step))
    else if (note) read.notes.push(forOwner(note))
    else read.other.push(raw)
  }
  return read
}
