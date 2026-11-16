import { type Messages, plural } from "@/i18n"

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
      n === null
        ? ""
        : n === 0
          ? "No folders inside"
          : `${plural("en", n, { one: "# folder", other: "# folders" })} inside`,
    partial: "Google searched only some of your shared drives, so a few folders may be missing here.",
    chosen: (n: number) => `${n} chosen`,
    add: (n: number) => (n === 0 ? "Add folders" : `Add ${plural("en", n, { one: "# folder", other: "# folders" })}`),
    adding: "Adding…",
    noneChosen: "Tick at least one folder to add.",
    done: (n: number) => `${plural("en", n, { one: "# folder", other: "# folders" })} added. Sync to copy their files.`,
    notAdded: (names: string) => `Not added: ${names}. Try again in a minute.`,
    retry: "Try again",
    more: "Show more",
    readingMore: "Reading more…",
    moreFailed: "Could not read more.",
    kind: {
      my_drive: "Your files",
      shared_drive: "Shared drive",
      shared_with_me: "",
      page: "Page",
      database: "Database",
    } as Record<string, string>,
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
    listFailed: "Could not read the chosen folders.",
    removeFailed: (name: string, error: string) => `${name} is still imported: ${error}`,
    changed: "Folders changed. Sync now to copy or drop their text.",
    retry: "Try again",
    close: "Close",
  },
  notion: {
    picker: {
      title: "Choose what Notion copies",
      lead: "Notion copies only the pages and databases you choose, with every page inside them. Until you choose one, it copies everything your token sees.",
      trail: "Pages",
      root: "Notion",
      loading: "Reading pages…",
      empty: "No pages or databases here.",
      partial:
        "This list is incomplete: Notion's search gives only its 10,000 most recently edited results, so older pages and databases may be missing.",
      add: (n: number) => (n === 0 ? "Add" : `Add ${n}`),
      noneChosen: "Tick at least one page or database to add.",
      done: (n: number) => `${n} added. Sync to copy their pages.`,
    },
    folders: {
      title: (profile: string) => `What Notion copies for ${profile}`,
      what: "Only these pages and databases are copied to this computer, with every page inside them, as text you can search. Your agent can search and read them.",
      removing:
        "Removing one stops copying it: the next sync deletes its copied text from this computer. Once the last one is removed, the next sync copies everything your token sees again. Nothing changes in Notion.",
      none: "Nothing chosen, so Notion copies everything your token sees.",
      add: "Add pages",
      listFailed: "Could not read the chosen pages and databases.",
      removeFailed: (name: string, error: string) => `${name} is still copied: ${error}`,
      changed: "What Notion copies changed. Sync now to copy or drop their text.",
      whole: "Everything your token sees",
      wholeDetail: "No page chosen yet. Add one to copy only that.",
    },
  },
  transcripts: {
    title: "Meeting transcripts",
    lead: "Google Meet saves transcripts and Gemini notes as Google Docs in the organizer's Drive and shares them with the guests, so most of them are not in your folders.",
    loading: "Looking for transcripts…",
    found: (n: number) =>
      n === 0
        ? "No transcripts or Gemini notes found yet."
        : `Found ${plural("en", n, { one: "# transcript or Gemini note", other: "# transcripts and Gemini notes" })}`,
    more: (n: number) => `and ${n} more`,
    choose: "Add them to WireCat?",
    choices: {
      include: {
        name: "Add to WireCat",
        detail:
          "Copied wherever they are, like a chosen folder, and kept up to date. Your agent can search and read them.",
      },
      skip: {
        name: "Don't add",
        detail: "Only the folders you chose are copied. You can change this at any time.",
      },
      exclude: {
        name: "Never add",
        detail: "Left out even when they sit in a folder you chose.",
      },
    },
    saving: "Saving…",
    saved: {
      include: "Transcripts and Gemini notes will be copied on the next sync.",
      skip: "Transcripts are not added. Those in your chosen folders are still copied.",
      exclude: "Transcripts and Gemini notes are never copied, not even from your chosen folders.",
    },
    saveFailed: (error: string) => `The choice was not saved: ${error}`,
    findFailed: "Could not look for transcripts. You can still choose.",
    needsUpdate: "This version of Drive cannot find transcripts. Update it on the Tools page to choose.",
    retry: "Try again",
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
    more: "Показать ещё",
    readingMore: "Читаю дальше…",
    moreFailed: "Не удалось прочитать дальше.",
    kind: {
      my_drive: "Ваши файлы",
      shared_drive: "Общий диск",
      shared_with_me: "",
      page: "Страница",
      database: "База данных",
    },
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
    listFailed: "Не удалось прочитать выбранные папки.",
    removeFailed: (name, error) => `${name} всё ещё импортируется: ${error}`,
    changed: "Папки изменились. Синхронизируйте сейчас, чтобы скопировать или убрать их текст.",
    retry: "Попробовать снова",
    close: "Закрыть",
  },
  notion: {
    picker: {
      title: "Что копировать из Notion",
      lead: "Notion копирует только выбранные страницы и базы данных, со всеми страницами внутри. Пока ничего не выбрано, копируется всё, что видит ваш токен.",
      trail: "Страницы",
      root: "Notion",
      loading: "Читаю страницы…",
      empty: "Здесь нет страниц и баз данных.",
      partial:
        "Список неполный: поиск Notion отдаёт только 10 000 недавно изменённых результатов, поэтому старых страниц и баз данных здесь может не быть.",
      add: (n) => (n === 0 ? "Добавить" : `Добавить: ${n}`),
      noneChosen: "Отметьте хотя бы одну страницу или базу данных.",
      done: (n) => `Добавлено: ${n}. Синхронизируйте, чтобы скопировать страницы.`,
    },
    folders: {
      title: (profile) => `Что Notion копирует для ${profile}`,
      what: "На этот компьютер копируются только эти страницы и базы данных, со всеми страницами внутри, в виде текста для поиска. Ваш агент может искать в них и читать их.",
      removing:
        "Если убрать страницу, она перестанет копироваться: при следующей синхронизации её скопированный текст удалится с этого компьютера. Когда убрана последняя, следующая синхронизация снова копирует всё, что видит токен. В Notion ничего не меняется.",
      none: "Ничего не выбрано, поэтому Notion копирует всё, что видит ваш токен.",
      add: "Добавить страницы",
      listFailed: "Не удалось прочитать выбранные страницы и базы данных.",
      removeFailed: (name, error) => `${name} всё ещё копируется: ${error}`,
      changed: "Состав копируемого из Notion изменился. Синхронизируйте сейчас, чтобы скопировать или убрать текст.",
      whole: "Всё, что видит ваш токен",
      wholeDetail: "Страницы ещё не выбраны. Добавьте одну, чтобы копировать только её.",
    },
  },
  transcripts: {
    title: "Расшифровки встреч",
    lead: "Google Meet сохраняет расшифровки и заметки Gemini как документы Google в Drive организатора и делится ими с гостями, поэтому большинство из них не лежит в ваших папках.",
    loading: "Ищу расшифровки…",
    found: (n) =>
      n === 0
        ? "Расшифровок и заметок Gemini пока не найдено."
        : plural("ru", n, {
            one: "Найдена # расшифровка или заметка Gemini",
            few: "Найдено # расшифровки и заметки Gemini",
            many: "Найдено # расшифровок и заметок Gemini",
            other: "Найдено # расшифровки и заметки Gemini",
          }),
    more: (n) => `и ещё ${n}`,
    choose: "Добавить их в WireCat?",
    choices: {
      include: {
        name: "Добавить в WireCat",
        detail:
          "Копируются из любого места, как документы выбранной папки, и обновляются. Ваш агент может искать в них и читать их.",
      },
      skip: {
        name: "Не добавлять",
        detail: "Копируются только выбранные папки. Это можно поменять в любой момент.",
      },
      exclude: {
        name: "Никогда не добавлять",
        detail: "Не копируются, даже если лежат в выбранной папке.",
      },
    },
    saving: "Сохраняю…",
    saved: {
      include: "Расшифровки и заметки Gemini скопируются при следующей синхронизации.",
      skip: "Расшифровки не добавляются. Те, что лежат в выбранных папках, по-прежнему копируются.",
      exclude: "Расшифровки и заметки Gemini не копируются никогда, даже из выбранных папок.",
    },
    saveFailed: (error) => `Выбор не сохранён: ${error}`,
    findFailed: "Поиск расшифровок не удался. Выбрать всё равно можно.",
    needsUpdate: "Эта версия Drive не умеет искать расшифровки. Обновите её на странице «Инструменты», чтобы выбрать.",
    retry: "Попробовать снова",
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
      n === null
        ? ""
        : n === 0
          ? "Sin carpetas dentro"
          : `${plural("es", n, { one: "# carpeta", other: "# carpetas" })} dentro`,
    partial: "Google buscó solo en algunas de tus unidades compartidas, así que pueden faltar algunas carpetas.",
    chosen: (n) => `${plural("es", n, { one: "# elegida", other: "# elegidas" })}`,
    add: (n) => (n === 0 ? "Añadir carpetas" : `Añadir ${plural("es", n, { one: "# carpeta", other: "# carpetas" })}`),
    adding: "Añadiendo…",
    noneChosen: "Marca al menos una carpeta.",
    done: (n) =>
      `${plural("es", n, { one: "# carpeta añadida", other: "# carpetas añadidas" })}. Sincroniza para copiar sus archivos.`,
    notAdded: (names) => `No añadidas: ${names}. Vuelve a intentarlo en un minuto.`,
    retry: "Reintentar",
    more: "Mostrar más",
    readingMore: "Leyendo más…",
    moreFailed: "No se pudo leer más.",
    kind: {
      my_drive: "Tus archivos",
      shared_drive: "Unidad compartida",
      shared_with_me: "",
      page: "Página",
      database: "Base de datos",
    },
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
    listFailed: "No se pudieron leer las carpetas elegidas.",
    removeFailed: (name, error) => `${name} se sigue importando: ${error}`,
    changed: "Las carpetas cambiaron. Sincroniza ahora para copiar o quitar su texto.",
    retry: "Reintentar",
    close: "Cerrar",
  },
  notion: {
    picker: {
      title: "Elige qué copia Notion",
      lead: "Notion copia solo las páginas y bases de datos que elijas, con todas las páginas que contienen. Mientras no elijas ninguna, copia todo lo que ve tu token.",
      trail: "Páginas",
      root: "Notion",
      loading: "Leyendo páginas…",
      empty: "Aquí no hay páginas ni bases de datos.",
      partial:
        "Esta lista está incompleta: la búsqueda de Notion da solo sus 10 000 resultados editados más recientemente, así que pueden faltar páginas y bases de datos antiguas.",
      add: (n) => (n === 0 ? "Añadir" : `Añadir ${n}`),
      noneChosen: "Marca al menos una página o base de datos.",
      done: (n) => `${plural("es", n, { one: "# añadida", other: "# añadidas" })}. Sincroniza para copiar sus páginas.`,
    },
    folders: {
      title: (profile) => `Qué copia Notion para ${profile}`,
      what: "Solo estas páginas y bases de datos se copian a este ordenador, con todas las páginas que contienen, como texto en el que buscar. Tu agente puede buscar en ellas y leerlas.",
      removing:
        "Si quitas una, deja de copiarse: la próxima sincronización borra su texto copiado de este ordenador. Cuando quitas la última, la próxima sincronización vuelve a copiar todo lo que ve tu token. En Notion no cambia nada.",
      none: "No hay nada elegido, así que Notion copia todo lo que ve tu token.",
      add: "Añadir páginas",
      listFailed: "No se pudieron leer las páginas y bases de datos elegidas.",
      removeFailed: (name, error) => `${name} se sigue copiando: ${error}`,
      changed: "Cambió lo que copia Notion. Sincroniza ahora para copiar o quitar su texto.",
      whole: "Todo lo que ve tu token",
      wholeDetail: "Aún no hay páginas elegidas. Añade una para copiar solo esa.",
    },
  },
  transcripts: {
    title: "Transcripciones de reuniones",
    lead: "Google Meet guarda las transcripciones y las notas de Gemini como documentos de Google en el Drive del organizador y los comparte con los invitados, así que la mayoría no están en tus carpetas.",
    loading: "Buscando transcripciones…",
    found: (n) =>
      n === 0
        ? "Aún no se encontraron transcripciones ni notas de Gemini."
        : plural("es", n, {
            one: "Se encontró # transcripción o nota de Gemini",
            other: "Se encontraron # transcripciones y notas de Gemini",
          }),
    more: (n) => `y ${n} más`,
    choose: "¿Añadirlas a WireCat?",
    choices: {
      include: {
        name: "Añadir a WireCat",
        detail:
          "Se copian estén donde estén, como una carpeta elegida, y se mantienen al día. Tu agente puede buscar en ellas y leerlas.",
      },
      skip: {
        name: "No añadir",
        detail: "Solo se copian las carpetas que elegiste. Puedes cambiarlo cuando quieras.",
      },
      exclude: {
        name: "No añadir nunca",
        detail: "Se quedan fuera aunque estén en una carpeta que elegiste.",
      },
    },
    saving: "Guardando…",
    saved: {
      include: "Las transcripciones y las notas de Gemini se copiarán en la próxima sincronización.",
      skip: "Las transcripciones no se añaden. Las que están en tus carpetas elegidas se siguen copiando.",
      exclude: "Las transcripciones y las notas de Gemini no se copian nunca, ni siquiera desde tus carpetas elegidas.",
    },
    saveFailed: (error) => `La elección no se guardó: ${error}`,
    findFailed: "No se pudieron buscar las transcripciones. Aun así puedes elegir.",
    needsUpdate:
      "Esta versión de Drive no puede buscar transcripciones. Actualízala en la página Herramientas para elegir.",
    retry: "Reintentar",
  },
}

export const driveMessages: Messages<DriveText> = { en, ru, es }

/** The picker's and the settings' words for one tool: notion's own where they differ, drive's otherwise. */
export function folderWords(t: DriveText, tool: string) {
  const own = tool === "notion" ? t.notion : null
  return {
    picker: { ...t.picker, ...own?.picker },
    folders: { ...t.folders, whole: "", wholeDetail: "", ...own?.folders },
  }
}
