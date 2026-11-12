import type { Messages } from "@/i18n"
import { uiMessages } from "@/ui/messages"

const en = {
  title: "Search harder",
  what: "For one search at a time, a hosted model reads your question with the first results and puts the ones that answer it first. You choose when: the Search page offers it next to each memo search.",
  off: "Off. No search sends anything.",
  allow: "Allow",
  consentTitle: "What searching harder sends",
  providerLabel: "Provider",
  modelLabel: "Model",
  modelHelp: "Leave memo's choice, or name another model of this provider.",
  memoDefault: "memo's choice",
  addressLabel: "Address of another OpenAI-compatible service (optional)",
  addressHelp: "For example https://openrouter.ai/api/v1. Name the model that service serves.",
  checking: "Checking what would be sent…",
  proposed: "memo proposes the provider you chose for rewriting records. Allowing this is a separate choice.",
  sends: (candidates: number, chars: number) =>
    `Only when you press Search harder: your question and its first ${candidates} results, each with its date, title and up to ${chars} characters of its text.`,
  to: (provider: string, host: string, model: string) => `They go to ${provider} (${host}), model ${model}.`,
  price: (input: string, output: string) =>
    `${input} for each million tokens sent, ${output} for each million received. One search is a few thousand tokens.`,
  priceUnknown: "memo knows no price for this model. The service bills you for each search.",
  plain: "A search without it sends nothing. The model answers only with the order of the results.",
  keyMissing: (variable: string | null) =>
    `No API key found${variable ? ` (memo also reads ${variable})` : ""}. Until you add one, a search harder keeps the usual order and says why.`,
  agree: (provider: string) => `Allow search harder with ${provider}`,
  cancel: "Cancel",
  turningOn: "Allowing…",
  turnedOn: (provider: string) =>
    `Search harder is allowed. On the Search page, search memo and press Search harder: that one search goes to ${provider}.`,
  onSince: (when: string, provider: string, model: string, host: string) =>
    `Allowed since ${when}: ${provider} ${model} (${host}).`,
  change: "Change model",
  turnOff: "Turn off",
  turningOff: uiMessages.en.turningOff,
  turnedOff: "Off. No search sends anything.",
  oldNeed: (need: string) => `Search harder comes with memo ${need}. Update memo on the Tools page.`,
  oldNone: "Search harder comes with a memo update that is not released yet.",
  readFailed: "Could not read the setting.",
  previewFailed: "Could not check what would be sent.",
  failedOn: (message: string) => `Could not allow it: ${message}`,
  failedOff: (message: string) => `Could not turn it off: ${message}`,
  tryAgain: "Try again",
}

const ru: typeof en = {
  title: "Искать тщательнее",
  what: "Для одного поиска облачная модель читает ваш вопрос вместе с первыми результатами и ставит вперёд те, что на него отвечают. Когда это делать, решаете вы: страница «Поиск» предлагает это рядом с каждым поиском в memo.",
  off: "Выключено. Ни один поиск ничего не отправляет.",
  allow: "Разрешить",
  consentTitle: "Что отправляет тщательный поиск",
  providerLabel: "Сервис",
  modelLabel: "Модель",
  modelHelp: "Оставьте модель, которую выбрал memo, или впишите другую модель этого сервиса.",
  memoDefault: "выбор memo",
  addressLabel: "Адрес другого сервиса, совместимого с OpenAI (необязательно)",
  addressHelp: "Например https://openrouter.ai/api/v1. Впишите модель, которая есть у этого сервиса.",
  checking: "Проверяю, что будет отправлено…",
  proposed: "memo предлагает тот же сервис, что вы выбрали для переписывания записей. Это разрешение — отдельное.",
  sends: (candidates, chars) =>
    `Только когда вы нажимаете «Искать тщательнее»: ваш вопрос и первые ${candidates} результатов, у каждого дата, заголовок и до ${chars} символов текста.`,
  to: (provider, host, model) => `Они уходят в ${provider} (${host}), модель ${model}.`,
  price: (input, output) =>
    `${input} за каждый миллион отправленных токенов, ${output} за каждый миллион полученных. Один поиск — несколько тысяч токенов.`,
  priceUnknown: "memo не знает цену этой модели. Сервис берёт плату за каждый поиск.",
  plain: "Обычный поиск ничего не отправляет. Модель отвечает только порядком результатов.",
  keyMissing: (variable) =>
    `API-ключ не найден${variable ? ` (memo также читает ${variable})` : ""}. Пока вы его не добавите, тщательный поиск оставляет обычный порядок и говорит почему.`,
  agree: (provider) => `Разрешить тщательный поиск через ${provider}`,
  cancel: "Отмена",
  turningOn: "Разрешаю…",
  turnedOn: (provider) =>
    `Тщательный поиск разрешён. На странице «Поиск» найдите что-нибудь в memo и нажмите «Искать тщательнее»: этот один поиск уйдёт в ${provider}.`,
  onSince: (when, provider, model, host) => `Разрешено с ${when}: ${provider} ${model} (${host}).`,
  change: "Сменить модель",
  turnOff: "Выключить",
  turningOff: uiMessages.ru.turningOff,
  turnedOff: "Выключено. Ни один поиск ничего не отправляет.",
  oldNeed: (need) => `Тщательный поиск появится в memo ${need}. Обновите memo на странице «Инструменты».`,
  oldNone: "Тщательный поиск появится в обновлении memo, которое ещё не вышло.",
  readFailed: "Не удалось прочитать настройку.",
  previewFailed: "Не удалось проверить, что будет отправлено.",
  failedOn: (message) => `Не удалось разрешить: ${message}`,
  failedOff: (message) => `Не удалось выключить: ${message}`,
  tryAgain: "Повторить",
}

