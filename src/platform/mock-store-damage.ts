import type { DamageReport } from "@/domain/store-damage"
import { delay } from "./mock-delay"
import type { Diagnosis } from "./schemas"

// `?store=damaged`: tg, max and wa find the store damaged and answer the report; `?store=damaged-old`: a tool older
// than the report, which answers none.
const mode = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("store")
let recovered = false

const report = (bin: string): DamageReport => ({
  what_happened: "the store file is damaged: 3 problems in the search data of email_words",
  likely_causes: [
    {
      cause:
        "the store's journal file (wirecat.db-wal) was deleted or replaced by another program while `mail sync` had the store open (2026-11-06T11:50:02.000Z)",
      check: "ls -li --time-style=full-iso ~/.local/share/WireCat/",
    },
    { cause: "the disk filled up while a tool was writing", check: "df -h ~/.local/share/WireCat" },
    {
      cause: "a fault of the disk itself",
      check: "journalctl -k --since -14d | grep -i -e 'I/O error' -e nvme -e ata",
    },
  ],
  impact: [
    "searches may miss results or fail; email_words hold nothing that is not elsewhere, and are rebuilt",
    "reads that do not touch a damaged page work; a write that touches one fails until the store is recovered",
  ],
  external_data_safe:
    "only this computer's copy is damaged: Telegram, MAX, WhatsApp, the mail servers and Google Drive keep their own data, so whatever is lost here can be fetched again by a sync",
  last_ok_at: "2026-11-01T08:00:00.000Z",
  loss: "how many rows were lost is unknown: damage can take rows written since the last deep check that passed (2026-11-01T08:00:00.000Z) without leaving a trace; a sync fetches again what the servers still hold",
  steps: [
    {
      command: "systemctl --user stop mail-sync.timer memo-import.timer",
      why: "a tool that writes while the store is recovered damages the new file too",
      destructive: false,
      runnable: true,
    },
    { command: "kill 4242", why: "wa (process 4242) has the store open", destructive: true, runnable: false },
    {
      command: `${bin} store recover run`,
      why: "copies every readable row into a new file and puts it in place of the store; the damaged file is kept beside it, and it prints the syncs that fetch again what was lost",
      destructive: true,
      runnable: false,
    },
    {
      command: `${bin} store recover`,
      why: "checks every page again; a check that passes lifts the damage mark",
      destructive: false,
      runnable: true,
    },
  ],
})

const STORE_TOOLS = ["tg", "max", "wa"]

const damagedNow = (id: string) => mode !== null && STORE_TOOLS.includes(id) && !recovered

/** Doctor's answer with what it adds when a run found the store damaged. */
export function withDoctorDamage(id: string, d: Diagnosis): Diagnosis {
  const item = (d.report as { item?: Record<string, unknown> } | null)?.item
  if (!damagedNow(id) || !item) return d
  const store = { ...(item.store as object), damage: { what_happened: report(id).what_happened } }
  return { ...d, exitCode: 1, report: { ...(d.report as object), item: { ...item, store } } }
}

export const storeDamageMock = {
  async storeRecover(id: string): Promise<DamageReport | null> {
    await delay(1200)
    return mode === "damaged" && damagedNow(id) ? report(id) : null
  },
  async storeRecoverStep(id: string, index: number): Promise<void> {
    await delay(900)
    if (report(id).steps[index]?.command === `${id} store recover`) recovered = true
  },
}
