import { type Lang, type Messages, plural } from "@/i18n"

const date = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric" })

const en = {
  expiring: (days: number, until: string, lang: Lang) =>
    `The list of community tools runs out in ${plural(lang, days, { one: "# day", other: "# days" })}. ` +
    "WireCat refreshes it every day; if it does not, community tools cannot be installed or updated after " +
    `${date(until, lang)}.`,
  expired:
    "The list of community tools is out of date, so community tools cannot be installed or updated. " +
    "Installed ones keep working.",
  how: "How it works",
  row: "Cannot be installed or updated now: the list of community tools is out of date.",
}

const ru: typeof en = {
  expiring: (days, until, lang) =>
    `Список инструментов сообщества истекает через ${plural(lang, days, {
      one: "# день",
      few: "# дня",
      many: "# дней",
      other: "# дня",
    })}. ` +
    "WireCat обновляет его каждый день; если обновить не получится, после " +
    `${date(until, lang)} инструменты сообщества нельзя будет установить или обновить.`,
  expired:
    "Список инструментов сообщества устарел, поэтому инструменты сообщества нельзя установить или обновить. " +
    "Установленные продолжают работать.",
  how: "Как это работает",
  row: "Сейчас нельзя установить или обновить: список инструментов сообщества устарел.",
}

const es: typeof en = {
  expiring: (days, until, lang) =>
    `La lista de herramientas de la comunidad caduca en ${plural(lang, days, { one: "# día", other: "# días" })}. ` +
    "WireCat la renueva cada día; si no lo consigue, a partir del " +
    `${date(until, lang)} no se podrán instalar ni actualizar las herramientas de la comunidad.`,
  expired:
    "La lista de herramientas de la comunidad está desactualizada, así que no se pueden instalar ni actualizar " +
    "herramientas de la comunidad. Las instaladas siguen funcionando.",
  how: "Cómo funciona",
  row: "No se puede instalar ni actualizar ahora: la lista de herramientas de la comunidad está desactualizada.",
}

export const registryMessages: Messages<typeof en> = { en, ru, es }
