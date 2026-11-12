import { type Messages, plural } from "@/i18n"

/** memo's places, in the order the list explains them. */
export const PLACES = ["this-computer", "elsewhere", "agent", "off"] as const
export type Place = (typeof PLACES)[number]

/** memo's feature ids the page names in its own words; another id keeps memo's English title. */
export const FEATURES = [
  "ai_model",
  "enrichment",
  "search_harder",
  "search_by_meaning",
  "chat_linking",
  "replies",
  "attachment_ocr",
  "picture_reading",
  "voice_messages",
  "digest",
  "agents",
] as const
type Feature = (typeof FEATURES)[number]

const en = {
  heading: "Only this computer",
  intro:
    "When it is on, every WireCat tool sends text only to a model on this computer. A model on another computer is refused before anything is sent. An agent may turn it on, but only you can turn it off.",
  switchLabel: "Keep every model call on this computer",
  onSince: (when: string) => `On since ${when}.`,
  onNoDate: "On.",
  off: "Off. Each feature uses the model you chose for it.",
  listTitle: "Where each feature sends data now",
  places: {
    "this-computer": "This computer",
    elsewhere: "Another computer",
    agent: "Through your agent",
    off: "Off",
  } satisfies Record<Place, string>,
  placeUnknown: "Unknown",
  refused: "Refused",
  refusedNow: (n: number) =>
    plural("en", n, {
      one: "# feature now sends nothing until it uses a model on this computer.",
      other: "# features now send nothing until they use a model on this computer.",
    }),
  agentNote:
    "What runs through your agent (the digest, picture reading, agents over MCP) is outside WireCat. Its data stays here only if your agent runs a model on this computer.",
  features: {
    ai_model: "AI model",
    enrichment: "Rewrite records for better search",
    search_harder: "Search harder",
    search_by_meaning: "Search by meaning and by pictures",
    chat_linking: "Linking chats",
    replies: "Reply drafts",
    attachment_ocr: "Text in pictures in attachments",
    picture_reading: "Reading pictures",
    voice_messages: "Voice messages",
    digest: "Digest",
    agents: "Agents over MCP",
  } satisfies Record<Feature, string> as Record<string, string>,
  ownerOnly:
    "Only you can turn this off, and WireCat was started from an AI agent's terminal. Open WireCat from the app menu and turn it off there.",
  setFailed: "Could not change it.",
  readFailed: "Could not read where each feature sends data.",
  looking: "Looking at where each feature sends data…",
}

const ru: typeof en = {
  heading: "Только этот компьютер",
  intro:
    "Когда включено, каждый инструмент WireCat отправляет текст только модели на этом компьютере. Модель на другом компьютере получает отказ, и ничего не отправляется. Агент может включить это, а выключить можете только вы.",
  switchLabel: "Все обращения к моделям только на этом компьютере",
  onSince: (when) => `Включено с ${when}.`,
  onNoDate: "Включено.",
  off: "Выключено. Каждая функция работает с той моделью, которую вы для нее выбрали.",
  listTitle: "Куда каждая функция отправляет данные сейчас",
  places: {
    "this-computer": "Этот компьютер",
    elsewhere: "Другой компьютер",
    agent: "Через агента",
    off: "Выключено",
  },
  placeUnknown: "Неизвестно",
  refused: "Отказ",
  refusedNow: (n) =>
    plural("ru", n, {
      one: "# функция теперь ничего не отправляет, пока не перейдет на модель на этом компьютере.",
      few: "# функции теперь ничего не отправляют, пока не перейдут на модель на этом компьютере.",
      many: "# функций теперь ничего не отправляют, пока не перейдут на модель на этом компьютере.",
      other: "# функции теперь ничего не отправляют, пока не перейдут на модель на этом компьютере.",
    }),
  agentNote:
    "То, что идет через агента (сводка, чтение картинок, агенты через MCP), работает вне WireCat. Данные остаются здесь, только если ваш агент работает с моделью на этом компьютере.",
  features: {
    ai_model: "Модель ИИ",
    enrichment: "Переписывать записи для лучшего поиска",
    search_harder: "Искать тщательнее",
    search_by_meaning: "Поиск по смыслу и по картинкам",
    chat_linking: "Связывание чатов",
    replies: "Черновики ответов",
    attachment_ocr: "Текст на картинках во вложениях",
    picture_reading: "Чтение картинок",
    voice_messages: "Голосовые сообщения",
    digest: "Сводка",
    agents: "Агенты через MCP",
  },
  ownerOnly:
    "Выключить это можете только вы, а WireCat запущен из терминала ИИ-агента. Откройте WireCat из меню приложений и выключите там.",
  setFailed: "Не удалось переключить.",
  readFailed: "Не удалось прочитать, куда функции отправляют данные.",
  looking: "Смотрим, куда функции отправляют данные…",
}

const es: typeof en = {
  heading: "Solo este ordenador",
  intro:
    "Cuando está activado, cada herramienta de WireCat envía texto solo a un modelo en este ordenador. Un modelo en otro ordenador se rechaza antes de enviar nada. Un agente puede activarlo, pero solo tú puedes desactivarlo.",
  switchLabel: "Todas las llamadas a modelos en este ordenador",
  onSince: (when) => `Activado desde ${when}.`,
  onNoDate: "Activado.",
  off: "Desactivado. Cada función usa el modelo que elegiste para ella.",
  listTitle: "Adónde envía datos cada función ahora",
  places: {
    "this-computer": "Este ordenador",
    elsewhere: "Otro ordenador",
    agent: "A través de tu agente",
    off: "Desactivado",
  },
  placeUnknown: "Desconocido",
  refused: "Rechazado",
  refusedNow: (n) =>
    plural("es", n, {
      one: "# función ya no envía nada hasta que use un modelo en este ordenador.",
      other: "# funciones ya no envían nada hasta que usen un modelo en este ordenador.",
    }),
  agentNote:
    "Lo que va a través de tu agente (el resumen, leer imágenes, los agentes por MCP) funciona fuera de WireCat. Sus datos se quedan aquí solo si tu agente usa un modelo en este ordenador.",
  features: {
    ai_model: "Modelo de IA",
    enrichment: "Reescribir registros para buscar mejor",
    search_harder: "Buscar a fondo",
    search_by_meaning: "Búsqueda por significado y por imágenes",
    chat_linking: "Enlazar chats",
    replies: "Borradores de respuesta",
    attachment_ocr: "Texto de imágenes en adjuntos",
    picture_reading: "Leer imágenes",
    voice_messages: "Mensajes de voz",
    digest: "Resumen",
    agents: "Agentes por MCP",
  },
  ownerOnly:
    "Solo tú puedes desactivarlo, y WireCat se abrió desde la terminal de un agente de IA. Abre WireCat desde el menú de aplicaciones y desactívalo allí.",
  setFailed: "No se pudo cambiar.",
  readFailed: "No se pudo leer adónde envía datos cada función.",
  looking: "Mirando adónde envía datos cada función…",
}

export const localOnlyMessages: Messages<typeof en> = { en, ru, es }
