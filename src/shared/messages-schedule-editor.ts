import type { Messages } from "@/i18n"

const durationEn = (every: string) => {
  const n = Number.parseInt(every, 10)
  if (every.endsWith("m")) return `${n} min`
  if (every.endsWith("h")) return n === 1 ? "hour" : `${n} hours`
  return every
}

const en = {
  every: "How often",
  duration: durationEn,
  turnOn: "Turn on",
  save: "Save",
  turnOff: "Turn off",
  cancel: "Cancel",
  saving: "Saving…",
  failed: "Could not change the schedule.",
}

const durationRu = (every: string) => {
  const n = Number.parseInt(every, 10)
  if (every.endsWith("m")) return `${n} мин`
  if (every.endsWith("h")) return n === 1 ? "час" : `${n} ч`
  return every
}

const ru: typeof en = {
  every: "Как часто",
  duration: durationRu,
  turnOn: "Включить",
  save: "Сохранить",
  turnOff: "Выключить",
  cancel: "Отмена",
  saving: "Сохраняю…",
  failed: "Не удалось изменить расписание.",
}

const durationEs = (every: string) => {
  const n = Number.parseInt(every, 10)
  if (every.endsWith("m")) return `${n} min`
  if (every.endsWith("h")) return n === 1 ? "hora" : `${n} horas`
  return every
}

const es: typeof en = {
  every: "Con qué frecuencia",
  duration: durationEs,
  turnOn: "Activar",
  save: "Guardar",
  turnOff: "Desactivar",
  cancel: "Cancelar",
  saving: "Guardando…",
  failed: "No se pudo cambiar el horario.",
}

export const scheduleEditorMessages: Messages<typeof en> = { en, ru, es }
