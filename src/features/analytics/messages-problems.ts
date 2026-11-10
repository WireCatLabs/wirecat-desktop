import type { Messages } from "@/i18n"

const en = {
  missing: (tool: string) => `${tool} is not installed, so this part is empty.`,
  install: (tool: string) => `Install ${tool}`,
  installing: (tool: string) => `Installing ${tool}…`,
  old: (tool: string) => `This needs a newer ${tool}.`,
  update: (tool: string) => `Update ${tool}`,
  signedOut: (tool: string, profile: string) =>
    `${tool} profile “${profile}” was never signed in, so it has nothing to count.`,
  signIn: "Sign in",
  removeProfile: "Remove profile",
  empty: (tool: string, profile: string) => `${tool} (${profile}) has not loaded any messages yet.`,
  load: "Load now",
  loading: "Loading…",
  failed: (tool: string, profile: string | null) =>
    profile ? `${tool} (${profile}) did not answer.` : `${tool} did not answer.`,
  failedHint: "The other numbers are counted. Try again in a minute; if it keeps failing, report it.",
  tryAgain: "Try again",
  details: "Details",
  command: "Command",
}

const ru: typeof en = {
  missing: (tool) => `${tool} не установлен, поэтому здесь пусто.`,
  install: (tool) => `Установить ${tool}`,
  installing: (tool) => `Устанавливается ${tool}…`,
  old: (tool) => `Нужна более новая версия ${tool}.`,
  update: (tool) => `Обновить ${tool}`,
  signedOut: (tool, profile) => `В профиль ${tool} «${profile}» ни разу не входили, считать в нём нечего.`,
  signIn: "Войти",
  removeProfile: "Убрать профиль",
  empty: (tool, profile) => `${tool} (${profile}) ещё не загрузил ни одного сообщения.`,
  load: "Загрузить сейчас",
  loading: "Загружается…",
  failed: (tool, profile) => (profile ? `${tool} (${profile}) не ответил.` : `${tool} не ответил.`),
  failedHint: "Остальное посчитано. Попробуйте через минуту; если не пройдёт, сообщите об ошибке.",
  tryAgain: "Попробовать снова",
  details: "Подробнее",
  command: "Команда",
}

const es: typeof en = {
  missing: (tool) => `${tool} no está instalado, así que esta parte está vacía.`,
  install: (tool) => `Instalar ${tool}`,
  installing: (tool) => `Instalando ${tool}…`,
  old: (tool) => `Hace falta una versión más nueva de ${tool}.`,
  update: (tool) => `Actualizar ${tool}`,
  signedOut: (tool, profile) => `En el perfil «${profile}» de ${tool} nunca se inició sesión, no hay nada que contar.`,
  signIn: "Iniciar sesión",
  removeProfile: "Quitar perfil",
  empty: (tool, profile) => `${tool} (${profile}) todavía no ha cargado ningún mensaje.`,
  load: "Cargar ahora",
  loading: "Cargando…",
  failed: (tool, profile) => (profile ? `${tool} (${profile}) no respondió.` : `${tool} no respondió.`),
  failedHint: "Lo demás está contado. Prueba en un minuto; si sigue fallando, avísanos.",
  tryAgain: "Reintentar",
  details: "Detalles",
  command: "Comando",
}

export const problemMessages: Messages<typeof en> = { en, ru, es }
