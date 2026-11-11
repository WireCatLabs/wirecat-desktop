import type { BotProfile, BotResult } from "./bot-schemas"
import { delay } from "./mock-delay"
import type { Platform } from "./types"

// Bots as each tool's `bot auth set --json` and `bot list --json` answer. `?bot-fail=<tool>` makes the messenger
// refuse the token, `?bot-fail=old` answers as a tool too old for bots, `?bot-fail=ids` as WhatsApp with a phone
// number id Meta does not know. Telegram starts with one bot, sales; `?bots=none` starts with none, `?bots=stale` adds
// a second whose token the messenger refuses, and `?bots=remove-fails` refuses the removal.

const query = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
const fails = query.get("bot-fail")

const REFUSED: Record<string, string> = {
  tg: "Telegram did not accept this bot token (Unauthorized)",
  max: "MAX refused getMyInfo (401 verify.token): Invalid access_token",
  wa: "Meta refused getPhoneNumber: Invalid OAuth access token - Cannot parse access token",
}

const IDENTITY: Record<string, { name: string; username: string | null }> = {
  tg: { name: "Sales helper", username: "sales_helper_bot" },
  max: { name: "Помощник продаж", username: "sales_helper_bot" },
  wa: { name: "Test Number", username: null },
}

const bots: Record<string, BotProfile[]> = {
  tg:
    query.get("bots") === "none"
      ? []
      : [
          { name: "sales", source: "keyring", bot: null, problem: null },
          ...(query.get("bots") === "stale" ? [{ name: "old", source: "keyring", bot: null, problem: null }] : []),
        ],
  max: [],
  wa: [],
}

export const botMock = (): Pick<Platform, "botSignIn" | "listBots" | "checkBots" | "removeBot"> => ({
  async botSignIn(id, profile, _token, _fields): Promise<BotResult> {
    await delay(1400)
    if (fails === "old")
      return {
        outcome: "failed",
        message: "This version cannot connect a bot from the app yet. Update it on the Tools page.",
        code: "needs_update",
        reason: null,
      }
    if (fails === "ids" && id === "wa")
      return {
        outcome: "failed",
        message:
          "Meta refused getPhoneNumber: Unsupported get request. Object with ID '100000000000001' does not exist",
        code: "not_found",
        reason: "not.found",
      }
    if (fails === id)
      return {
        outcome: "failed",
        message: REFUSED[id] ?? "refused",
        code: "authentication_error",
        reason: "auth.failed",
      }
    const list = bots[id] ?? []
    if (!list.some((b) => b.name === profile))
      bots[id] = [...list, { name: profile, source: "keyring", bot: null, problem: null }]
    return { outcome: "connected", ...(IDENTITY[id] ?? { name: null, username: null }) }
  },
  async listBots(id) {
    await delay(300)
    return bots[id] ?? []
  },
  async checkBots(id) {
    await delay(900)
    return (bots[id] ?? []).map((b) =>
      b.name === "old"
        ? { ...b, problem: "authentication_error" }
        : { ...b, bot: IDENTITY[id]?.username ?? IDENTITY[id]?.name ?? null },
    )
  },
  async removeBot(id, profile) {
    await delay(500)
    if (query.get("bots") === "remove-fails") throw new Error("could not reach the OS keyring: it may be locked")
    bots[id] = (bots[id] ?? []).filter((b) => b.name !== profile)
  },
})
