import { currentLang, type Lang } from "."
import { agoMessages } from "./messages"

/**
 * "just now", "4 min ago", "3 h ago", "2 days ago". A caller outside React must read `useLang()` itself, or a language
 * switch does not reach the text.
 */
export function ago(at: string | number, now = Date.now(), lang: Lang = currentLang()): string {
  const m = agoMessages[lang]
  const seconds = Math.max(0, Math.round((now - new Date(at).getTime()) / 1000))
  if (seconds < 60) return m.justNow
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return m.minutes(minutes)
  const hours = Math.round(minutes / 60)
  if (hours < 24) return m.hours(hours)
  const days = Math.round(hours / 24)
  return days === 1 ? m.yesterday : m.days(days)
}
