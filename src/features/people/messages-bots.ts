import type { Messages } from "@/i18n"

/** A bot's dialog: memo's `bots show`. */
const en = {
  loading: "Reading the bot…",
  failed: "Couldn't read this bot.",
  accounts: "Addresses and accounts",
  accountsHelp: "Everything this program writes from. Its messages and mail stay where they are.",
  organization: "Sends for",
  noOrganization: "No organization yet",
  reach: "How it reaches you",
  reaches: {
    direct: "To you",
    group: "In a large group or list",
    broadcast: "To many readers: a newsletter or a channel",
  } as Record<string, string>,
  sortedBy: "Sorted by",
  sortedByOwner: "You",
  sortedByRules: "wcat's rules",
  why: "Why",
  sent: "Messages and mail from it",
  last: "Last message",
  moves: "Moves between a person and a bot",
  moved: (identity: string, from: string, to: string) => `${identity}: ${from} → ${to}`,
  nobody: "nobody",
}

const ru: typeof en = {
  loading: "Читаем бота…",
  failed: "Не удалось прочитать этого бота.",
  accounts: "Адреса и аккаунты",
  accountsHelp: "Всё, с чего пишет эта программа. Её сообщения и письма остаются на месте.",
  organization: "Пишет от имени",
  noOrganization: "Организации пока нет",
  reach: "Как доходит до вас",
  reaches: {
    direct: "Лично вам",
    group: "В большой группе или рассылке для обсуждений",
    broadcast: "Многим читателям: рассылка или канал",
  },
  sortedBy: "Кто отнёс к ботам",
  sortedByOwner: "Вы",
  sortedByRules: "Правила wcat",
  why: "Почему",
  sent: "Сообщений и писем от него",
  last: "Последнее сообщение",
  moves: "Переносы между человеком и ботом",
  moved: (identity: string, from: string, to: string) => `${identity}: ${from} → ${to}`,
  nobody: "никто",
}

const es: typeof en = {
  loading: "Leyendo el bot…",
  failed: "No se pudo leer este bot.",
  accounts: "Direcciones y cuentas",
  accountsHelp: "Todo desde donde escribe este programa. Sus mensajes y correos se quedan donde están.",
  organization: "Envía en nombre de",
  noOrganization: "Aún sin organización",
  reach: "Cómo te llega",
  reaches: {
    direct: "A ti",
    group: "En un grupo o una lista grande",
    broadcast: "A muchos lectores: un boletín o un canal",
  },
  sortedBy: "Clasificado por",
  sortedByOwner: "Tú",
  sortedByRules: "Las reglas de wcat",
  why: "Por qué",
  sent: "Mensajes y correos suyos",
  last: "Último mensaje",
  moves: "Cambios entre persona y bot",
  moved: (identity: string, from: string, to: string) => `${identity}: ${from} → ${to}`,
  nobody: "nadie",
}

export const botMessages: Messages<typeof en> = { en, ru, es }
