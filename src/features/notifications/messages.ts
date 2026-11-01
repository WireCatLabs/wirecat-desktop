import type { Messages } from "@/i18n"
import type { Notification } from "@/platform/notifications-schemas"

type Severity = Notification["severity"]

const en = {
  bell: "Notifications",
  bellUnread: (n: number) => (n === 1 ? "Notifications, 1 unread" : `Notifications, ${n} unread`),
  bellSecurity: "Notifications, a security notice is unread",
  title: "Notifications",
  severity: { info: "News", update: "Update", security: "Security" } satisfies Record<Severity, string>,
  isNew: "New",
  dismiss: (title: string) => `Remove “${title}”`,
  empty: "Nothing new",
  emptyText: "WireCat posts security fixes, updates worth installing and news here.",
  offline: "Couldn’t check for news",
  offlineText: "WireCat tries again every hour, and when it starts.",
}

const ru: typeof en = {
  bell: "Уведомления",
  bellUnread: (n) => `Уведомления, непрочитанных: ${n}`,
  bellSecurity: "Уведомления, есть непрочитанное о безопасности",
  title: "Уведомления",
  severity: { info: "Новости", update: "Обновление", security: "Безопасность" },
  isNew: "Новое",
  dismiss: (title) => `Убрать «${title}»`,
  empty: "Ничего нового",
  emptyText: "Здесь WireCat сообщает об исправлениях безопасности, полезных обновлениях и новостях.",
  offline: "Не удалось проверить новости",
  offlineText: "WireCat попробует снова через час и при следующем запуске.",
}

const es: typeof en = {
  bell: "Avisos",
  bellUnread: (n) => (n === 1 ? "Avisos, 1 sin leer" : `Avisos, ${n} sin leer`),
  bellSecurity: "Avisos, hay uno de seguridad sin leer",
  title: "Avisos",
  severity: { info: "Novedades", update: "Actualización", security: "Seguridad" },
  isNew: "Nuevo",
  dismiss: (title) => `Quitar «${title}»`,
  empty: "Nada nuevo",
  emptyText: "Aquí WireCat publica correcciones de seguridad, actualizaciones que merecen la pena y novedades.",
  offline: "No se pudieron consultar los avisos",
  offlineText: "WireCat lo intentará de nuevo dentro de una hora y al iniciarse.",
}

export const notificationMessages: Messages<typeof en> = { en, ru, es }
