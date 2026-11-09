import { type Messages, plural } from "@/i18n"

const en = {
  title: "Rewrite records for better search",
  what: "A hosted model reads each note, document and email and writes short facts and questions about it in other words. Search then finds a record even when you ask in words the record does not use.",
  measured: (rewordedOff: number, rewordedOn: number, ownOff: number, ownOn: number) =>
    `In memo's tests, a question in other words found its record among the first ten results ${rewordedOn} times in 100 instead of ${rewordedOff}. A question in the record's own words put it first a little less often: ${ownOn} times in 100 instead of ${ownOff}.`,
  off: "Off. Nothing leaves this computer.",
  offCost: (records: string, provider: string, usd: string) =>
    `Turning it on would send ${records} to ${provider}, for about ${usd}.`,
  turnOn: "Turn on…",
  consentTitle: "What turning it on sends",
  modelLabel: "Model",
  offer: (provider: string, model: string) => `${provider} ${model}`,
  offerPrice: (input: string, output: string) => `${input} in, ${output} out per million tokens`,
  memoDefault: "memo's default",
  counting: "Counting the records and the cost…",
  sends: (records: string) =>
    `The text of every note, document and email in Memo's storage, from every account: ${records} now, and each record added or changed later, at every sync.`,
  to: (provider: string, host: string, model: string) => `It goes to ${provider} (${host}), model ${model}.`,
  cost: (usd: string, input: string, output: string) =>
    `Rewriting what is here now costs about ${usd} (${input} input and ${output} output tokens).`,
  costUnknown: (input: string, output: string) =>
    `Memo knows no price for this model: ${input} input and ${output} output tokens.`,
  pace: (perSync: string, syncs: string) => `Memo rewrites up to ${perSync} per sync: ${syncs} for what is here.`,
  kept: "The model's facts and questions stay in Memo's storage. Turning it off deletes them.",
  keyMissing: (variable: string) =>
    `No API key found. Add it as ${variable} where Memo runs; until then nothing is sent, and each sync says so.`,
  keyMissingGeneric: "No API key found. Until you add one, nothing is sent, and each sync says so.",
  agree: (records: string, provider: string) => `Send ${records} to ${provider} and turn on`,
  cancel: "Cancel",
  turningOn: "Turning on…",
  turnedOn: (provider: string) =>
    `Search rewriting is on. The next syncs send the records to ${provider}, and search then finds them by the model's words too.`,
  onSince: (when: string, provider: string, model: string, host: string) =>
    `On since ${when}: ${provider} ${model} (${host}).`,
  progress: (enriched: string, records: string) => `${enriched} of ${records} rewritten.`,
  waiting: (records: string, syncs: number, usd: string | null) =>
    `${records} wait: they are rewritten ${syncs === 1 ? "at the next sync" : plural("en", syncs, { other: "over the next # syncs" })}${usd ? `, for about ${usd}` : ""}.`,
  allDone: "Every record is rewritten. New and changed ones are rewritten at each sync.",
  lastSyncDone: (sent: string, enriched: string, failed: number, cost: string | null) =>
    `Last sync: sent ${sent}, ${enriched} rewritten${failed > 0 ? `, ${failed} failed and wait for the next sync` : ""}${cost ? `, cost ${cost}` : ""}.`,
  lastSyncStopped: (reason: string) => `Last sync rewrote nothing: ${reason}`,
  lastSyncFailed: (reason: string) => `Last sync could not rewrite: ${reason}`,
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
  syncs: (n: number) => plural("en", n, { one: "# sync", other: "# syncs" }),
  reasons: {
    "enrichment.no-key": "there is no API key, so nothing was sent",
    "enrichment.key-rejected": "the provider refused the API key; save a new one",
    "enrichment.unreachable": "the provider could not be reached; the records wait for the next sync",
    "enrichment.rate-limited": "the provider asked to slow down; the rest goes at the next sync",
    "enrichment.bad-replies": "the model's replies could not be read; those records wait for the next sync",
    "enrichment.cancelled": "the sync was stopped",
    "enrichment.error": "something went wrong; the records wait for the next sync",
  } as Record<string, string>,
  readFailed: (message: string) => `Could not read the setting: ${message}`,
  previewFailed: (message: string) => `Could not count what would be sent: ${message}`,
  failedOn: (message: string) => `Could not turn it on: ${message}`,
  failedOff: (message: string) => `Could not turn it off: ${message}`,
  tryAgain: "Try again",
}

