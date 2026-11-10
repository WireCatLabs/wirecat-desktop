import type { Kind } from "@/domain/clients"
import type { Messages } from "@/i18n"

const en = {
  view: "View",
  table: "Table",
  board: "Board",
  title: "Title",
  stage: "Stage",
  amount: "Amount",
  pipeline: "Pipeline",
  contact: "Contact",
  updated: "Updated",
  stageOf: (title: string) => `Stage of ${title}`,
  import: (crm: string) => `Import from ${crm}`,
  importAs: (crm: string, profile: string) => `Import from ${crm} · ${profile}`,
  importMenu: "Import from a CRM",
  importing: (crm: string) => `Importing from ${crm}…`,
  notImported: "Nothing is imported from a CRM yet.",
  emptyScope: "Only the deals of the CRM users you chose are imported, and the clients on them.",
  elsewhere: { deal: "Leads are under Leads.", lead: "Deals are under Deals." } as Record<Kind, string>,
  showOther: { deal: "Show leads", lead: "Show deals" } as Record<Kind, string>,
}

const ru: typeof en = {
  view: "Вид",
  table: "Таблица",
  board: "Доска",
  title: "Название",
  stage: "Этап",
  amount: "Сумма",
  pipeline: "Воронка",
  contact: "Контакт",
  updated: "Изменена",
  stageOf: (title) => `Этап: ${title}`,
  import: (crm) => `Импорт из ${crm}`,
  importAs: (crm, profile) => `Импорт из ${crm} · ${profile}`,
  importMenu: "Импорт из CRM",
  importing: (crm) => `Импорт из ${crm}…`,
  notImported: "Из CRM пока ничего не импортировано.",
  emptyScope: "Импортируются только сделки выбранных пользователей CRM и клиенты из них.",
  elsewhere: { deal: "Лиды — во вкладке «Лиды».", lead: "Сделки — во вкладке «Сделки»." },
  showOther: { deal: "Показать лиды", lead: "Показать сделки" },
}

const es: typeof en = {
  view: "Vista",
  table: "Tabla",
  board: "Tablero",
  title: "Título",
  stage: "Etapa",
  amount: "Importe",
  pipeline: "Embudo",
  contact: "Contacto",
  updated: "Cambiada",
  stageOf: (title) => `Etapa de ${title}`,
  import: (crm) => `Importar de ${crm}`,
  importAs: (crm, profile) => `Importar de ${crm} · ${profile}`,
  importMenu: "Importar de un CRM",
  importing: (crm) => `Importando de ${crm}…`,
  notImported: "Aún no se ha importado nada de un CRM.",
  emptyScope: "Solo se importan los tratos de los usuarios del CRM elegidos y sus clientes.",
  elsewhere: { deal: "Los prospectos están en Prospectos.", lead: "Las negociaciones están en Negociaciones." },
  showOther: { deal: "Ver prospectos", lead: "Ver negociaciones" },
}

export const tableMessages: Messages<typeof en> = { en, ru, es }
