import type { Messages } from "@/i18n"

const durationEn = (every: string) => {
  const n = Number.parseInt(every, 10)
  if (every.endsWith("m")) return `${n} min`
  if (every.endsWith("h")) return n === 1 ? "hour" : `${n} hours`
  return every
}

const en = {
  region: (account: string) => `Sync schedule of ${account}`,
  off: "Not on a schedule: it syncs only when you press Sync.",
  on: (every: string) => `Syncs on its own every ${every}`,
  onWhen: (when: string) => `Syncs on its own: ${when}`,
  lastOk: (ago: string) => `last run ${ago}, finished`,
  lastFailed: (ago: string, why: string | null) => `last run ${ago} failed${why ? ` (${why})` : ""}`,
  failingSince: (since: string, times: number | null) =>
    `Scheduled syncs fail since ${since}${times && times > 1 ? `, ${times} in a row` : ""}.`,
  noRunYet: "no run yet",
  setUp: "Sync on a schedule…",
  change: "Change…",
  every: "How often",
  duration: durationEn,
  turnOn: "Turn on",
  save: "Save",
  turnOff: "Turn off",
  cancel: "Cancel",
  saving: "Saving…",
  hint: (tool: string) =>
    `${tool} writes its own timer for this account. It runs while you are logged in, even when WireCat is closed.`,
  readFailed: "Could not read this account's schedule.",
  failed: (message: string) => `Could not change the schedule: ${message}`,
}

const durationRu = (every: string) => {
  const n = Number.parseInt(every, 10)
  if (every.endsWith("m")) return `${n} мин`
  if (every.endsWith("h")) return n === 1 ? "час" : `${n} ч`
  return every
}

const ru: typeof en = {
  region: (account) => `Расписание синхронизации ${account}`,
  off: "Не по расписанию: синхронизируется, только когда вы нажимаете «Синхронизировать».",
  on: (every) => `Синхронизируется сам каждые ${every}`,
  onWhen: (when) => `Синхронизируется сам: ${when}`,
  lastOk: (ago) => `последний запуск ${ago}, успешно`,
  lastFailed: (ago, why) => `последний запуск ${ago} не удался${why ? ` (${why})` : ""}`,
  failingSince: (since, times) =>
    `Синхронизация по расписанию не удаётся с ${since}${times && times > 1 ? `, ${times} раз подряд` : ""}.`,
  noRunYet: "запусков ещё не было",
  setUp: "Синхронизировать по расписанию…",
  change: "Изменить…",
  every: "Как часто",
  duration: durationRu,
  turnOn: "Включить",
  save: "Сохранить",
  turnOff: "Выключить",
  cancel: "Отмена",
  saving: "Сохраняю…",
  hint: (tool) =>
    `${tool} сам создаёт таймер для этого аккаунта. Он работает, пока вы вошли в систему, даже когда WireCat закрыт.`,
  readFailed: "Не удалось прочитать расписание этого аккаунта.",
  failed: (message) => `Не удалось изменить расписание: ${message}`,
}

const durationEs = (every: string) => {
  const n = Number.parseInt(every, 10)
  if (every.endsWith("m")) return `${n} min`
  if (every.endsWith("h")) return n === 1 ? "hora" : `${n} horas`
  return every
}

const es: typeof en = {
  region: (account) => `Horario de sincronización de ${account}`,
  off: "Sin horario: se sincroniza solo cuando pulsas Sincronizar.",
  on: (every) => `Se sincroniza solo cada ${every}`,
  onWhen: (when) => `Se sincroniza solo: ${when}`,
  lastOk: (ago) => `última ejecución ${ago}, terminó bien`,
  lastFailed: (ago, why) => `última ejecución ${ago} falló${why ? ` (${why})` : ""}`,
  failingSince: (since, times) =>
    `La sincronización programada falla desde ${since}${times && times > 1 ? `, ${times} veces seguidas` : ""}.`,
  noRunYet: "aún sin ejecuciones",
  setUp: "Sincronizar con horario…",
  change: "Cambiar…",
  every: "Con qué frecuencia",
  duration: durationEs,
  turnOn: "Activar",
  save: "Guardar",
  turnOff: "Desactivar",
  cancel: "Cancelar",
  saving: "Guardando…",
  hint: (tool) =>
    `${tool} crea su propio temporizador para esta cuenta. Funciona mientras tienes la sesión iniciada, aunque WireCat esté cerrado.`,
  readFailed: "No se pudo leer el horario de esta cuenta.",
  failed: (message) => `No se pudo cambiar el horario: ${message}`,
}

export type SyncScheduleText = typeof en
export const syncScheduleMessages: Messages<typeof en> = { en, ru, es }
