import type { Messages } from "@/i18n"

/** Each person of a match as the owner compares them: their last messages or calls, companies and deals. */
const en = {
  companies: (n: number): string => (n === 1 ? "Company" : "Companies"),
  deals: (n: number): string => (n === 1 ? "Deal" : "Deals"),
  lastTouches: "Last messages and calls",
  touchKinds: { call: "Call", meeting: "Meeting" } as Record<string, string>,
  fromMe: "You",
  noText: "No text",
}

const ru: typeof en = {
  companies: (n) => (n === 1 ? "Компания" : "Компании"),
  deals: (n) => (n === 1 ? "Сделка" : "Сделки"),
  lastTouches: "Последние сообщения и звонки",
  touchKinds: { call: "Звонок", meeting: "Встреча" },
  fromMe: "Вы",
  noText: "Без текста",
}

const es: typeof en = {
  companies: (n) => (n === 1 ? "Empresa" : "Empresas"),
  deals: (n) => (n === 1 ? "Trato" : "Tratos"),
  lastTouches: "Últimos mensajes y llamadas",
  touchKinds: { call: "Llamada", meeting: "Reunión" },
  fromMe: "Tú",
  noText: "Sin texto",
}

export const sideMessages: Messages<typeof en> = { en, ru, es }
