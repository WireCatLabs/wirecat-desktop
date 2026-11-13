import type { Messages } from "@/i18n"

const en = {
  title: "Calls",
  dealHelp: "Calls and recorded meetings of the people on it, newest first.",
  personHelp: "Their calls and recorded meetings, newest first.",
  loadingContacts: "Reading their messages and calls…",
  contactsFailed: "Could not read their messages and calls.",
  untitled: "Call",
  transcript: "Transcript",
  emptyTranscript: "The transcript has no lines.",
  reading: "Reading the call…",
  openIn: (tool: string) => `Open in ${tool} as:`,
  noProfiles: (tool: string) => `${tool} has no profile on this computer, so WireCat cannot open this call.`,
  noTool: (provider: string) => `WireCat has no tool for ${provider} calls yet, so it cannot open this one.`,
  failed: "WireCat could not open this call.",
  listFailed: "WireCat could not read the calls of the people on it.",
  unnamed: "Unknown",
  roles: { manager: "manager", client: "client", host: "host", attendee: "attendee" } as Record<string, string>,
}

const ru: typeof en = {
  title: "Звонки",
  dealHelp: "Звонки и записанные встречи людей из сделки, сначала новые.",
  personHelp: "Звонки и записанные встречи с этим человеком, сначала новые.",
  loadingContacts: "Читаем сообщения и звонки…",
  contactsFailed: "Не удалось прочитать сообщения и звонки.",
  untitled: "Звонок",
  transcript: "Расшифровка",
  emptyTranscript: "В расшифровке нет строк.",
  reading: "Читаю звонок…",
  openIn: (tool) => `Открыть в ${tool} от профиля:`,
  noProfiles: (tool) => `У ${tool} нет профиля на этом компьютере, поэтому WireCat не может открыть звонок.`,
  noTool: (provider) => `В WireCat пока нет инструмента для звонков ${provider}, поэтому этот звонок не открыть.`,
  failed: "WireCat не смог открыть этот звонок.",
  listFailed: "WireCat не смог прочитать звонки людей из сделки.",
  unnamed: "Неизвестно",
  roles: { manager: "менеджер", client: "клиент", host: "организатор", attendee: "участник" },
}

const es: typeof en = {
  title: "Llamadas",
  dealHelp: "Llamadas y reuniones grabadas de las personas de la negociación, primero las nuevas.",
  personHelp: "Sus llamadas y reuniones grabadas, primero las nuevas.",
  loadingContacts: "Leyendo sus mensajes y llamadas…",
  contactsFailed: "No se pudieron leer sus mensajes y llamadas.",
  untitled: "Llamada",
  transcript: "Transcripción",
  emptyTranscript: "La transcripción no tiene líneas.",
  reading: "Leyendo la llamada…",
  openIn: (tool) => `Abrir en ${tool} con el perfil:`,
  noProfiles: (tool) => `${tool} no tiene ningún perfil en este equipo, así que WireCat no puede abrir esta llamada.`,
  noTool: (provider) =>
    `WireCat aún no tiene una herramienta para las llamadas de ${provider}, así que no puede abrir esta.`,
  failed: "WireCat no pudo abrir esta llamada.",
  listFailed: "WireCat no pudo leer las llamadas de las personas de la negociación.",
  unnamed: "Desconocido",
  roles: { manager: "gestor", client: "cliente", host: "anfitrión", attendee: "asistente" },
}

export const callMessages: Messages<typeof en> = { en, ru, es }
