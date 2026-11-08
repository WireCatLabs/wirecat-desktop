import { tools } from "@/domain/catalog"
import type { DeepLinkTarget } from "@/domain/links"
import { taskQuery } from "@/domain/tasks"
import { useMemory } from "@/features/memory"
import { useTasks } from "@/features/tasks"
import { openToolAt } from "@/features/tools"
import { platform } from "@/platform/bridge"
import { useDigestDay } from "@/shared/digest-day"
import { useNav } from "@/shared/nav"
import { type Shown, useLinks } from "./store"

/** The hidden section a link opens when it has no page of its own; it is never saved as the page to reopen. */
export const LINK_SECTION = "open"

// Links name a messenger as the store does (`telegram`); the catalog knows it by its tool id (`tg`).
const TOOL_OF: Record<string, string> = { telegram: "tg", whatsapp: "wa", zoom: "zm", mail: "email", calendar: "gcal" }

const show = (shown: Shown) => {
  useLinks.setState({ shown })
  useNav.getState().go(LINK_SECTION)
}

/** memo review's ids as the Memory page names its rows: a bare number is an action there. */
export const memoryRefOf = (id: string): string | null =>
  /^\d{1,15}$/.test(id) ? `action:${id}` : /^(fact|memory):\d{1,15}$/.test(id) ? id : null

async function openTask(target: Extract<DeepLinkTarget, { type: "task" }>) {
  let key: string
  try {
    key = (await platform.taskShow(target.id)).key
  } catch {
    return show({ kind: "missing", target })
  }
  useNav.getState().go("tasks")
  void useTasks.getState().openTask(key)
}

async function openDigest(target: Extract<DeepLinkTarget, { type: "digest" }>) {
  const days = await platform.digestList().catch(() => [])
  if (!days.some((d) => d.date === target.date)) return show({ kind: "missing", target })
  useDigestDay.setState({ date: target.date })
  useNav.getState().go("digests")
}

async function openProposal(target: Extract<DeepLinkTarget, { type: "proposal" }>) {
  const ref = memoryRefOf(target.id)
  if (!ref) return show({ kind: "unsupported", target })
  const memory = useMemory.getState()
  if (!memory.read) await memory.load()
  if (!useMemory.getState().reveal(ref, ref)) return show({ kind: "missing", target })
  useNav.getState().go("memory")
}

/**
 * Takes the owner where a link points. It only ever opens a page: a proposal opens its row with Approve and Reject
 * beside it, and nothing is pressed for the owner. `null` is a link Rust refused.
 */
export async function openTarget(target: DeepLinkTarget | null) {
  if (target === null) return show({ kind: "refused" })
  switch (target.type) {
    case "task":
      return openTask(target)
    case "tasks":
      useNav.getState().go("tasks")
      useTasks.getState().setQuery(taskQuery(target))
      return
    case "proposal":
      return openProposal(target)
    case "digest":
      return openDigest(target)
    case "sync": {
      const id = TOOL_OF[target.tool] ?? target.tool
      if (!tools.some((t) => t.id === id)) return show({ kind: "unsupported", target })
      return openToolAt(id, "sync")
    }
    default:
      return show({ kind: "unsupported", target })
  }
}

/** A link from the system: held while the setup covers the window, opened at once otherwise. */
export function arrive(target: DeepLinkTarget | null, ready: boolean) {
  if (ready) void openTarget(target)
  else useLinks.setState({ waiting: { target } })
}

export function openWaiting() {
  const waiting = useLinks.getState().waiting
  if (!waiting) return
  useLinks.setState({ waiting: null })
  void openTarget(waiting.target)
}
