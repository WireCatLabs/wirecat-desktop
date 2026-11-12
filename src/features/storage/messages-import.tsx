import { type Messages, plural } from "@/i18n"

const ruForms = (n: number, [one, few, many]: [string, string, string]) =>
  plural("ru", n, { one, few, many, other: few })
const esForms = (n: number, [one, other]: [string, string]) => plural("es", n, { one, other })

const en = {
  title: "Import from a file",
  intro:
    "Records from a spreadsheet or another system: invoices, payments, organizations and the rest. Choose a type, " +
    "download its template, fill it in, then check the file before it goes in.",
  readingTypes: "Asking memo which records it takes",
  type: "Type",
  format: "Format",
  separator: "Separator",
  comma: "Comma",
  semicolon: "Semicolon (Excel in Russian or Spanish)",
  download: "Download template",
  saved: (path: string) => `Template saved to ${path}`,
  columns: "Columns",
  required: "required",
  oneOf: (values: string) => `one of: ${values}`,
  linksTo: (targets: string) => `links to ${targets}`,
  source: "Source",
  sourceExample: "sheet:rentals",
  sourceHelp:
    "Where the records come from, as provider:account, such as sheet:rentals. Importing the same source again " +
    "updates its records instead of adding copies.",
  sourceInvalid: "One word with a colon, such as sheet:rentals",
  nothingToImport: "The check found nothing to change in this file.",
  fileNeeded: "Choose the file to import first.",
  sourceNeeded: "Type the source first, as provider:account, such as sheet:rentals.",
  chooseFile: "Choose file",
  noFile: "No file chosen",
  check: "Check",
  import: "Import",
  checking: "Checking the file…",
  importing: "Importing…",
  checkFirst: "Check the file first. Nothing is written until you import.",
  checkedClean: "The check found nothing wrong. Import writes these records.",
  checkedRefused: (n: number) =>
    `${plural("en", n, { one: "# record is", other: "# records are" })} refused and will be skipped. Fix the file and ` +
    "check again, or import the rest.",
  failed: (why: string) => `memo could not read the file: ${why}`,
  done: "Imported.",
  wouldBe: "The check says",
  counts: {
    created: "new",
    updated: "updated",
    unchanged: "unchanged",
    deleted: "deleted",
    refused: "refused",
    waiting: "waiting for a link",
    unmatched: "matching several",
    flagged: "flagged",
  },
  where: (line: number, column?: string) => (column ? `line ${line}, ${column}` : `line ${line}`),
  problems: "Refused",
  waitingList: "Kept, waiting for what they link to",
  waitingFor: (missing: string) => `needs ${missing}`,
  proposed: (n: number) =>
    `${plural("en", n, { one: "# change waits", other: "# changes wait" })} for your review in Memory.`,
  truncated: "The list stops here; the counts cover the whole file.",
}

const ru: typeof en = {
  title: "Импорт из файла",
  intro:
    "Записи из таблицы или другой системы: счета, платежи, организации и остальное. Выберите тип, скачайте его " +
    "шаблон, заполните и проверьте файл, прежде чем загружать.",
  readingTypes: "Спрашиваю memo, какие записи он принимает",
  type: "Тип",
  format: "Формат",
  separator: "Разделитель",
  comma: "Запятая",
  semicolon: "Точка с запятой (Excel на русском или испанском)",
  download: "Скачать шаблон",
  saved: (path) => `Шаблон сохранён: ${path}`,
  columns: "Колонки",
  required: "обязательно",
  oneOf: (values) => `одно из: ${values}`,
  linksTo: (targets) => `ссылка на ${targets}`,
  source: "Источник",
  sourceExample: "sheet:rentals",
  sourceHelp:
    "Откуда записи, в виде провайдер:аккаунт, например sheet:rentals. Повторный импорт того же источника обновляет " +
    "его записи, а не добавляет копии.",
  sourceInvalid: "Одно слово с двоеточием, например sheet:rentals",
  nothingToImport: "Проверка не нашла в этом файле ничего, что нужно менять.",
  fileNeeded: "Сначала выберите файл для импорта.",
  sourceNeeded: "Сначала введите источник в виде провайдер:аккаунт, например sheet:rentals.",
  chooseFile: "Выбрать файл",
  noFile: "Файл не выбран",
  check: "Проверить",
  import: "Импортировать",
  checking: "Проверяю файл…",
  importing: "Импортирую…",
  checkFirst: "Сначала проверьте файл. До импорта ничего не записывается.",
  checkedClean: "Проверка ошибок не нашла. Импорт запишет эти записи.",
  checkedRefused: (n) =>
    `${ruForms(n, ["# запись не принята", "# записи не приняты", "# записей не принято"])} и будут пропущены. ` +
    "Исправьте файл и проверьте снова или импортируйте остальное.",
  failed: (why) => `memo не смог прочитать файл: ${why}`,
  done: "Импортировано.",
  wouldBe: "По проверке",
  counts: {
    created: "новых",
    updated: "обновлено",
    unchanged: "без изменений",
    deleted: "удалено",
    refused: "не принято",
    waiting: "ждут связи",
    unmatched: "совпали с несколькими",
    flagged: "отмечено",
  },
  where: (line, column) => (column ? `строка ${line}, ${column}` : `строка ${line}`),
  problems: "Не принято",
  waitingList: "Сохранены, ждут то, на что ссылаются",
  waitingFor: (missing) => `нужно: ${missing}`,
  proposed: (n) =>
    `${ruForms(n, ["# изменение ждёт", "# изменения ждут", "# изменений ждут"])} вашей проверки в разделе «Память».`,
  truncated: "Список обрезан; счётчики учитывают весь файл.",
}

