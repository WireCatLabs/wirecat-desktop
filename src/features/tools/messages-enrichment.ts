import { type Messages, plural } from "@/i18n"

const en = {
  title: "Rewrite records for better search",
  what: "A hosted model reads each note, document and email and writes short facts and questions about it in other words. Search then finds a record even when you ask in words the record does not use.",
  measured:
    "In our tests, a question in other words found its record among the first ten results 79 times in 100 instead of 62. A question in the record's own words put it first a little less often: 48 times in 100 instead of 54.",
  off: "Off. Nothing leaves this computer.",
  turnOn: "Turn on…",
  consentTitle: "What turning it on sends",
  counting: "Counting the records and the cost…",
  sends: (records: string) =>
    `The text of every note, document and email in Memo's storage, from every account: ${records} now, and each record added or changed later, at every sync.`,
  to: (provider: string, host: string, model: string) => `It goes to ${provider} (${host}), model ${model}.`,
  cost: (usd: string, input: string, output: string) =>
    `Rewriting what is here now costs about ${usd} (${input} input and ${output} output tokens).`,
  costUnknown: (input: string, output: string) =>
    `Memo knows no price for this model: ${input} input and ${output} output tokens.`,
  kept: "The model's facts and questions stay in Memo's storage. Turning it off deletes them.",
  key: (variable: string) =>
    `It needs your API key in the ${variable} variable where Memo runs. Without it nothing is sent, and the sync says why.`,
  agree: (records: string, provider: string) => `Send ${records} to ${provider} and turn on`,
  cancel: "Cancel",
  turningOn: "Turning on…",
  turnedOn: (provider: string) =>
    `Search rewriting is on. The next syncs send the records to ${provider}, and search then finds them by the model's words too.`,
  onSince: (when: string, provider: string, model: string, host: string) =>
    `On since ${when}: ${provider} ${model} (${host}).`,
  progress: (enriched: string, records: string) => `${enriched} of ${records} rewritten.`,
  waiting: (records: string, usd: string | null) =>
    `${records} wait: they are rewritten at the next syncs${usd ? `, for about ${usd}` : ""}.`,
  allDone: "Every record is rewritten. New and changed ones are rewritten at each sync.",
  turnOff: "Turn off…",
  offTitle: "Turn off and delete the model's text?",
  offWhat: (records: string) =>
    `Memo deletes the facts and questions the model wrote for ${records}. Search reads only the records' own words again. Turning it on later sends the records again and costs again.`,
  keepOn: "Keep it on",
  offConfirm: "Turn off and delete",
  turningOff: "Turning off…",
  turnedOff: (records: string) => `Off. Deleted the model's text for ${records}. Nothing more is sent.`,
  old: (version: string | null) =>
    `${version ? `Memo ${version}` : "This Memo"} cannot rewrite records yet. It comes with a Memo update.`,
  lessThanCent: "less than $0.01",
  records: (n: number) => plural("en", n, { one: "# record", other: "# records" }),
  readFailed: (message: string) => `Could not read the setting: ${message}`,
  previewFailed: (message: string) => `Could not count what would be sent: ${message}`,
  failedOn: (message: string) => `Could not turn it on: ${message}`,
  failedOff: (message: string) => `Could not turn it off: ${message}`,
  tryAgain: "Try again",
}

const ru: typeof en = {
  title: "Переписывать записи для лучшего поиска",
  what: "Облачная модель читает каждую заметку, документ и письмо и пишет о них короткие факты и вопросы другими словами. Тогда поиск находит запись, даже если вы спрашиваете словами, которых в ней нет.",
  measured:
    "В наших тестах вопрос другими словами находил свою запись в первой десятке 79 раз из 100 вместо 62. Вопрос словами самой записи ставил её первой чуть реже: 48 раз из 100 вместо 54.",
  off: "Выключено. Ничего не уходит с этого компьютера.",
  turnOn: "Включить…",
  consentTitle: "Что отправится, если включить",
  counting: "Считаю записи и стоимость…",
  sends: (records) =>
    `Текст каждой заметки, документа и письма в хранилище Memo, из всех аккаунтов: сейчас ${records}, а потом каждая новая или изменённая запись, при каждой синхронизации.`,
  to: (provider, host, model) => `Он уходит в ${provider} (${host}), модель ${model}.`,
  cost: (usd, input, output) =>
    `Переписать то, что есть сейчас, стоит около ${usd} (${input} входных и ${output} выходных токенов).`,
  costUnknown: (input, output) => `Memo не знает цену этой модели: ${input} входных и ${output} выходных токенов.`,
  kept: "Факты и вопросы модели хранятся в хранилище Memo. Если выключить, они удаляются.",
  key: (variable) =>
    `Нужен ваш API-ключ в переменной ${variable} там, где работает Memo. Без него ничего не отправляется, и синхронизация говорит почему.`,
  agree: (records, provider) => `Отправить ${records} в ${provider} и включить`,
  cancel: "Отмена",
  turningOn: "Включаю…",
  turnedOn: (provider) =>
    `Переписывание включено. Следующие синхронизации отправят записи в ${provider}, и поиск будет находить их и по словам модели.`,
  onSince: (when, provider, model, host) => `Включено с ${when}: ${provider} ${model} (${host}).`,
  progress: (enriched, records) => `Переписано ${enriched} из ${records}.`,
  waiting: (records, usd) =>
    `Ждут: ${records}. Они перепишутся при следующих синхронизациях${usd ? `, примерно за ${usd}` : ""}.`,
  allDone: "Все записи переписаны. Новые и изменённые переписываются при каждой синхронизации.",
  turnOff: "Выключить…",
  offTitle: "Выключить и удалить текст модели?",
  offWhat: (records) =>
    `Memo удалит факты и вопросы, которые модель написала для: ${records}. Поиск снова читает только слова самих записей. Если включить позже, записи отправятся снова и это снова будет стоить денег.`,
  keepOn: "Оставить включённым",
  offConfirm: "Выключить и удалить",
  turningOff: "Выключаю…",
  turnedOff: (records) => `Выключено. Текст модели удалён для: ${records}. Больше ничего не отправляется.`,
  old: (version) =>
    `${version ? `Memo ${version}` : "Эта версия Memo"} пока не умеет переписывать записи. Это придёт с обновлением Memo.`,
  lessThanCent: "меньше $0.01",
  records: (n) => plural("ru", n, { one: "# запись", few: "# записи", many: "# записей", other: "# записи" }),
  readFailed: (message) => `Не удалось прочитать настройку: ${message}`,
  previewFailed: (message) => `Не удалось посчитать, что отправится: ${message}`,
  failedOn: (message) => `Не удалось включить: ${message}`,
  failedOff: (message) => `Не удалось выключить: ${message}`,
  tryAgain: "Попробовать снова",
}