const es: typeof en = {
  title: "Buscar a fondo",
  what: "En una búsqueda cada vez, un modelo alojado lee tu pregunta con los primeros resultados y pone primero los que la responden. Tú decides cuándo: la página Buscar lo ofrece junto a cada búsqueda en memo.",
  off: "Desactivado. Ninguna búsqueda envía nada.",
  allow: "Permitir",
  consentTitle: "Qué envía buscar a fondo",
  providerLabel: "Proveedor",
  modelLabel: "Modelo",
  modelHelp: "Deja el modelo que elige memo o escribe otro modelo de este proveedor.",
  memoDefault: "elección de memo",
  addressLabel: "Dirección de otro servicio compatible con OpenAI (opcional)",
  addressHelp: "Por ejemplo https://openrouter.ai/api/v1. Escribe el modelo que ofrece ese servicio.",
  checking: "Comprobando lo que se enviaría…",
  proposed: "memo propone el proveedor que elegiste para reescribir registros. Permitir esto es una decisión aparte.",
  sends: (candidates, chars) =>
    `Solo cuando pulsas Buscar a fondo: tu pregunta y sus primeros ${candidates} resultados, cada uno con su fecha, título y hasta ${chars} caracteres de su texto.`,
  to: (provider, host, model) => `Van a ${provider} (${host}), modelo ${model}.`,
  price: (input, output) =>
    `${input} por cada millón de tokens enviados, ${output} por cada millón recibidos. Una búsqueda son unos pocos miles de tokens.`,
  priceUnknown: "memo no conoce el precio de este modelo. El servicio cobra cada búsqueda.",
  plain: "Una búsqueda normal no envía nada. El modelo solo responde con el orden de los resultados.",
  keyMissing: (variable) =>
    `No se encontró la clave de API${variable ? ` (memo también lee ${variable})` : ""}. Hasta que añadas una, buscar a fondo mantiene el orden habitual y dice por qué.`,
  agree: (provider) => `Permitir buscar a fondo con ${provider}`,
  cancel: "Cancelar",
  turningOn: "Permitiendo…",
  turnedOn: (provider) =>
    `Buscar a fondo está permitido. En la página Buscar, busca en memo y pulsa Buscar a fondo: esa búsqueda va a ${provider}.`,
  onSince: (when, provider, model, host) => `Permitido desde ${when}: ${provider} ${model} (${host}).`,
  change: "Cambiar modelo",
  turnOff: "Desactivar",
  turningOff: uiMessages.es.turningOff,
  turnedOff: "Desactivado. Ninguna búsqueda envía nada.",
  oldNeed: (need) => `Buscar a fondo llega con memo ${need}. Actualiza memo en la página Herramientas.`,
  oldNone: "Buscar a fondo llega con una actualización de memo que aún no ha salido.",
  readFailed: "No se pudo leer el ajuste.",
  previewFailed: "No se pudo comprobar lo que se enviaría.",
  failedOn: (message) => `No se pudo permitir: ${message}`,
  failedOff: (message) => `No se pudo desactivar: ${message}`,
  tryAgain: "Reintentar",
}

export const searchHarderMessages: Messages<typeof en> = { en, ru, es }
export type SearchHarderText = typeof en
