import { type Messages, plural } from "@/i18n"

const ruCount = (n: number, one: string, few: string, many: string) =>
  plural("ru", n, { one: `# ${one}`, few: `# ${few}`, many: `# ${many}`, other: `# ${few}` })

const en = {
  items: (n: number) => plural("en", n, { one: "# item", other: "# items" }),
  filterBy: (term: string) => `Filter by ${term}`,
  exclude: (term: string) => `Exclude ${term}`,
  copyValue: "Copy value",
  copied: "Copied",
  reportThis: "Report this",
  reportThisTitle: "Open a report about this, filled in. You can read and change it before sending.",
  groupByField: (label: string) => `Group by ${label}`,
  demo: { label: "Example", text: "Rows for the tour, not your data. They go away when the tour ends." },
}

const ru: typeof en = {
  items: (n) => ruCount(n, "элемент", "элемента", "элементов"),
  filterBy: (term) => `Фильтровать по ${term}`,
  exclude: (term) => `Исключить ${term}`,
  copyValue: "Скопировать значение",
  copied: "Скопировано",
  reportThis: "Сообщить",
  reportThisTitle: "Открыть заполненный отчёт об этом. Перед отправкой его можно прочитать и изменить.",
  groupByField: (label) => `Группировать по полю «${label}»`,
  demo: { label: "Пример", text: "Строки для экскурсии, а не ваши данные. Они исчезнут, когда экскурсия закончится." },
}

const es: typeof en = {
  items: (n) => plural("es", n, { one: "# elemento", other: "# elementos" }),
  filterBy: (term) => `Filtrar por ${term}`,
  exclude: (term) => `Excluir ${term}`,
  copyValue: "Copiar el valor",
  copied: "Copiado",
  reportThis: "Informar",
  reportThisTitle: "Abrir un informe sobre esto ya rellenado. Puedes leerlo y cambiarlo antes de enviarlo.",
  groupByField: (label) => `Agrupar por ${label}`,
  demo: {
    label: "Ejemplo",
    text: "Filas para el recorrido, no son tus datos. Desaparecen cuando termina el recorrido.",
  },
}

export const sharedMessages: Messages<typeof en> = { en, ru, es }
