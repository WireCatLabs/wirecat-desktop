import { type Messages, plural } from "@/i18n"

/** Contacts' three tabs and the filters inside People (owner, 2026-11-25). */
const en = {
  tabsLabel: "Which contacts",
  bots: (n: number) => plural("en", n, { one: "# bot", other: "# bots" }),
  tabs: { people: "People", bots: "Bots", organizations: "Organizations" },
  peopleFilter: {
    person: "Known",
    stranger: "Not known",
    automated: "Look automated",
    unsorted: "Incomplete",
  } as Record<string, string>,
  botHelp: "Programs that write to you: no-reply and alert addresses, a shop's or a service's mail, messenger bots.",
  automatedPeopleHelp: "People wcat marks by a name or a bulk mailbox, not yet sorted as bots.",
}

const ru: typeof en = {
  tabsLabel: "Какие контакты",
  bots: (n: number) => plural("ru", n, { one: "# бот", few: "# бота", many: "# ботов", other: "# бота" }),
  tabs: { people: "Люди", bots: "Боты", organizations: "Организации" },
  peopleFilter: {
    person: "Знакомые",
    stranger: "Незнакомые",
    automated: "Похожи на ботов",
    unsorted: "Неполные",
  },
  botHelp:
    "Программы, которые вам пишут: адреса no-reply и уведомлений, письма магазинов и сервисов, боты в мессенджерах.",
  automatedPeopleHelp: "Люди, которых wcat отметил по имени или массовому адресу; в боты они ещё не перенесены.",
}

const es: typeof en = {
  tabsLabel: "Qué contactos",
  bots: (n: number) => plural("es", n, { one: "# bot", other: "# bots" }),
  tabs: { people: "Personas", bots: "Bots", organizations: "Organizaciones" },
  peopleFilter: {
    person: "Conocidos",
    stranger: "Desconocidos",
    automated: "Parecen bots",
    unsorted: "Incompletos",
  },
  botHelp:
    "Programas que te escriben: direcciones no-reply y de avisos, correo de tiendas y servicios, bots de mensajería.",
  automatedPeopleHelp: "Personas que wcat marca por un nombre o un buzón masivo, aún no pasadas a bots.",
}

export const tabMessages: Messages<typeof en> = { en, ru, es }
