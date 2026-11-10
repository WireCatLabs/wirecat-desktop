import { join } from "node:path"
import { dayOf, runTool, writeIfChanged } from "../lib.mjs"

/**
 * Telegram, MAX and WhatsApp chats for Search and Analytics, loaded with each tool's `store import`. The file is made
 * here from day offsets, so a later load writes the same timestamps and changes nothing.
 */
export default function messengers(ctx) {
  const { tools } = ctx.data("messengers.json")
  const people = new Map(ctx.data("people.json").people.map((one) => [one.id, one]))
  const summary = []
  for (const [bin, { profile, account, chats }] of Object.entries(tools)) {
    const sender = (id) => {
      if (id === "me") return account
      const one = people.get(id)
      return { id: `${bin}-${id}`, name: one.name, username: null }
    }
    const file = {
      synthetic: true,
      account,
      people: [...new Set(chats.flatMap((chat) => chat.with))].map(sender),
      chats: chats.map(({ id, title, kind, with: who }) => ({
        id,
        title,
        kind,
        unreadCount: 0,
        participantsCount: who.length + 1,
      })),
      members: Object.fromEntries(chats.map((chat) => [chat.id, [account, ...chat.with.map(sender)]])),
      messages: chats.flatMap((chat) =>
        chat.messages.map(([daysAgo, time, from, text], n) => {
          const who = sender(from)
          return {
            id: `${chat.id}-${n + 1}`,
            chatId: chat.id,
            senderId: who.id,
            senderName: who.name,
            timestamp: dayOf(ctx.anchor, daysAgo, time).toISOString(),
            text,
          }
        }),
      ),
    }
    const path = join(ctx.home, ".cache", "sandbox-seed", `${bin}-${profile}.json`)
    writeIfChanged(path, `${JSON.stringify(file, null, 2)}\n`)
    const { item } = runTool(bin, [profile, "store", "import", path, "--yes"])
    summary.push(`${bin} ${item.added.messages} new of ${item.file.messages}`)
  }
  return summary.join(", ")
}
