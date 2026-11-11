import { useAccountTitle } from "./account-names-store"

/** The owner's name for an account, or its profile when it has none. */
export function AccountTitle({ tool, profile }: { tool: string; profile: string }) {
  return <>{useAccountTitle(tool, profile)}</>
}
