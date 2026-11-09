import { create } from "zustand"
import { currentLang } from "@/i18n"
import { platform } from "@/platform/bridge"
import type { ImportOutcome, RecordType } from "@/platform/records-schemas"
import { RECORDS_TOO_OLD } from "@/platform/records-schemas"

export type Format = "csv" | "json"
type Step = "template" | "pick" | "check" | "import"

type ImportState = {
  /** `undefined` while asking memo; `null` when the installed memo has no templates. */
  types: RecordType[] | null | undefined
  kind: string | null
  format: Format
  separator: "," | ";"
  /** The source the records come from, `<provider>:<account>`; never filled in for the owner. */
  account: string
  file: string | null
  busy: Step | null
  saved: string | null
  /** The last check of this file, type and source; an import needs one. */
  checked: ImportOutcome | null
  imported: ImportOutcome | null
  error: string | null
  load(): Promise<void>
  choose(patch: Partial<Pick<ImportState, "kind" | "format" | "separator" | "account">>): void
  saveTemplate(): Promise<void>
  pick(): Promise<void>
  check(): Promise<void>
  run(): Promise<void>
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
/** A JSON envelope names its types itself; only a sheet needs one chosen. */
const sheetType = (s: ImportState) => (s.file?.toLowerCase().endsWith(".csv") ? s.kind : null)

export const useImport = create<ImportState>((set, get) => {
  const step = async (busy: Step, work: () => Promise<Partial<ImportState>>) => {
    if (get().busy) return
    set({ busy, error: null })
    try {
      set(await work())
    } catch (e) {
      set({ error: message(e) })
    } finally {
      set({ busy: null })
    }
  }
  return {
    types: undefined,
    kind: null,
    format: "csv",
    // Excel in Russian or Spanish saves and opens CSV with semicolons.
    separator: currentLang() === "en" ? "," : ";",
    account: "",
    file: null,
    busy: null,
    saved: null,
    checked: null,
    imported: null,
    error: null,

    async load() {
      try {
        const types = await platform.recordTypes()
        set((s) => ({ types, kind: s.kind ?? types[0]?.type ?? null }))
      } catch (e) {
        if (message(e) === RECORDS_TOO_OLD) set({ types: null })
        else set({ types: [], error: message(e) })
      }
    },

    choose(patch) {
      const changesRun = "kind" in patch || "account" in patch
      set({ ...patch, saved: null, ...(changesRun ? { checked: null, imported: null } : {}) })
    },

    saveTemplate: () =>
      step("template", async () => {
        const { kind, format, separator, account } = get()
        if (!kind) return {}
        // memo picks the separator from the Excel language: , for en, ; for ru and es.
        const locale = separator === "," ? "en" : currentLang() === "es" ? "es" : "ru"
        return { saved: await platform.recordTemplateSave(kind, format, locale, account.trim() || undefined) }
      }),

    pick: () =>
      step("pick", async () => {
        const file = await platform.recordPickFile()
        return file ? { file, checked: null, imported: null } : {}
      }),

    check: () =>
      step("check", async () => ({
        checked: await platform.recordRun(sheetType(get()), get().account.trim(), true),
        imported: null,
      })),

    run: () =>
      step("import", async () => ({
        imported: await platform.recordRun(sheetType(get()), get().account.trim(), false),
        checked: null,
      })),
  }
})