const ru: typeof en = {
  title: "Переписывать записи для лучшего поиска",
  what: "Облачная модель читает каждую заметку, документ и письмо и пишет о них короткие факты и вопросы другими словами. Тогда поиск находит запись, даже если вы спрашиваете словами, которых в ней нет.",
  measured: (rewordedOff, rewordedOn, ownOff, ownOn) =>
    `В тестах memo вопрос другими словами находил свою запись в первой десятке ${rewordedOn} раз из 100 вместо ${rewordedOff}. Вопрос словами самой записи ставил её первой чуть реже: ${ownOn} раз из 100 вместо ${ownOff}.`,
  off: "Выключено. Ничего не уходит с этого компьютера.",
  offCost: (records, provider, usd) => `Если включить, в ${provider} уйдёт ${records}, примерно за ${usd}.`,
  turnOn: "Включить…",
  consentTitle: "Что отправится, если включить",
  modelLabel: "Модель",
  offer: (provider, model) => `${provider} ${model}`,
  offerPrice: (input, output) => `${input} за вход, ${output} за выход на миллион токенов`,
  memoDefault: "по умолчанию в memo",
  counting: "Считаю записи и стоимость…",
  sends: (records) =>
    `Текст каждой заметки, документа и письма в хранилище Memo, из всех аккаунтов: сейчас ${records}, а потом каждая новая или изменённая запись, при каждой синхронизации.`,
  to: (provider, host, model) => `Он уходит в ${provider} (${host}), модель ${model}.`,
  cost: (usd, input, output) =>
    `Переписать то, что есть сейчас, стоит около ${usd} (${input} входных и ${output} выходных токенов).`,
  costUnknown: (input, output) => `Memo не знает цену этой модели: ${input} входных и ${output} выходных токенов.`,
  pace: (perSync, syncs) =>
    `За одну синхронизацию Memo переписывает до ${perSync}: для того, что есть сейчас, нужно ${syncs}.`,
  kept: "Факты и вопросы модели хранятся в хранилище Memo. Если выключить, они удаляются.",
  keyMissing: (variable) =>
    `API-ключ не найден. Добавьте его как ${variable} там, где работает Memo; до тех пор ничего не отправляется, и каждая синхронизация об этом скажет.`,
  keyMissingGeneric:
    "API-ключ не найден. Пока вы его не добавите, ничего не отправляется, и каждая синхронизация об этом скажет.",
  agree: (records, provider) => `Отправить ${records} в ${provider} и включить`,
  cancel: "Отмена",
  turningOn: "Включаю…",
  turnedOn: (provider) =>
    `Переписывание включено. Следующие синхронизации отправят записи в ${provider}, и поиск будет находить их и по словам модели.`,
  onSince: (when, provider, model, host) => `Включено с ${when}: ${provider} ${model} (${host}).`,
  progress: (enriched, records) => `Переписано ${enriched} из ${records}.`,
  waiting: (records, syncs, usd) =>
    `Ждут: ${records}. Они перепишутся ${syncs === 1 ? "при следующей синхронизации" : `за ${plural("ru", syncs, { one: "# синхронизацию", few: "# синхронизации", many: "# синхронизаций", other: "# синхронизации" })}`}${usd ? `, примерно за ${usd}` : ""}.`,
  allDone: "Все записи переписаны. Новые и изменённые переписываются при каждой синхронизации.",
  lastSyncDone: (sent, enriched, failed, cost) =>
    `Последняя синхронизация: отправлено ${sent}, переписано ${enriched}${failed > 0 ? `, не удалось ${failed}, они ждут следующей` : ""}${cost ? `, стоимость ${cost}` : ""}.`,
  lastSyncStopped: (reason) => `Последняя синхронизация ничего не переписала: ${reason}`,
  lastSyncFailed: (reason) => `Последняя синхронизация не смогла переписать: ${reason}`,
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
  syncs: (n) =>
    plural("ru", n, {
      one: "# синхронизацию",
      few: "# синхронизации",
      many: "# синхронизаций",
      other: "# синхронизации",
    }),
  reasons: {
    "enrichment.no-key": "нет API-ключа, поэтому ничего не отправлено",
    "enrichment.key-rejected": "провайдер отклонил API-ключ; сохраните новый",
    "enrichment.unreachable": "провайдер недоступен; записи ждут следующей синхронизации",
    "enrichment.rate-limited": "провайдер попросил притормозить; остальное уйдёт при следующей синхронизации",
    "enrichment.bad-replies": "ответы модели не удалось прочитать; эти записи ждут следующей синхронизации",
    "enrichment.cancelled": "синхронизацию остановили",
    "enrichment.error": "что-то пошло не так; записи ждут следующей синхронизации",
  },
  readFailed: (message) => `Не удалось прочитать настройку: ${message}`,
  previewFailed: (message) => `Не удалось посчитать, что отправится: ${message}`,
  failedOn: (message) => `Не удалось включить: ${message}`,
  failedOff: (message) => `Не удалось выключить: ${message}`,
  tryAgain: "Попробовать снова",
}

