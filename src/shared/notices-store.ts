import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { LANGS, type Lang, type Messages } from "@/i18n"
import { safeStorage } from "@/shared/safe-storage"

export type PerLang = Record<Lang, string>

/**
 * A notice the app raises about itself, shown across the top of every page (`src/app/TopNotices.tsx`). The bell holds
 * what the WireCat server posts; this holds what this computer found.
 */
export type TopNotice = {
  /** The raiser's own slot: raising again with the same id replaces the notice. */
  id: string
  /** Changes when what the notice says changes; a dismissal holds only until then. */
  key: string
  tone: "warn" | "bad"
  text: PerLang
  link: { label: PerLang; url: PerLang } | null
}

type NoticesState = {
  notices: TopNotice[]
  /** The key each notice id was dismissed at. */
  dismissed: Record<string, string>
  raise(notice: TopNotice): void
  clear(id: string): void
  dismiss(notice: TopNotice): void
}

/** Text in every language from a messages catalog, so a notice follows a change of language. */
export const perLang = <T>(messages: Messages<T>, pick: (m: T, lang: Lang) => string): PerLang =>
  Object.fromEntries(LANGS.map((lang) => [lang, pick(messages[lang], lang)])) as PerLang

export const shownNotices = (s: Pick<NoticesState, "notices" | "dismissed">) =>
  s.notices.filter((n) => s.dismissed[n.id] !== n.key)

export const useNotices = create<NoticesState>()(
  persist(
    (set) => ({
      notices: [],
      dismissed: {},
      raise: (notice) => set((s) => ({ notices: [...s.notices.filter((n) => n.id !== notice.id), notice] })),
      clear: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
      dismiss: (notice) => set((s) => ({ dismissed: { ...s.dismissed, [notice.id]: notice.key } })),
    }),
    {
      name: "wirecat.notices",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ dismissed: s.dismissed }),
    },
  ),
)
