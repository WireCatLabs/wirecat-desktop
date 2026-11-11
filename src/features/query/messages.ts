import type { Messages } from "@/i18n"

const en = {
  clear: "Clear",
  clearSearch: "Clear the search",
  suggestions: "Suggestions",
  searchSyntax: "Search syntax",
  named: "Names in this search",
  editTerm: (term: string) => `Edit ${term}`,
  removeTerm: (term: string) => `Remove ${term}`,
  fields: { from: "from", chat: "chat" } as Record<string, string>,
}

const ru: typeof en = {
  clear: "Очистить",
  clearSearch: "Очистить поиск",
  suggestions: "Подсказки",
  searchSyntax: "Синтаксис поиска",
  named: "Имена в этом поиске",
  editTerm: (term) => `Изменить ${term}`,
  removeTerm: (term) => `Убрать ${term}`,
  fields: { from: "от", chat: "чат" },
}

const es: typeof en = {
  clear: "Borrar",
  clearSearch: "Borrar la búsqueda",
  suggestions: "Sugerencias",
  searchSyntax: "Sintaxis de búsqueda",
  named: "Nombres en esta búsqueda",
  editTerm: (term) => `Editar ${term}`,
  removeTerm: (term) => `Quitar ${term}`,
  fields: { from: "de", chat: "chat" },
}

export const queryMessages: Messages<typeof en> = { en, ru, es }
