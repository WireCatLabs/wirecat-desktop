import { create } from "zustand"
import { findTool, usesProfiles } from "@/domain/catalog"
import { platform } from "@/platform/bridge"
import type { Profile } from "@/platform/schemas"
import type { HarderAnswer, SearchAnswer } from "@/platform/search-schemas"
import { useTools } from "@/shared/tools-store"

export const LIMIT = 50

/** What the shown answer was asked for, so a query error is shown only while the query still reads the same. */
export type Asked = { tool: string; profile: string | null; query: string; page: number }

type SearchState = {
  tool: string | null
  /** Never chosen for the owner, even when the tool has one profile (rule 3). */
  profile: string | null
  /** undefined while reading them; null for a tool without profiles. */
  profiles: Profile[] | null | undefined
  profilesError: string | null
  query: string
  answer: SearchAnswer | null
  asked: Asked | null
  /** Set while the shown answer is a search harder's: whether the model's order replaced memo's, or why not. */
  harder: HarderAnswer["outcome"]
  /** A search is running; the last answer stays on screen meanwhile. */
  loading: boolean
  /** The call itself failed (the tool is missing, a bad argument), as opposed to an answer the tool gave. */
  error: string | null
  expanded: string | null
  /** A query field the shown hits are grouped by, on this page only; null shows them one by one. */
  groupBy: string | null
  setGroupBy(field: string | null): void
  /** Names of ids the owner picked from a refusal's choices, by `field:id`, so the query box can show the name. */
  named: Record<string, string>
  remember(field: string, id: string, label: string): void
  /** Tools that answered "too old" to search, by the version that said so; an update brings the tool back. */
  old: Record<string, string | null>
  chooseTool(id: string): void
  chooseProfile(name: string): void
  setQuery(query: string): void
  search(page?: number): Promise<void>
  /** The shown query once more, its first hits reordered by the model the owner allowed (memo only). */
  searchHarder(): Promise<void>
  toggle(key: string): void
  /** The tour's example results are on screen (onboarding/demo.ts): no search runs and no answer lands meanwhile. */
  demo: boolean
  /** The tour's example request, shown in "Describe what you're looking for" while `demo` holds. */
  demoAsk: string
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** What still stops a search, in the order the page asks for it; "profiles" when the tool has none to choose. */
export type Missing = "tool" | "profiles" | "profile" | "query"

export function missing(s: Pick<SearchState, "tool" | "profile" | "profiles" | "query">): Missing | null {
  if (s.tool === null) return "tool"
  if (s.profiles !== null && s.profile === null) return s.profiles?.length === 0 ? "profiles" : "profile"
  if (s.query.trim() === "") return "query"
  return null
}

export const useSearch = create<SearchState>((set, get) => {
  // Only the newest request's answer is shown; a slower earlier one is dropped.
  let seq = 0
  let profilesSeq = 0

  return {
    tool: null,
    profile: null,
    profiles: undefined,
    profilesError: null,
    query: "",
    answer: null,
    asked: null,
    harder: null,
    loading: false,
    error: null,
    expanded: null,
    groupBy: null,
    setGroupBy: (groupBy) => set({ groupBy }),
    old: {},
    named: {},
    remember: (field, id, label) => set((st) => ({ named: { ...st.named, [`${field}:${id}`]: label } })),
    chooseTool(id) {
      if (id === get().tool) return
      const t = findTool(id)
      const call = ++profilesSeq
      seq++
      set({
        tool: id,
        profile: null,
        profiles: t && usesProfiles(t) ? undefined : null,
        profilesError: null,
        answer: null,
        asked: null,
        harder: null,
        loading: false,
        error: null,
        expanded: null,
        groupBy: null,
      })
      if (!t || !usesProfiles(t)) return
      // An answer that comes while the tour's examples show is dropped; hideDemo asks again.
      const mine = () => call === profilesSeq && !get().demo
      platform.listProfiles(id).then(
        (profiles) => mine() && set({ profiles: profiles ?? [] }),
        (e) => mine() && set({ profiles: [], profilesError: message(e) }),
      )
    },
    chooseProfile(name) {
      if (name === get().profile) return
      seq++
      set({ profile: name, answer: null, asked: null, harder: null, loading: false, error: null, expanded: null })
    },
    setQuery: (query) => set({ query }),
    async search(page = 1) {
      const s = get()
      if (s.demo || missing(s) || s.tool === null) return
      const asked: Asked = { tool: s.tool, profile: s.profiles === null ? null : s.profile, query: s.query, page }
      const call = ++seq
      set({ loading: true, error: null })
      try {
        const answer = await platform.searchStore(asked.tool, asked.profile, asked.query, LIMIT, page)
        if (call !== seq || get().demo) return
        set({ answer, asked, harder: null, loading: false, expanded: null })
        if (answer.kind === "old") {
          const version = useTools.getState().installs[asked.tool]?.[0]?.version ?? null
          set((st) => ({ old: { ...st.old, [asked.tool]: version } }))
        }
      } catch (e) {
        if (call !== seq || get().demo) return
        set({ error: message(e), asked, answer: null, harder: null, loading: false })
      }
    },
    async searchHarder() {
      const s = get()
      if (s.demo || missing(s) || s.tool === null) return
      const asked: Asked = { tool: s.tool, profile: null, query: s.query, page: 1 }
      const call = ++seq
      set({ loading: true, error: null })
      try {
        const { answer, outcome } = await platform.searchHarderRun(asked.tool, asked.query, LIMIT)
        if (call !== seq || get().demo) return
        set({ answer, asked, harder: outcome, loading: false, expanded: null, groupBy: null })
      } catch (e) {
        if (call !== seq || get().demo) return
        set({ error: message(e), asked, answer: null, harder: null, loading: false })
      }
    },
    toggle: (key) => set((s) => ({ expanded: s.expanded === key ? null : key })),
    demo: false,
    demoAsk: "",
  }
})
