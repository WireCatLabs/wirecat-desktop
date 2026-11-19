import { type Messages, pluralRu } from "@/i18n"

const en = {
  region: (account: string) => `Sync schedule of ${account}`,
  on: (every: string) => `Syncs on its own every ${every}`,
  onWhen: (when: string) => `Syncs on its own: ${when}`,
  daily: (time: string) => `Syncs on its own every day at ${time}`,
  lastOk: (ago: string) => `last run ${ago}, finished`,
  lastFailed: (ago: string, why: string | null) => `last run ${ago} failed${why ? ` (${why})` : ""}`,
  failingSince: (since: string, times: number | null) =>
    `Scheduled syncs fail since ${since}${times && times > 1 ? `, ${times} in a row` : ""}.`,
  noRunYet: "no run yet",
  setUp: "Sync on a schedule",
  change: "Change schedule",
  hint: (tool: string) =>
    `${tool} writes its own timer for this account. It runs while you are logged in, even when WireCat is closed.`,
  readFailed: "Could not read this account's schedule.",
}

const ru: typeof en = {
  region: (account) => `Расписание синхронизации ${account}`,
  on: (every) => `Синхронизируется сам каждые ${every}`,
  onWhen: (when) => `Синхронизируется сам: ${when}`,
  daily: (time) => `Синхронизируется сам каждый день в ${time}`,
  lastOk: (ago) => `последний запуск ${ago}, успешно`,
  lastFailed: (ago, why) => `последний запуск ${ago} не удался${why ? ` (${why})` : ""}`,
  failingSince: (since, times) =>
    `Синхронизация по расписанию не удаётся с ${since}${times && times > 1 ? `, ${pluralRu(times, ["# раз", "# раза", "# раз"])} подряд` : ""}.`,
  noRunYet: "запусков ещё не было",
  setUp: "Синхронизировать по расписанию",
  change: "Изменить расписание",
  hint: (tool) =>
    `${tool} сам создаёт таймер для этого аккаунта. Он работает, пока вы вошли в систему, даже когда WireCat закрыт.`,
  readFailed: "Не удалось прочитать расписание этого аккаунта.",
}

const es: typeof en = {
  region: (account) => `Horario de sincronización de ${account}`,
  on: (every) => `Se sincroniza solo cada ${every}`,
  onWhen: (when) => `Se sincroniza solo: ${when}`,
  daily: (time) => `Se sincroniza solo cada día a las ${time}`,
  lastOk: (ago) => `última ejecución ${ago}, terminó bien`,
  lastFailed: (ago, why) => `última ejecución ${ago} falló${why ? ` (${why})` : ""}`,
  failingSince: (since, times) =>
    `La sincronización programada falla desde ${since}${times && times > 1 ? `, ${times} veces seguidas` : ""}.`,
  noRunYet: "aún sin ejecuciones",
  setUp: "Sincronizar con horario",
  change: "Cambiar horario",
  hint: (tool) =>
    `${tool} crea su propio temporizador para esta cuenta. Funciona mientras tienes la sesión iniciada, aunque WireCat esté cerrado.`,
  readFailed: "No se pudo leer el horario de esta cuenta.",
}

export type SyncScheduleText = typeof en
export const syncScheduleMessages: Messages<typeof en> = { en, ru, es }