const es: typeof en = {
  title: "Reescribir registros para buscar mejor",
  what: "Un modelo en la nube lee cada nota, documento y correo y escribe hechos y preguntas breves sobre ellos con otras palabras. Así la búsqueda encuentra un registro aunque preguntes con palabras que el registro no usa.",
  measured:
    "En nuestras pruebas, una pregunta con otras palabras encontró su registro entre los diez primeros resultados 79 veces de 100 en lugar de 62. Una pregunta con las palabras del propio registro lo puso primero algo menos: 48 veces de 100 en lugar de 54.",
  off: "Desactivado. Nada sale de este ordenador.",
  turnOn: "Activar…",
  consentTitle: "Qué se envía al activarlo",
  counting: "Contando los registros y el coste…",
  sends: (records) =>
    `El texto de cada nota, documento y correo del almacenamiento de Memo, de todas las cuentas: ${records} ahora, y cada registro nuevo o cambiado después, en cada sincronización.`,
  to: (provider, host, model) => `Va a ${provider} (${host}), modelo ${model}.`,
  cost: (usd, input, output) =>
    `Reescribir lo que hay ahora cuesta unos ${usd} (${input} tokens de entrada y ${output} de salida).`,
  costUnknown: (input, output) =>
    `Memo no conoce el precio de este modelo: ${input} tokens de entrada y ${output} de salida.`,
  kept: "Los hechos y preguntas del modelo se guardan en el almacenamiento de Memo. Al desactivarlo se borran.",
  key: (variable) =>
    `Necesita tu clave de API en la variable ${variable} donde se ejecuta Memo. Sin ella no se envía nada y la sincronización dice por qué.`,
  agree: (records, provider) => `Enviar ${records} a ${provider} y activar`,
  cancel: "Cancelar",
  turningOn: "Activando…",
  turnedOn: (provider) =>
    `La reescritura está activada. Las próximas sincronizaciones envían los registros a ${provider}, y la búsqueda los encuentra también por las palabras del modelo.`,
  onSince: (when, provider, model, host) => `Activado desde ${when}: ${provider} ${model} (${host}).`,
  progress: (enriched, records) => `${enriched} de ${records} reescritos.`,
  waiting: (records, usd) =>
    `${records} en espera: se reescriben en las próximas sincronizaciones${usd ? `, por unos ${usd}` : ""}.`,
  allDone: "Todos los registros están reescritos. Los nuevos y cambiados se reescriben en cada sincronización.",
  turnOff: "Desactivar…",
  offTitle: "¿Desactivar y borrar el texto del modelo?",
  offWhat: (records) =>
    `Memo borra los hechos y preguntas que el modelo escribió para ${records}. La búsqueda vuelve a leer solo las palabras de los registros. Si lo activas más tarde, los registros se envían otra vez y vuelve a costar.`,
  keepOn: "Dejarlo activado",
  offConfirm: "Desactivar y borrar",
  turningOff: "Desactivando…",
  turnedOff: (records) => `Desactivado. Se borró el texto del modelo de ${records}. No se envía nada más.`,
  old: (version) =>
    `${version ? `Memo ${version}` : "Esta versión de Memo"} aún no puede reescribir registros. Llegará con una actualización de Memo.`,
  lessThanCent: "menos de 0,01 US$",
  records: (n) => plural("es", n, { one: "# registro", other: "# registros" }),
  readFailed: (message) => `No se pudo leer el ajuste: ${message}`,
  previewFailed: (message) => `No se pudo contar lo que se enviaría: ${message}`,
  failedOn: (message) => `No se pudo activar: ${message}`,
  failedOff: (message) => `No se pudo desactivar: ${message}`,
  tryAgain: "Reintentar",
}

export const enrichmentMessages: Messages<typeof en> = { en, ru, es }
export type EnrichmentText = typeof en
