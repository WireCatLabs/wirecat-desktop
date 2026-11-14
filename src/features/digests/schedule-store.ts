import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { BackgroundAgents } from "@/platform/background-agent-schemas"
import type { Backfill, DigestBook, DigestItem, DigestSpec, SendTo } from "@/platform/bindings"
import { platform } from "@/platform/bridge"
import { errorText } from "@/shared/errors"
import { useNav } from "@/shared/nav"
import { safeStorage } from "@/shared/safe-storage"
import { MORNING, useDigests } from "./store"

/** The Digests tab's section id: a tab of Tools, not a sidebar item. */
export const DIGESTS_SECTION = "digests"

export { MORNING }

/** The caps memo's digest skill was set up with: one run, then one day. */
export const DEFAULT_CAPS = { maxCostUsd: 0.5, maxCostPerDayUsd: 1 }
const DEFAULT_TIME = "08:30"

/**
 * The morning digest's settings as the page last read them. An older memo forgets them when it is taken off the
 * schedule (`schedule remove`), so putting it back on uses these.
 */
export type Remembered = { time: string; routes: string[]; maxCostUsd: number; maxCostPerDayUsd: number }

export type Busy = "save" | "schedule" | "run" | "remove"
export type Failed = { name: string; what: Busy | "create"; message: string }

type State = {
  book: DigestBook | null
  error: string | null
  /** What is under way, per digest; a run takes minutes and the other digests stay usable meanwhile. */
  busy: Record<string, Busy>
  failed: Failed | null
  remembered: Remembered | null
  /** The digest on screen; null is the table. */
  open: string | null
  /** Whether this memo has `digest backfill`; null until asked. */
  backfill: "yes" | "no" | null
  /** The table's search and page, kept while a digest is open so the way back finds them as they were. */
  query: string
  page: number
  pageSize: number
  setQuery(query: string): void
  setPage(page: number): void
  setPageSize(size: number): void
  load(): Promise<void>
  openDigest(name: string | null): void
  /** True once memo saved it. */
  save(spec: DigestSpec, create: boolean): Promise<boolean>
  run(name: string, to: SendTo): Promise<void>
  setScheduled(item: DigestItem, on: boolean): Promise<void>
  remove(name: string): Promise<boolean>
}

const rememberedOf = (book: DigestBook): Remembered | null => {
  if (book.state !== "ready" || book.named) return null
  const d = book.digests.find((x) => x.name === MORNING)
  const time = d?.times[0]
  if (!d?.scheduled || !time) return null
  return {
    time,
    routes: d.routes.map((r) => r.value),
    maxCostUsd: d.maxCostUsd ?? DEFAULT_CAPS.maxCostUsd,
    maxCostPerDayUsd: d.maxCostPerDayUsd ?? DEFAULT_CAPS.maxCostPerDayUsd,
  }
}

/**
 * The settings of a digest as the form edits them. An agent that runs only with the owner's consent, on a digest that
 * waits for nothing, already has it: memo keeps the consent while the agent stays.
 */
export function specOf(
  item: DigestItem,
  title: string,
  remembered: Remembered | null,
  agents: BackgroundAgents | null = null,
): DigestSpec {
  const old = item.times.length === 0 ? remembered : null
  return {
    name: item.name,
    title,
    times: item.times.length > 0 ? item.times : [old?.time ?? DEFAULT_TIME],
    weekdays: item.weekdays,
    sources: item.sources,
    routes: old ? old.routes : item.routes.map((r) => r.value),
    brief: item.brief,
    model: item.model,
    maxCostUsd: item.maxCostUsd ?? old?.maxCostUsd ?? DEFAULT_CAPS.maxCostUsd,
    maxCostPerDayUsd: item.maxCostPerDayUsd ?? old?.maxCostPerDayUsd ?? DEFAULT_CAPS.maxCostPerDayUsd,
    scheduled: item.scheduled,
    // memo keeps the digest's agent when it is named again; naming it lets Rust leave out the caps it refuses.
    agent: item.agent,
    allowDangerous: item.needs === null && (agents?.agents.some((a) => a.id === item.agent && a.needsAck) ?? false),
  }
}

/** The local day `days` before today, `2026-11-07`. */
function dayBefore(days: number, now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** The `n` days up to yesterday: today's digest is the schedule's to write. */
export const backfillRange = (n: number, now = new Date()) => ({ from: dayBefore(n, now), to: dayBefore(1, now) })

export const useDigestBook = create<State>()(
  persist(
    (set, get) => {
      const take = (book: DigestBook) =>
        set((s) => ({ book, error: null, remembered: rememberedOf(book) ?? s.remembered }))
      const change = async (
        name: string,
        what: Busy,
        call: () => Promise<DigestBook>,
        failedAs: Failed["what"] = what,
      ) => {
        set((s) => ({ busy: { ...s.busy, [name]: what }, failed: null }))
        try {
          take(await call())
          return true
        } catch (e) {
          set({ failed: { name, what: failedAs, message: errorText(e) } })
          return false
        } finally {
          set((s) => {
            const { [name]: _, ...rest } = s.busy
            return { busy: rest }
          })
        }
      }
      return {
        book: null,
        error: null,
        busy: {},
        failed: null,
        remembered: null,
        open: null,
        backfill: null,
        query: "",
        page: 1,
        pageSize: 50,
        setQuery: (query) => set({ query, page: 1 }),
        setPage: (page) => set({ page }),
        setPageSize: (pageSize) => set({ pageSize, page: 1 }),
        async load() {
          try {
            take(await platform.digestBook())
          } catch (e) {
            set({ error: errorText(e) })
          }
          if (get().backfill !== null) return
          // Pricing is free and builds nothing: it only tells whether this memo has the command.
          const { from, to } = backfillRange(7)
          platform.digestBackfill(from, to, false).then(
            (b: Backfill) => set({ backfill: b.state === "unsupported" ? "no" : "yes" }),
            () => set({ backfill: "yes" }),
          )
        },
        openDigest: (open) => {
          set({ open, failed: null })
          // A digest opens on the Digests tab, wherever it was made from.
          if (open !== null) useNav.getState().go(DIGESTS_SECTION)
        },
        save: (spec, create) =>
          change(spec.name, "save", () => platform.digestSave(spec, create), create ? "create" : "save"),
        async run(name, to) {
          await change(name, "run", () => platform.digestRun(name, to))
          if ((useDigests.getState().name ?? MORNING) === name) void useDigests.getState().load(name)
        },
        async setScheduled(item, on) {
          const book = get().book
          const named = book?.state === "ready" && book.named
          // An older memo forgot the settings when it was taken off; it is put back on with the ones remembered.
          const call =
            on && !named
              ? () =>
                  platform.digestSave(
                    { ...specOf(item, item.title ?? item.name, get().remembered), scheduled: true },
                    false,
                  )
              : () => platform.digestSetScheduled(item.name, on)
          await change(item.name, "schedule", call)
        },
        async remove(name) {
          const ok = await change(name, "remove", () => platform.digestRemove(name))
          if (ok && get().open === name) set({ open: null })
          return ok
        },
      }
    },
    {
      name: "wirecat.digest-schedule",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ remembered: s.remembered }),
    },
  ),
)
