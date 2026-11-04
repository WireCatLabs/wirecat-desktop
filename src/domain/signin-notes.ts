/**
 * cli-base's `Credentials` warns once when the system keyring cannot be used and the sign-in goes to a file instead:
 * "could not reach the OS keyring — it may be locked, or no keyring service is running (<error>); using <path>
 * instead, readable only by you". Rust has already put `~` in place of the home folder.
 */
export type KeyringFallback = { path: string; detail: string }

const KEYRING = /could not reach the OS keyring\b.*?(?:\((.*)\))?;\s*using\s+(\S(?:.*\S)?)\s+instead\b/s

/** Null for any other note, and for a keyring line whose shape changed: the window then shows the line as it came. */
export function keyringFallback(note: string): KeyringFallback | null {
  const found = KEYRING.exec(note)
  const path = found?.[2]
  if (!found || !path) return null
  return { path, detail: (found[1] ?? "").trim() }
}
