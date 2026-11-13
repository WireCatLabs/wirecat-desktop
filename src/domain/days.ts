import type { Lang } from "@/i18n"

/** A local calendar day, `YYYY-MM-DD`; never through UTC, which moves an evening to the next day. */
export const dayOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
export const parse = (day: string) => {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}
export const shift = (day: string, days: number) => {
  const d = parse(day)
  d.setDate(d.getDate() + days)
  return dayOf(d)
}
/** The same day of another month, or that month's last day when it is shorter (31 Jan → 28 Feb). */
export const shiftMonth = (day: string, months: number) => {
  const d = parse(day)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), last))
  return dayOf(target)
}

/** English calendars start on Sunday; Russian and Spanish ones on Monday. */
export const weekStart = (lang: Lang) => (lang === "en" ? 0 : 1)
