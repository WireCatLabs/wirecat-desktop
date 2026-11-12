import { type Messages, plural } from "."

const en = {
  justNow: "just now",
  minutes: (n: number) => `${n} min ago`,
  hours: (n: number) => `${n} h ago`,
  yesterday: "yesterday",
  days: (n: number) => plural("en", n, { one: "# day ago", other: "# days ago" }),
}

export const agoMessages: Messages<typeof en> = {
  en,
  ru: {
    justNow: "только что",
    minutes: (n) => `${n} мин назад`,
    hours: (n) => `${n} ч назад`,
    yesterday: "вчера",
    days: (n) =>
      plural("ru", n, { one: "# день назад", few: "# дня назад", many: "# дней назад", other: "# дня назад" }),
  },
  es: {
    justNow: "ahora mismo",
    minutes: (n) => `hace ${n} min`,
    hours: (n) => `hace ${n} h`,
    yesterday: "ayer",
    days: (n) => plural("es", n, { one: "hace # día", other: "hace # días" }),
  },
}