const es: typeof en = {
  title: "Reescribir registros para buscar mejor",
  what: "Un modelo en la nube lee cada nota, documento y correo y escribe hechos y preguntas breves sobre ellos con otras palabras. Así la búsqueda encuentra un registro aunque preguntes con palabras que el registro no usa.",
  measured: (rewordedOff, rewordedOn, ownOff, ownOn) =>
    `En las pruebas de memo, una pregunta con otras palabras encontró su registro entre los diez primeros resultados ${rewordedOn} veces de 100 en lugar de ${rewordedOff}. Una pregunta con las palabras del propio registro lo puso primero algo menos: ${ownOn} veces de 100 en lugar de ${ownOff}.`,
  off: "Desactivado. Nada sale de este ordenador.",
  offCost: (records, provider, usd) => `Al activarlo se enviarían ${records} a ${provider}, por unos ${usd}.`,
  turnOn: "Activar…",
  consentTitle: "Qué se envía al activarlo",
  modelLabel: "Modelo",
  offer: (provider, model) => `${provider} ${model}`,
  offerPrice: (input, output) => `${input} de entrada, ${output} de salida por millón de tokens`,
  memoDefault: "predeterminado de memo",
  counting: "Contando los registros y el coste…",
  sends: (records) =>
    `El texto de cada nota, documento y correo del almacenamiento de Memo, de todas las cuentas: ${records} ahora, y cada registro nuevo o cambiado después, en cada sincronización.`,
  to: (provider, host, model) => `Va a ${provider} (${host}), modelo ${model}.`,
  cost: (usd, input, output) =>
    `Reescribir lo que hay ahora cuesta unos ${usd} (${input} tokens de entrada y ${output} de salida).`,
  costUnknown: (input, output) =>
    `Memo no conoce el precio de este modelo: ${input} tokens de entrada y ${output} de salida.`,
  pace: (perSync, syncs) => `Memo reescribe hasta ${perSync} por sincronización: ${syncs} para lo que hay ahora.`,
  kept: "Los hechos y preguntas del modelo se guardan en el almacenamiento de Memo. Al desactivarlo se borran.",
  keyMissing: (variable) =>
    `No se encontró ninguna clave de API. Añádela como ${variable} donde se ejecuta Memo; hasta entonces no se envía nada y cada sincronización lo dice.`,
  keyMissingGeneric:
    "No se encontró ninguna clave de API. Hasta que añadas una, no se envía nada y cada sincronización lo dice.",
  agree: (records, provider) => `Enviar ${records} a ${provider} y activar`,
  cancel: "Cancelar",
  turningOn: "Activando…",
  turnedOn: (provider) =>
    `La reescritura está activada. Las próximas sincronizaciones envían los registros a ${provider}, y la búsqueda los encuentra también por las palabras del modelo.`,
  onSince: (when, provider, model, host) => `Activado desde ${when}: ${provider} ${model} (${host}).`,
  progress: (enriched, records) => `${enriched} de ${records} reescritos.`,
  waiting: (records, syncs, usd) =>
    `${records} en espera: se reescriben ${syncs === 1 ? "en la próxima sincronización" : `en ${plural("es", syncs, { other: "# sincronizaciones" })}`}${usd ? `, por unos ${usd}` : ""}.`,
  allDone: "Todos los registros están reescritos. Los nuevos y cambiados se reescriben en cada sincronización.",
  lastSyncDone: (sent, enriched, failed, cost) =>
    `Última sincronización: ${sent} enviados, ${enriched} reescritos${failed > 0 ? `, ${failed} fallaron y esperan a la siguiente` : ""}${cost ? `, coste ${cost}` : ""}.`,
  lastSyncStopped: (reason) => `La última sincronización no reescribió nada: ${reason}`,
  lastSyncFailed: (reason) => `La última sincronización no pudo reescribir: ${reason}`,
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
  syncs: (n) => plural("es", n, { one: "# sincronización", other: "# sincronizaciones" }),
  reasons: {
    "enrichment.no-key": "no hay clave de API, así que no se envió nada",
    "enrichment.key-rejected": "el proveedor rechazó la clave de API; guarda una nueva",
    "enrichment.unreachable":
      "no se pudo contactar con el proveedor; los registros esperan a la próxima sincronización",
    "enrichment.rate-limited": "el proveedor pidió ir más despacio; el resto va en la próxima sincronización",
    "enrichment.bad-replies":
      "no se pudieron leer las respuestas del modelo; esos registros esperan a la próxima sincronización",
    "enrichment.cancelled": "se detuvo la sincronización",
    "enrichment.error": "algo salió mal; los registros esperan a la próxima sincronización",
  },
  readFailed: (message) => `No se pudo leer el ajuste: ${message}`,
  previewFailed: (message) => `No se pudo contar lo que se enviaría: ${message}`,
  failedOn: (message) => `No se pudo activar: ${message}`,
  failedOff: (message) => `No se pudo desactivar: ${message}`,
  tryAgain: "Reintentar",
}

export const enrichmentMessages: Messages<typeof en> = { en, ru, es }
export type EnrichmentText = typeof en
