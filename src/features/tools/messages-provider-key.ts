import type { Messages } from "@/i18n"

// The provider key memo keeps for its hosted models: enrichment and search harder read the same one.
const en = {
  keyFound: (source: string) => `Memo found your API key (${source}).`,
  keySource: {
    keyring: "in the system keyring",
    file: "in Memo's key file",
    env: "in an environment variable",
  } as Record<string, string>,
  keyLabel: (provider: string) => `API key for ${provider}`,
  keySave: "Save key",
  keyShow: "Show the key",
  keyHide: "Hide the key",
  keySaving: "Saving…",
  keyWhere:
    "Memo keeps it in the system keyring, or in a private file when no keyring answers. This app never stores or shows it.",
  keyRemove: "Remove key",
  keyRemoving: "Removing…",
  keyEnvStays: (variable: string) => `This key comes from ${variable}; remove it there to stop using it.`,
  keySaveFailed: (message: string) => `Could not save the key: ${message}`,
  keyRemoveFailed: (message: string) => `Could not remove the key: ${message}`,
  keyRemoved: "Key removed. Nothing is sent until you add one again.",
}

const ru: typeof en = {
  keyFound: (source) => `Memo нашёл ваш API-ключ (${source}).`,
  keySource: { keyring: "в системной связке ключей", file: "в файле ключей Memo", env: "в переменной окружения" },
  keyLabel: (provider) => `API-ключ для ${provider}`,
  keySave: "Сохранить ключ",
  keyShow: "Показать ключ",
  keyHide: "Скрыть ключ",
  keySaving: "Сохраняю…",
  keyWhere:
    "Memo хранит его в системной связке ключей или, если она не отвечает, в закрытом файле. Это приложение его не хранит и не показывает.",
  keyRemove: "Удалить ключ",
  keyRemoving: "Удаляю…",
  keyEnvStays: (variable) => `Этот ключ берётся из ${variable}; чтобы перестать его использовать, уберите его там.`,
  keySaveFailed: (message) => `Не удалось сохранить ключ: ${message}`,
  keyRemoveFailed: (message) => `Не удалось удалить ключ: ${message}`,
  keyRemoved: "Ключ удалён. Пока вы не добавите новый, ничего не отправляется.",
}

const es: typeof en = {
  keyFound: (source) => `Memo encontró tu clave de API (${source}).`,
  keySource: {
    keyring: "en el llavero del sistema",
    file: "en el archivo de claves de Memo",
    env: "en una variable de entorno",
  },
  keyLabel: (provider) => `Clave de API de ${provider}`,
  keySave: "Guardar clave",
  keyShow: "Mostrar la clave",
  keyHide: "Ocultar la clave",
  keySaving: "Guardando…",
  keyWhere:
    "Memo la guarda en el llavero del sistema o, si no responde, en un archivo privado. Esta aplicación nunca la guarda ni la muestra.",
  keyRemove: "Quitar clave",
  keyRemoving: "Quitando…",
  keyEnvStays: (variable) => `Esta clave viene de ${variable}; quítala allí para dejar de usarla.`,
  keySaveFailed: (message) => `No se pudo guardar la clave: ${message}`,
  keyRemoveFailed: (message) => `No se pudo quitar la clave: ${message}`,
  keyRemoved: "Clave quitada. No se envía nada hasta que añadas otra.",
}

export const providerKeyMessages: Messages<typeof en> = { en, ru, es }
export type ProviderKeyText = typeof en
