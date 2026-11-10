import type { Messages } from "@/i18n"

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const en = {
  picker: {
    title: "Choose what Drive imports",
    lead: "Drive copies only the folders you choose, with everything inside them. You can add more later.",
    trail: "Folders",
    root: "Drive",
    open: (name: string) => `Open ${name}`,
    loading: "Reading folders…",
    empty: "No folders here.",
    sharedWithMe: "Folders others shared with you. Open it to choose them.",
    added: "Added",
    subfolders: (n: number | null) =>
      n === null ? "" : n === 0 ? "No folders inside" : `${n} ${plural(n, "folder", "folders")} inside`,
    partial: "Google searched only some of your shared drives, so a few folders may be missing here.",
    chosen: (n: number) => `${n} chosen`,
    add: (n: number) => (n === 0 ? "Add folders" : `Add ${n} ${plural(n, "folder", "folders")}`),
    adding: "Adding…",
    noneChosen: "Tick at least one folder to add.",
    done: (n: number) => `${n} ${plural(n, "folder", "folders")} added. Sync to copy their files.`,
    notAdded: (names: string) => `Not added: ${names}. Try again in a minute.`,
    retry: "Try again",
    kind: { my_drive: "Your files", shared_drive: "Shared drive", shared_with_me: "" } as Record<string, string>,
  },
  folders: {
    title: (profile: string) => `Folders Drive copies for ${profile}`,
    what: "Only these folders are copied to this computer, as text you can search. Your agent can search and read them. Files outside them stay in Drive and are not read.",
    removing:
      "Removing a folder stops importing it: the next sync deletes its copied text from this computer. The files in Drive stay as they are.",
    next: "Changes take effect on the next sync.",
    none: "No folders chosen yet, so Drive copies nothing for this account.",
    notSynced: "Not synced yet",
    remove: "Remove",
    removeNamed: (name: string) => `Stop importing ${name}`,
    removingNow: "Removing…",
    add: "Add folders",
    doneAdding: "Done adding",
    listFailed: (error: string) => `Could not read the chosen folders: ${error}`,
    removeFailed: (name: string, error: string) => `${name} is still imported: ${error}`,
    changed: "Folders changed. Sync now to copy or drop their text.",
    retry: "Try again",
    close: "Close",
  },
}

export type DriveText = typeof en

const ru: DriveText = {
  picker: {
    title: "Что импортировать из Drive",
    lead: "Drive копирует только выбранные папки, со всем, что в них лежит. Добавить другие можно и позже.",
    trail: "Папки",
    root: "Drive",
    open: (name) => `Открыть ${name}`,
    loading: "Читаю папки…",
    empty: "Здесь нет папок.",
    sharedWithMe: "Папки, которыми с вами поделились. Откройте, чтобы выбрать.",
    added: "Добавлена",
    subfolders: (n) => (n === null ? "" : n === 0 ? "Без вложенных папок" : `Папок внутри: ${n}`),
    partial: "Google просмотрел не все общие диски, поэтому здесь может не быть нескольких папок.",
    chosen: (n) => `Выбрано: ${n}`,
    add: (n) => (n === 0 ? "Добавить папки" : `Добавить папки: ${n}`),
    adding: "Добавляю…",
    noneChosen: "Отметьте хотя бы одну папку.",
    done: (n) => `Добавлено папок: ${n}. Синхронизируйте, чтобы скопировать файлы.`,
    notAdded: (names) => `Не добавлены: ${names}. Попробуйте через минуту.`,
    retry: "Попробовать снова",
    kind: { my_drive: "Ваши файлы", shared_drive: "Общий диск", shared_with_me: "" },
  },
  folders: {
    title: (profile) => `Папки, которые Drive копирует для ${profile}`,
    what: "На этот компьютер копируются только эти папки, в виде текста для поиска. Ваш агент может искать в них и читать их. Файлы вне этих папок остаются в Drive, их никто не читает.",
    removing:
      "Если убрать папку, она перестанет импортироваться: при следующей синхронизации её скопированный текст удалится с этого компьютера. Сами файлы в Drive не меняются.",
    next: "Изменения вступят в силу при следующей синхронизации.",
    none: "Папки ещё не выбраны, поэтому Drive ничего не копирует для этого аккаунта.",
    notSynced: "Ещё не синхронизирована",
    remove: "Убрать",
    removeNamed: (name) => `Больше не импортировать ${name}`,
    removingNow: "Убираю…",
    add: "Добавить папки",
    doneAdding: "Готово",
    listFailed: (error) => `Не удалось прочитать выбранные папки: ${error}`,
    removeFailed: (name, error) => `${name} всё ещё импортируется: ${error}`,
    changed: "Папки изменились. Синхронизируйте сейчас, чтобы скопировать или убрать их текст.",
    retry: "Попробовать снова",
    close: "Закрыть",
  },
}

const es: DriveText = {
  picker: {
    title: "Elige qué importa Drive",
    lead: "Drive copia solo las carpetas que elijas, con todo lo que contienen. Puedes añadir más después.",
    trail: "Carpetas",
    root: "Drive",
    open: (name) => `Abrir ${name}`,
    loading: "Leyendo carpetas…",
    empty: "Aquí no hay carpetas.",
    sharedWithMe: "Carpetas que otros compartieron contigo. Ábrela para elegirlas.",
    added: "Añadida",
    subfolders: (n) =>
      n === null ? "" : n === 0 ? "Sin carpetas dentro" : `${n} ${plural(n, "carpeta", "carpetas")} dentro`,
    partial: "Google buscó solo en algunas de tus unidades compartidas, así que pueden faltar algunas carpetas.",
    chosen: (n) => `${n} ${plural(n, "elegida", "elegidas")}`,
    add: (n) => (n === 0 ? "Añadir carpetas" : `Añadir ${n} ${plural(n, "carpeta", "carpetas")}`),
    adding: "Añadiendo…",
    noneChosen: "Marca al menos una carpeta.",
    done: (n) => `${n} ${plural(n, "carpeta añadida", "carpetas añadidas")}. Sincroniza para copiar sus archivos.`,
    notAdded: (names) => `No añadidas: ${names}. Vuelve a intentarlo en un minuto.`,
    retry: "Reintentar",
    kind: { my_drive: "Tus archivos", shared_drive: "Unidad compartida", shared_with_me: "" },
  },
  folders: {
    title: (profile) => `Carpetas que Drive copia para ${profile}`,
    what: "Solo estas carpetas se copian a este ordenador, como texto en el que buscar. Tu agente puede buscar en ellas y leerlas. Los archivos fuera de ellas se quedan en Drive y no se leen.",
    removing:
      "Si quitas una carpeta, deja de importarse: la próxima sincronización borra su texto copiado de este ordenador. Los archivos en Drive no cambian.",
    next: "Los cambios se aplican en la próxima sincronización.",
    none: "Aún no hay carpetas elegidas, así que Drive no copia nada para esta cuenta.",
    notSynced: "Aún sin sincronizar",
    remove: "Quitar",
    removeNamed: (name) => `Dejar de importar ${name}`,
    removingNow: "Quitando…",
    add: "Añadir carpetas",
    doneAdding: "Listo",
    listFailed: (error) => `No se pudieron leer las carpetas elegidas: ${error}`,
    removeFailed: (name, error) => `${name} se sigue importando: ${error}`,
    changed: "Las carpetas cambiaron. Sincroniza ahora para copiar o quitar su texto.",
    retry: "Reintentar",
    close: "Cerrar",
  },
}

export const driveMessages: Messages<DriveText> = { en, ru, es }
