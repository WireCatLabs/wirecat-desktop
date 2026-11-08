import type { DeepLinkTarget } from "./links"

export type ConversationTarget = Extract<DeepLinkTarget, { type: "chat" | "message" }>

export const isConversation = (target: DeepLinkTarget): target is ConversationTarget =>
  target.type === "chat" || target.type === "message"

/** What Rust reads a conversation by: the store's parts of the link, decoded. */
export type Place = { provider: string; account: string; chat: string; message: string | null }

export const placeOf = (target: ConversationTarget): Place => ({
  provider: target.provider,
  account: target.account,
  chat: target.chat,
  message: target.type === "message" ? target.message : null,
})

/** A page joined to the messages shown, oldest first, each message once. */
export function joined<M extends { ref: string }>(shown: M[], page: M[], older: boolean): M[] {
  const known = new Set(shown.map((m) => m.ref))
  const fresh = page.filter((m) => !known.has(m.ref))
  return older ? [...fresh, ...shown] : [...shown, ...fresh]
}

// "On Mon, 3 Nov 2026 at 10:00, Ana <ana@example.com> wrote:" in the languages the app speaks, and Outlook's rule.
const ATTRIBUTION = /^(on |el |в |\d{1,2}[./]).*(wrote|escribió|написал[а]?|пишет):\s*$/i
const OUTLOOK = /^-{2,}\s*(original message|mensaje original|исходное сообщение)\s*-{2,}$/i

/**
 * An email's own words and the earlier mail it quotes, which the page folds away: everything from the first quoted
 * line, or from the line that introduces it, to the end. A reply written between quoted lines folds with them.
 */
export function splitQuoted(text: string): { own: string; quoted: string | null } {
  const lines = text.split(/\r?\n/)
  let at = lines.findIndex((l) => l.trimStart().startsWith(">") || OUTLOOK.test(l.trim()))
  if (at < 0) return { own: text, quoted: null }
  const before = lines.slice(0, at)
  const intro = before.findLastIndex((l) => l.trim() !== "")
  if (intro >= 0 && ATTRIBUTION.test((before[intro] ?? "").trim())) at = intro
  const own = lines.slice(0, at).join("\n").trimEnd()
  const quoted = lines.slice(at).join("\n").trim()
  return quoted ? { own, quoted } : { own: text, quoted: null }
}
