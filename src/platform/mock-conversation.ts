import type { ChatHeader, ChatMessage, Conversation } from "./bindings"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Every name, address and line here is made up, so screenshots of the browser build show no one's real messages.
const AROUND = 10
const PAGE = 30
const MINUTE = 60_000

type Thread = { header: ChatHeader; messages: ChatMessage[] }

const HOSTILE = [
  "<script>alert('stolen')</script> is what the attacker pasted.",
  '<img src="https://tracker.example/pixel.png" onerror="alert(1)"> no image loads here',
  "Click javascript:alert(document.cookie) for a prize, or file:///etc/passwd",
  "The agenda is at https://docs.example.com/agenda?week=45, see you there.",
]

const LINES = [
  "Did the lease draft come back?",
  "Not yet, they promised it by Friday.",
  "Then let's keep Monday free for the review.",
  "Works for me. I'll bring the floor plan.",
  "Can you also check the parking clause?",
  "Sure, I'll mark it in the copy.",
]

function chatMessages(account: string, chat: string, count: number, start: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => {
    const id = String(i + 1)
    const fromMe = i % 3 === 1
    const hostile = i >= count - HOSTILE.length ? HOSTILE[i - (count - HOSTILE.length)] : null
    return {
      ref: `msg:telegram/${account}/${chat}/${id}`,
      id,
      sender: fromMe ? "Owner Example" : i % 2 === 0 ? "Ana Sample" : "Kai Example",
      address: null,
      fromMe,
      at: new Date(start + i * 7 * MINUTE).toISOString(),
      subject: null,
      text: hostile ?? (i === 4 ? null : (LINES[i % LINES.length] ?? "")),
      files: i === 4 ? ["floor-plan.pdf"] : i === 9 ? ["lease draft v2.docx", "photo.jpg"] : [],
      anchor: false,
    }
  })
}

const EMAIL_TEXT = [
  "Hello Anna,\n\nThe warehouse lease is attached. The rent starts on 1 December.\n\nBest,\nOwner",
  "Thanks! Two questions about clause 4.\n\nOn Mon, 3 Nov 2026 at 10:00, Owner <owner@example.com> wrote:\n> Hello Anna,\n>\n> The warehouse lease is attached.\n> The rent starts on 1 December.",
  "Clause 4 covers the parking, see https://lease.example.com/clause-4 for the map.\n\nEl lun, 3 nov 2026 a las 12:30, Anna <anna@example.com> escribió:\n> Thanks! Two questions about clause 4.\n>> Hello Anna,",
  "<script>alert('mail')</script> Signed, see javascript:void(0)\n\n-----Original Message-----\nFrom: Owner\nThe parking map is attached.",
]

function emails(mailbox: string, thread: string, start: number): ChatMessage[] {
  const ids = [thread, "6006", "7007", "8008"]
  return ids.map((id, i) => {
    const fromMe = i % 2 === 0
    return {
      ref: `msg:email/${encodeURIComponent(mailbox)}/${thread}/${id}`,
      id,
      sender: fromMe ? "Owner Example" : "Anna Kotova",
      address: fromMe ? "owner@example.com" : "anna@example.com",
      fromMe,
      at: new Date(start + i * 95 * MINUTE).toISOString(),
      subject: i === 0 ? "Warehouse lease" : "Re: Warehouse lease",
      text: EMAIL_TEXT[i] ?? null,
      files: i === 0 ? ["lease-2026.pdf"] : [],
      anchor: false,
    }
  })
}

function threadOf(provider: string, account: string, chat: string, start: number): Thread | null {
  if (provider === "email")
    return {
      header: { title: "Warehouse lease", place: account, profile: null, email: true },
      messages: emails(account, chat, start),
    }
  if (!["telegram", "max", "whatsapp"].includes(provider)) return null
  const place = provider === "telegram" ? "Telegram" : provider === "max" ? "MAX" : "WhatsApp"
  const count = chat === "4004" ? 64 : 120
  return {
    header: { title: chat === "4004" ? "Book club" : "Lease team", place, profile: "personal", email: false },
    messages: chatMessages(account, chat, count, start),
  }
}

/**
 * Read only conversations for `pnpm dev`, as conversation.rs answers them: any Telegram, MAX or WhatsApp chat and any
 * mail thread, built from synthetic lines. Account `9` is not on this computer, chat or message `404` is not stored;
 * `?conversation=nomemo|old|failed|thread` shows the other states.
 */
export function conversationMock(params: URLSearchParams): Pick<Platform, "conversationRead"> {
  const mode = params.get("conversation")
  const start = Date.now() - 4 * 60 * MINUTE
  return {
    async conversationRead(place, ask) {
      await delay(ask.kind === "open" ? 450 : 350)
      if (mode === "nomemo") return { state: "noMemo" }
      if (mode === "old") return { state: "old", message: "unknown command 'show'" }
      if (mode === "failed") return { state: "failed", message: "memo stopped after 60 s" }
      if (place.account === "9") return { state: "missing", what: "account" }
      if (place.chat === "404" || place.message === "404") return { state: "missing", what: "stored" }
      if (mode === "thread" && place.provider === "email" && !place.message) return { state: "missing", what: "thread" }
      const thread = threadOf(place.provider, place.account, place.chat, start)
      if (!thread) return { state: "missing", what: "stored" }
      const all = thread.messages
      const index = (id: string) => all.findIndex((m) => m.id === id)
      const found = (from: number, to: number, header: ChatHeader | null, asked: string | null): Conversation => ({
        state: "found",
        chat: header,
        messages: all.slice(Math.max(0, from), to).map((m) => ({ ...m, anchor: m.id === asked })),
        older: from > 0,
        newer: to < all.length,
      })
      if (ask.kind === "older") {
        const at = index(ask.message)
        return at < 0 ? { state: "missing", what: "stored" } : found(at - PAGE, at, null, null)
      }
      if (ask.kind === "newer") {
        const at = index(ask.message)
        return at < 0 ? { state: "missing", what: "stored" } : found(at + 1, at + 1 + PAGE, null, null)
      }
      if (place.message) {
        const at = index(place.message)
        if (at < 0) return { state: "missing", what: "stored" }
        return found(at - AROUND, at + AROUND + 1, thread.header, place.message)
      }
      return thread.header.email
        ? found(0, PAGE, thread.header, null)
        : found(all.length - PAGE, all.length, thread.header, null)
    },
  }
}
