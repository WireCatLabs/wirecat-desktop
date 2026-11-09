import { useEffect } from "react"
import { dayTitle, TITLE_EMOJI } from "@/domain/digest"
import { currentLang, messagesOf } from "@/i18n"
import { platform } from "@/platform/bridge"
import { safeStorage } from "@/shared/safe-storage"
import { digestMessages } from "./messages"
import { useDigests } from "./store"

/** memo writes a run when its timer fires; a minute late is soon enough for a morning digest. */
export const WATCH_EVERY_MS = 60_000
const SEEN_KEY = "wirecat.digests.seen"

/**
 * Says with a system notification that a digest run is newer than the last one WireCat announced, also one that
 * arrived while it was closed. The very first look only remembers the newest run, so a first start announces nothing.
 */
export async function checkForNew() {
  // The page may show another digest's days; the notice is the morning digest's.
  const shown = useDigests.getState()
  let days = null
  if (shown.name === undefined) {
    await shown.load()
    days = useDigests.getState().days
  } else {
    days = await platform.digestList().catch(() => null)
  }
  const newest = days?.[0]
  if (!newest) return
  const seen = safeStorage.getItem(SEEN_KEY)
  if (seen !== null && newest.stamp > seen) {
    const lang = currentLang()
    const m = messagesOf(digestMessages, lang)
    const title = `${TITLE_EMOJI} ${m.title(dayTitle(newest.date, lang))}`
    await platform.digestNotify(newest.date, title, newest.summary ?? m.notifyBody, m.open).catch(() => {})
  }
  if (seen === null || newest.stamp > seen) safeStorage.setItem(SEEN_KEY, newest.stamp)
}

export function useDigestWatch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    void checkForNew()
    const timer = setInterval(() => void checkForNew(), WATCH_EVERY_MS)
    return () => clearInterval(timer)
  }, [enabled])
}
