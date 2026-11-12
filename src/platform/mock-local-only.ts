import type { LocalOnly, LocalOnlyStatus } from "./ai-model-schemas"
import { delay } from "./mock-delay"
import { memoDefault } from "./mock-memo"
import type { Platform } from "./types"

// memo's `models local-only`, in the shape cli-core's `local-only-command.ts` prints (memo 0.131.85, plus the picture_reading row of a later cli-core): off at first,
// with the AI model on Ollama and search rewriting at OpenAI. `?local-only=on` on since this morning, so rewriting is
// refused; `?local-only=unreadable` on with a setting memo cannot read (no date); `?local-only=old` no memo with it
// released yet; `?local-only=owner` turning it off is refused because WireCat runs from an agent's terminal.
type Place = "this-computer" | "elsewhere" | "agent" | "off"
const SINCE = () => new Date(new Date().setHours(9, 12, 0, 0)).toISOString()

function status(on: boolean, since: string | null): LocalOnlyStatus {
  const one = (id: string, title: string, where: Place, address: string | null) => ({
    id,
    title,
    where,
    address,
    refused: on && where === "elsewhere",
  })
  const ai = "http://localhost:11434"
  return {
    on,
    since: on ? since : null,
    features: [
      one("ai_model", "AI model", "this-computer", ai),
      one("enrichment", "Rewrite records for better search", "elsewhere", "https://api.openai.com/v1"),
      one("search_harder", "Search harder", "off", null),
      one("search_by_meaning", "Search by meaning and picture search", "this-computer", null),
      one("chat_linking", "Chat linking (--analyze)", "this-computer", ai),
      one("replies", "Reply drafts", "this-computer", ai),
      one("attachment_ocr", "Picture text in attachments (--ocr)", "this-computer", ai),
      one("voice_messages", "Voice messages", on ? "this-computer" : "elsewhere", null),
      one("picture_reading", "Picture reading", "agent", null),
      one("digest", "Digest", "agent", null),
      one("agents", "Agents over MCP", "agent", null),
    ],
  }
}

export function localOnlyMock(params: URLSearchParams): Pick<Platform, "localOnlyStatus" | "localOnlySet"> {
  const scenario = params.get("local-only") ?? memoDefault({ old: "old" })
  let current = status(scenario === "on" || scenario === "unreadable", scenario === "on" ? SINCE() : null)
  return {
    async localOnlyStatus() {
      await delay(300)
      if (scenario === "old") return { state: "old", version: "0.131.84", need: null } satisfies LocalOnly
      return { state: "ready", status: current }
    },
    async localOnlySet(on) {
      await delay(500)
      if (!on && scenario === "owner") throw new Error("local-only.owner-only")
      current = status(on, on ? new Date().toISOString() : null)
      return current
    },
  }
}
