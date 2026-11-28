import { type Messages, plural, pluralRu } from "@/i18n"

const en = {
  show: (name: string) => `Show ${name}'s card`,
  loading: "Reading the company…",
  failed: "Could not read the company.",
  old: "This wcat cannot show a company's card yet. Update wcat on the Tools page.",
  people: "People",
  noPeople: "wcat knows nobody at this company yet.",
  morePeople: (n: number) => plural("en", n, { one: "and # more", other: "and # more" }),
  deals: "Open deals and leads",
  noDeals: "No open deal or lead.",
  moreDeals: (n: number) => plural("en", n, { one: "and # more", other: "and # more" }),
  calls: (n: number) =>
    plural("en", n, { one: "# call or meeting with its people", other: "# calls and meetings with its people" }),
  callsHelp: "Open a person to see their calls.",
  personCalls: "Their calls and recorded meetings, newest first.",
  noCalls: "No calls with this person.",
  lead: "Lead",
}

const ru: typeof en = {
  show: (name) => `Показать карточку ${name}`,
  loading: "Читаем компанию…",
  failed: "Не удалось прочитать компанию.",
  old: "Эта версия wcat ещё не показывает карточку компании. Обновите wcat на странице «Инструменты».",
  people: "Люди",
  noPeople: "wcat пока не знает никого из этой компании.",
  morePeople: (n) => `и ещё ${pluralRu(n, ["# человек", "# человека", "# человек"])}`,
  deals: "Открытые сделки и лиды",
  noDeals: "Открытых сделок и лидов нет.",
  moreDeals: (n) => `и ещё ${n}`,
  calls: (n) => `${pluralRu(n, ["# звонок или встреча", "# звонка и встречи", "# звонков и встреч"])} с её людьми`,
  callsHelp: "Откройте человека, чтобы увидеть его звонки.",
  personCalls: "Звонки и записанные встречи с этим человеком, сначала новые.",
  noCalls: "Звонков с этим человеком нет.",
  lead: "Лид",
}

const es: typeof en = {
  show: (name) => `Mostrar la ficha de ${name}`,
  loading: "Leyendo la empresa…",
  failed: "No se pudo leer la empresa.",
  old: "Esta versión de wcat aún no muestra la ficha de una empresa. Actualiza wcat en la página Herramientas.",
  people: "Personas",
  noPeople: "wcat aún no conoce a nadie de esta empresa.",
  morePeople: (n) => plural("es", n, { one: "y # más", other: "y # más" }),
  deals: "Negociaciones y prospectos abiertos",
  noDeals: "Ninguna negociación ni prospecto abierto.",
  moreDeals: (n) => plural("es", n, { one: "y # más", other: "y # más" }),
  calls: (n) =>
    plural("es", n, { one: "# llamada o reunión con su gente", other: "# llamadas y reuniones con su gente" }),
  callsHelp: "Abre una persona para ver sus llamadas.",
  personCalls: "Sus llamadas y reuniones grabadas, primero las nuevas.",
  noCalls: "No hay llamadas con esta persona.",
  lead: "Prospecto",
}

export const organizationMessages: Messages<typeof en> = { en, ru, es }
