import { join } from "node:path"
import { dayOf, runTool, writeIfChanged } from "../lib.mjs"

const mail = (args) => runTool("mail", args)

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const pad = (n) => String(n).padStart(2, "0")
const separatorDate = (d) =>
  `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ` +
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00 +0000 ${d.getUTCFullYear()}`

/**
 * Gmail's own ids are digits, and mail-cli dedupes a Takeout file by them: each comes from the thread's seed id, so a
 * message keeps its id when threads are added or reordered.
 */
const gmailId = (thread, n) => {
  let hash = 2166136261
  for (const c of thread) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0
  return `179${String(hash).padStart(13, "0")}${pad(n)}`
}

/** A Google Takeout mbox, the one file mail-cli reads into the store. */
export function mboxOf(ctx, { owner, threads }, people) {
  const who = (id) => (id === "owner" ? owner : people.get(id))
  const address = (p) => `${p.name} <${p.email}>`
  const lines = []
  for (const thread of threads) {
    const first = gmailId(thread.id, 0)
    const start = dayOf(ctx.anchor, thread.days_ago)
    const other = who(thread.messages.find((m) => m.from !== "owner").from)
    thread.messages.forEach((m, n) => {
      const at = new Date(start.getTime() + (m.hours_after ?? 0) * 3_600_000)
      const from = who(m.from)
      const outgoing = m.from === "owner"
      lines.push(
        `From ${gmailId(thread.id, n)}@xxx ${separatorDate(at)}`,
        `X-GM-THRID: ${first}`,
        `X-Gmail-Labels: ${outgoing ? "Sent" : "Inbox"}`,
        `From: ${address(from)}`,
        `To: ${address(outgoing ? other : owner)}`,
        `Subject: ${n === 0 ? "" : "Re: "}${thread.subject}`,
        `Date: ${at.toUTCString().replace("GMT", "+0000")}`,
        `Message-ID: <seed-${thread.id}-${n}@studio.example.org>`,
        ...(n > 0 ? [`In-Reply-To: <seed-${thread.id}-${n - 1}@studio.example.org>`] : []),
        "Content-Type: text/plain; charset=utf-8",
        "",
        ...m.body.split("\n").map((l) => (l.startsWith("From ") ? `>${l}` : l)),
        "",
      )
    })
  }
  return `${lines.join("\n")}\n`
}

export default function mailStep(ctx) {
  const data = ctx.data("mail.json")
  const { people, automated, companies } = ctx.data("people.json")
  const known = new Map([...people, ...automated, ...companies, ...data.senders].map((p) => [p.id, p]))
  // A Takeout file joins only a Gmail mailbox; Gmail's IMAP host makes a Workspace address on a made-up domain one.
  mail([data.profile, "config", "set", "address", data.owner.email])
  mail([data.profile, "config", "set", "imap_host", data.imap_host])
  const file = join(ctx.home, ".cache", "sandbox-seed", "mail.mbox")
  writeIfChanged(file, mboxOf(ctx, data, known))
  const r = mail([data.profile, "messages", "import", file]).item
  return `${r.saved} saved, ${r.already_stored} already stored (profile ${data.profile})`
}
