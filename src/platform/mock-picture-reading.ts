import type { PictureRead, PictureReading, PictureReadingSetting } from "./ai-model-schemas"
import { delay } from "./mock-delay"
import { memoDefault } from "./mock-memo"
import type { Platform } from "./types"

// memo's `models picture-reading` and the messengers' `images read`, in the shapes cli-core #2881 prints: never at
// first, as a memo with it would answer although none is released yet. `?picture-reading=on` on request with Claude
// Code since this morning, `?picture-reading=old` no memo with it released yet, `?picture-reading=owner` turning it on
// is refused because WireCat runs from an agent's terminal. `?picture-read=done` is on and reads a picture at once,
// `?picture-read=missing` the chosen agent is not installed, `?picture-read=old` no messenger with `images read`
// released yet. The text read is made up.
const NEVER: PictureReadingSetting = { mode: "never", agent: null, model: null, extractor: null, since: null }
const SINCE = () => new Date(new Date().setHours(9, 12, 0, 0)).toISOString()
export const READ_TEXT = "PARKING FOR TENANTS ONLY\nMon - Fri 8:00 - 19:00\nVisitors: level -2, spaces 40 to 52"

const on = (agent: "claude" | "codex", model: string | null, since: string): PictureReadingSetting => ({
  mode: "request",
  agent,
  model,
  extractor: `agent:${agent}${model ? `/${model}` : ""}`,
  since,
})

export function pictureReadingMock(
  params: URLSearchParams,
): Pick<Platform, "pictureReadingStatus" | "pictureReadingSet" | "pictureRead" | "attachmentOpen"> {
  const scenario = params.get("picture-reading") ?? memoDefault({ old: "old" })
  const read = params.get("picture-read")
  let current = scenario === "on" || read === "done" ? on("claude", null, SINCE()) : NEVER
  return {
    async pictureReadingStatus() {
      await delay(300)
      if (scenario === "old") return { state: "old", version: "0.131.85", need: null } satisfies PictureReading
      return { state: "ready", setting: current }
    },
    async pictureReadingSet(mode, agent, model) {
      await delay(500)
      if (mode === "never") {
        current = NEVER
        return current
      }
      if (scenario === "owner") throw new Error("picture-reading.owner-only")
      if (!agent) throw new Error("picture-reading.agent-missing")
      current = on(agent, model?.trim() || null, new Date().toISOString())
      return current
    },
    async pictureRead() {
      await delay(read === "done" ? 0 : 900)
      if (read === "old") return { state: "old", tool: "tg", version: "0.211.0", need: null } satisfies PictureRead
      if (current.mode === "never") throw new Error("picture-reading.off")
      if (read === "missing") throw new Error(`picture-reading.unavailable:${current.agent ?? "claude"}`)
      return { state: "read", text: READ_TEXT, extractor: current.extractor, replaced: null }
    },
    async attachmentOpen() {
      await delay(150)
    },
  }
}
