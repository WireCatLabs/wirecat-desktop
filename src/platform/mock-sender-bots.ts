import type { SenderBot } from "./bindings"
import { delay } from "./mock-delay"
import type { Listed } from "./people-schemas"
import type { Platform } from "./types"

// The Bots tab's stand-in for memo's `bots list` and `bots show` (cli-memo #899), with made-up senders only.
// `?sender-bots=old` is a memo without `bots list`: the tab lists people of kind automated, as before.
const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
export const senderBotsOpen = params.get("sender-bots") !== "old"

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

const seed: Omit<SenderBot, "moves">[] = [
  ["Harbour Shop", "email:noreply@shop.example", "organization:3", "broadcast", ["no-reply", "one-click-unsubscribe"]],
  ["Northstar Bank alerts", "email:alerts@bank.example", "organization:7", "direct", ["auto-submitted", "no-reply"]],
  ["Parcel tracker", "telegram:7001", null, "direct", []],
  ["Acme Weekly", "email:weekly@news.example", null, "broadcast", ["bulk-mail", "feedback-id"]],
  ["Sign-in codes", "email:security@accounts.example", null, "direct", ["auto-submitted"]],
  ["Ticket desk", "email:support@desk.example", "organization:3", "direct", ["no-reply"]],
  ["Weather bot", "max:4410", null, "direct", []],
  ["Market deals", "email:deals@market.example", null, "broadcast", ["bulk-mail", "one-click-unsubscribe"]],
].map(([name, identity, organization, reach, signals], n) => ({
  ref: `sender-bot:${n + 1}`,
  name: null,
  displayName: name as string,
  organization: organization as string | null,
  author: n === 2 ? "owner" : "rules",
  reason: n === 2 ? "a tracking bot" : (signals as string[]).join(", ") || "messenger bot",
  identities: [
    {
      identity: identity as string,
      name: name as string,
      username: (identity as string).startsWith("email:")
        ? null
        : `${(name as string).split(" ")[0]?.toLowerCase()}_bot`,
    },
  ],
  messagesFrom: 300 - n * 31,
  lastContact: ago(n * 9 + 1),
  reach: reach as string,
  signals: signals as string[],
}))

const crowd: Omit<SenderBot, "moves">[] = Array.from({ length: 64 }, (_, n) => ({
  ref: `sender-bot:${100 + n}`,
  name: null,
  displayName: `Service ${n + 1}`,
  organization: null,
  author: "rules",
  reason: "no-reply",
  identities: [{ identity: `email:noreply${n + 1}@service.example`, name: null, username: null }],
  messagesFrom: 40 - (n % 40),
  lastContact: ago(100 + n * 5),
  reach: "broadcast",
  signals: ["no-reply"],
}))

const bots = [...seed, ...crowd]

const row = (b: Omit<SenderBot, "moves">): Listed => {
  const first = b.identities[0]
  const email = first?.identity.startsWith("email:") ? first.identity.slice(6) : null
  return {
    ref: b.ref,
    name: b.name,
    owner: false,
    tasks: 0,
    displayName: b.displayName,
    kind: "bot",
    contact: email ?? first?.identity ?? null,
    phone: null,
    email,
    username: first?.username ?? null,
    usernameSource: first?.username ? (first.identity.split(":")[0] ?? null) : null,
    messagesFrom: b.messagesFrom,
    lastContact: b.lastContact,
    bot: true,
  }
}

/** The bots' count for the tabs, as `people_kinds` adds it; none from a memo without `bots list`. */
export const senderBotCounts = () => (senderBotsOpen ? [["bot", { value: bots.length, more: false }] as const] : [])

export function senderBotsMock(): Pick<Platform, "senderBotsPage" | "senderBotShow"> {
  return {
    async senderBotsPage({ page, size, query }) {
      await delay(400)
      const q = query.trim().toLowerCase()
      const found = bots.filter(
        (b) => !q || [b.displayName, ...b.identities.map((i) => i.identity)].some((t) => t?.toLowerCase().includes(q)),
      )
      return {
        people: found.slice((page - 1) * size, page * size).map(row),
        total: { value: found.length, more: false },
        more: page * size < found.length,
      }
    },
    async senderBotShow(ref) {
      await delay(300)
      const bot = bots.find((b) => b.ref === ref)
      if (!bot) throw new Error(`${ref} is not a bot`)
      const moved = bot.author === "owner"
      return {
        ...bot,
        moves: moved
          ? [
              {
                identity: bot.identities[0]?.identity ?? "",
                from: "person:44",
                to: bot.ref,
                author: "owner",
                reason: bot.reason,
                at: ago(30),
              },
            ]
          : [],
      }
    },
  }
}
