import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { safeStorage } from "@/shared/safe-storage"

const key = (tool: string, profile: string) => `${tool}:${profile}`

/** The longest name kept: a row still fits it beside the profile id. */
export const ACCOUNT_NAME_MAX = 60

type AccountNames = {
  /** The owner's own name for an account, by tool and profile. The tools never see it: commands keep the profile. */
  names: Record<string, string>
  /** An empty name, or the profile itself, goes back to showing the profile. */
  rename(tool: string, profile: string, name: string): void
  forget(tool: string, profile: string): void
}

export const useAccountNames = create<AccountNames>()(
  persist(
    (set) => ({
      names: {},
      rename: (tool, profile, name) =>
        set((s) => {
          const clean = name.trim().replace(/\s+/g, " ").slice(0, ACCOUNT_NAME_MAX)
          const { [key(tool, profile)]: _, ...rest } = s.names
          return { names: clean && clean !== profile ? { ...rest, [key(tool, profile)]: clean } : rest }
        }),
      forget: (tool, profile) =>
        set((s) => {
          const { [key(tool, profile)]: _, ...rest } = s.names
          return { names: rest }
        }),
    }),
    { name: "wirecat.account-names", storage: createJSONStorage(() => safeStorage) },
  ),
)

/** The owner's name for the account, or null when it has none: callers then show the profile. */
export const nameOf = (names: Record<string, string>, tool: string, profile: string): string | null =>
  names[key(tool, profile)] ?? null

/** What to call an account wherever it is listed: the owner's name, else the profile. */
export const accountTitle = (names: Record<string, string>, tool: string, profile: string) =>
  nameOf(names, tool, profile) ?? profile

export const useAccountTitle = (tool: string, profile: string) =>
  useAccountNames((s) => accountTitle(s.names, tool, profile))