const es: typeof en = {
  title: "Importar desde un archivo",
  intro:
    "Registros de una hoja de cálculo o de otro sistema: facturas, pagos, organizaciones y el resto. Elige un tipo, " +
    "descarga su plantilla, rellénala y comprueba el archivo antes de importarlo.",
  readingTypes: "Preguntando a memo qué registros acepta",
  type: "Tipo",
  format: "Formato",
  separator: "Separador",
  comma: "Coma",
  semicolon: "Punto y coma (Excel en ruso o español)",
  download: "Descargar plantilla",
  saved: (path) => `Plantilla guardada en ${path}`,
  columns: "Columnas",
  required: "obligatoria",
  oneOf: (values) => `una de: ${values}`,
  linksTo: (targets) => `enlaza con ${targets}`,
  source: "Origen",
  sourceExample: "sheet:rentals",
  sourceHelp:
    "De dónde vienen los registros, como proveedor:cuenta, por ejemplo sheet:rentals. Importar el mismo origen otra " +
    "vez actualiza sus registros en lugar de añadir copias.",
  sourceInvalid: "Una palabra con dos puntos, por ejemplo sheet:rentals",
  nothingToImport: "La comprobación no encontró nada que cambiar en este archivo.",
  fileNeeded: "Elige primero el archivo que importar.",
  sourceNeeded: "Escribe primero el origen como proveedor:cuenta, por ejemplo sheet:rentals.",
  chooseFile: "Elegir archivo",
  noFile: "Ningún archivo elegido",
  check: "Comprobar",
  import: "Importar",
  checking: "Comprobando el archivo…",
  importing: "Importando…",
  checkFirst: "Comprueba el archivo primero. No se escribe nada hasta que importes.",
  checkedClean: "La comprobación no encontró problemas. Importar escribe estos registros.",
  checkedRefused: (n) =>
    `${esForms(n, ["# registro rechazado", "# registros rechazados"])}; se omitirán. Corrige el archivo y ` +
    "compruébalo otra vez, o importa el resto.",
  failed: (why) => `memo no pudo leer el archivo: ${why}`,
  done: "Importado.",
  wouldBe: "La comprobación dice",
  counts: {
    created: "nuevos",
    updated: "actualizados",
    unchanged: "sin cambios",
    deleted: "borrados",
    refused: "rechazados",
    waiting: "esperan un enlace",
    unmatched: "coinciden con varios",
    flagged: "marcados",
  },
  where: (line, column) => (column ? `línea ${line}, ${column}` : `línea ${line}`),
  problems: "Rechazados",
  waitingList: "Guardados, esperan aquello a lo que enlazan",
  waitingFor: (missing) => `falta ${missing}`,
  proposed: (n) => `${esForms(n, ["# cambio espera", "# cambios esperan"])} tu revisión en Memoria.`,
  truncated: "La lista se corta aquí; los totales cubren todo el archivo.",
}

export const importMessages: Messages<typeof en> = { en, ru, es }
