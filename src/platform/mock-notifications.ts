import { delay } from "./mock-delay"
import type { Notification } from "./notifications-schemas"
import type { Platform } from "./types"

// No parameter: the welcome notification that is live on api.wirecat.dev. `?notifications=none` has nothing,
// `security` adds a security fix and an update, `fail` cannot reach the server, `open` is `security` with the bell's
// panel open on load (`src/app/scenarios.ts`).
const mode = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("notifications")

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

const welcome: Notification = {
  id: "174325ab-a252-4651-ba6f-af0c6092dba4",
  severity: "info",
  title: {
    en: "News from WireCat now arrives here",
    ru: "Новости WireCat теперь приходят сюда",
    es: "Las novedades de WireCat llegan aquí",
  },
  body: {
    en: "When a fix matters for your safety, an update brings something you were waiting for, or something changes in how WireCat works, you will find it under this bell.\n\nWireCat checks for news when it starts and once an hour. It sends only its version and the name of your operating system, and remembers what you have read on this computer alone.",
    ru: "Если выйдет важное исправление безопасности, обновление с тем, чего вы ждали, или что-то изменится в работе WireCat, вы узнаете об этом здесь, под колокольчиком.\n\nWireCat проверяет новости при запуске и раз в час. Он отправляет только свою версию и название вашей системы, а прочитанное запоминает только на этом компьютере.",
    es: "Cuando haya una corrección importante para tu seguridad, una actualización con algo que esperabas o un cambio en cómo funciona WireCat, lo verás aquí, bajo la campana.\n\nWireCat busca novedades al iniciarse y una vez por hora. Solo envía su versión y el nombre de tu sistema operativo, y lo que has leído lo recuerda solo en este ordenador.",
  },
  link: {
    url: "https://wirecat.dev",
    label: { en: "Visit wirecat.dev", ru: "Открыть wirecat.dev", es: "Visitar wirecat.dev" },
  },
  publishedAt: hoursAgo(26),
  expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
}

const security: Notification = {
  id: "mock-security",
  severity: "security",
  title: {
    en: "Update Telegram to keep your sign-in private",
    ru: "Обновите Telegram, чтобы вход оставался закрытым",
    es: "Actualiza Telegram para que tu sesión siga siendo privada",
  },
  body: {
    en: "Versions before 0.89 could write part of your sign-in to the run log. Update Telegram on the Tools page; the update removes what was written.",
    ru: "Версии до 0.89 могли записать часть данных входа в журнал запусков. Обновите Telegram на странице «Инструменты» — обновление удалит то, что было записано.",
    es: "Las versiones anteriores a la 0.89 podían guardar parte de tu inicio de sesión en el registro. Actualiza Telegram en la página Herramientas; la actualización borra lo guardado.",
  },
  link: { url: "https://wirecat.dev/en/docs", label: { en: "What changed", ru: "Что изменилось", es: "Qué cambió" } },
  publishedAt: hoursAgo(2),
  expiresAt: null,
}

const update: Notification = {
  id: "mock-update",
  severity: "update",
  title: {
    en: "Search your messages from WireCat",
    ru: "Ищите по сообщениям прямо в WireCat",
    es: "Busca en tus mensajes desde WireCat",
  },
  body: {
    en: "The next version adds a Search page: one box for every chat you synced, on this computer.",
    ru: "В следующей версии появится страница «Поиск»: одно поле для всех чатов, которые вы синхронизировали, прямо на этом компьютере.",
    es: "La próxima versión añade una página de búsqueda: un solo campo para todos los chats que sincronizaste, en este ordenador.",
  },
  link: null,
  publishedAt: hoursAgo(9),
  expiresAt: null,
}

export const notificationsMock: Pick<Platform, "notifications"> = {
  async notifications() {
    await delay(300)
    if (mode === "fail") throw new Error("Could not reach the WireCat server: connection refused")
    if (mode === "none") return []
    if (mode === "security" || mode === "open") return [security, update, welcome]
    return [welcome]
  },
}
