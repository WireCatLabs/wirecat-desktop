import { useEffect } from "react"
import { dayTitle, TITLE_EMOJI } from "@/domain/digest"
import { useNotifications } from "@/features/notifications"
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
  // Read apart from the page, which may show another digest by the time the answer comes; the notice is the morning's.
  const days = await platform.digestList().catch(() => null)
  const newest = days?.[0]
  if (!newest) return
  const seen = safeStorage.getItem(SEEN_KEY)
  if (seen !== null && newest.stamp > seen) {
    const lang = currentLang()
    const m = messagesOf(digestMessages, lang)
    const title = `${TITLE_EMOJI} ${m.title(dayTitle(newest.date, lang))}`
    const body = newest.summary ?? m.notifyBody
    // The system's notice passes; the bell keeps it, and its Open reads the digest (owner, NEED-32 A).
    useNotifications.getState().addDigest({ date: newest.date, stamp: newest.stamp, title, body })
    await platform.digestNotify(newest.date, title, body, m.open).catch(() => {})
  }
  if (seen === null || newest.stamp > seen) {
    safeStorage.setItem(SEEN_KEY, newest.stamp)
    if (useDigests.getState().name === undefined) void useDigests.getState().load()
  }
}

export function useDigestWatch(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    void checkForNew()
    const timer = setInterval(() => void checkForNew(), WATCH_EVERY_MS)
    return () => clearInterval(timer)
  }, [enabled])
}
