import { type Messages, plural } from "@/i18n"
import type { NotesProblem } from "@/platform/bindings"

const en = {
  title: "Set up your notes",
  what: "Memo reads the notes in the folders you choose, on this computer. It keeps a searchable copy in its own store and never changes your files. Three steps, the last one optional.",
  folderTitle: "Choose your notes folders",
  folderWhat:
    "A system window opens. Pick the folder where you keep your notes (Obsidian or plain Markdown files). You can add more than one.",
  choose: "Choose a folder…",
  chooseAnother: "Add another folder…",
  picking: "Waiting for the folder window…",
  adding: "Adding the folder…",
  foldersLabel: "Folders Memo reads",
  noFolder: "No folder yet.",
  folderAdded: (name: string) => `Added ${name}. The next step reads it.`,
  removeKeep: "Remove",
  removeKeepFor: (name: string) => `Remove ${name} and keep its notes searchable`,
  removeDelete: "Remove and delete notes…",
  removeDeleteFor: (name: string) => `Remove ${name} and delete its notes`,
  removing: "Removing the folder…",
  removedKept: (name: string) => `Memo stopped reading ${name}. Its notes stay searchable.`,
  removedDeleted: (name: string, notes: number | null) =>
    `Memo stopped reading ${name} and deleted ${notes === null ? "its notes" : plural("en", notes, { one: "# note", other: "# notes" })} from its store.`,
  confirmTitle: (name: string) => `Remove ${name} and delete its notes?`,
  confirmWhat: (path: string) =>
    `Memo deletes every note it read from ${path} from its own store, so search no longer finds them. Your files on disk are not touched, and notes from your other folders stay.`,
  confirmDelete: "Remove and delete notes",
  confirmCancel: "Cancel",
  syncTitle: "Read your notes",
  syncWhat:
    "Memo reads every note in these folders once. A few hundred notes take under a minute. Later runs read only what changed.",
  syncNeedsFolder: "Choose a folder first.",
  syncStart: "Read my notes",
  syncAgain: "Read again",
  syncRunning: "Reading your notes…",
  syncLabel: "Reading your notes",
  syncCount: (done: number, total: number, folder: string | null) =>
    `${folder ? `${folder}: ` : ""}${done} of ${plural("en", total, { one: "# file", other: "# files" })}`,
  syncDone: (changed: number, failed: number) => {
    const head =
      changed === 0
        ? "Your notes were already up to date."
        : plural("en", changed, { one: "# note read.", other: "# notes read." })
    return failed > 0
      ? `${head} ${plural("en", failed, { one: "# note could not be read.", other: "# notes could not be read." })}`
      : head
  },
  searchNow: "You can search them now with words. Step 3 adds search by meaning.",
  modelTitle: "Search by meaning (optional)",
  modelWhat:
    'With a model on this computer, a search for "holiday" also finds a note about a vacation. It is downloaded once, runs on your computer and sends nothing out. Without it, search uses words only.',
  modelLighter: "Lighter, faster model",
  modelSize: (mb: number) => `${mb} MB`,
  inUse: "In use",
  useModel: "Use this model",
  downloadAndUse: (mb: number) => `Download ${mb} MB and use`,
  switching: "Switching…",
  switched: (minutes: number | null) =>
    minutes === null
      ? "Switched. Memo re-indexes your notes and mail at the next syncs; search keeps working meanwhile."
      : minutes === 0
        ? "Switched. Search already has everything it needs."
        : `Switched. Re-indexing takes about ${minutes} min at the next syncs; search keeps working meanwhile.`,
  modelsLabel: "Search models",
  modelStart: (mb: number) => `Download ${mb} MB`,
  modelRunning: (mb: number) => `Downloading ${mb} MB… Memo does not report how far it is. It can take a few minutes.`,
  modelPreparing: "Done. Preparing your notes for search by meaning…",
  modelLabel: "Downloading the search model",
  modelCount: (done: number, total: number) => `${done} of ${total} MB`,
  modelCancel: "Cancel",
  modelStopped: "Download cancelled. Nothing was kept, so you can start again any time.",
  modelDone: "Search by meaning is on. Results now say whether they matched by words, by meaning or both.",
  modelReady: "The search model is already on this computer.",
  tryAgain: "Try again",
  chooseOther: "Choose another folder…",
  loadFailed: "Could not read the notes setup.",
  noMemo: "Install Memo to set up your notes.",
  old: (version: string | null, need: string) =>
    `${version ? `Memo ${version}` : "This Memo"} is too old for this setup. Update it to ${need} or later, above, then come back.`,
  problem: {
    folderUnreadable:
      "WireCat cannot read that folder. It may have moved, or the system may not let this app open it. Choose it again, or pick another folder.",
    diskFull: "There is not enough free space on this computer. Free some space, about 300 MB, then try again.",
    offline: "The download did not reach the internet. Check your connection, then try again.",
    tooOld: "This version of Memo does not have that command. Update Memo above, then try again.",
    busy: "Another Memo run is using your notes, such as a sync or an import. Wait until it ends, then try again.",
    other: "Memo stopped with an error. Try again. If it repeats, the Logs page shows the run.",
  } satisfies Record<NotesProblem, string>,
}

const ru: typeof en = {
  title: "Настройка заметок",
  what: "Memo читает заметки из папок, которые вы выберете, на этом компьютере. Он хранит копию для поиска в своём хранилище и не меняет ваши файлы. Три шага, последний необязательный.",
  folderTitle: "Выберите папки с заметками",
  folderWhat:
    "Откроется системное окно. Выберите папку, где лежат ваши заметки (Obsidian или обычные файлы Markdown). Можно добавить несколько папок.",
  choose: "Выбрать папку…",
  chooseAnother: "Добавить ещё папку…",
  picking: "Ждём окно выбора папки…",
  adding: "Добавляем папку…",
  foldersLabel: "Папки, которые читает Memo",
  noFolder: "Папок пока нет.",
  folderAdded: (name: string) => `Папка ${name} добавлена. Следующий шаг её прочитает.`,
  removeKeep: "Убрать",
  removeKeepFor: (name: string) => `Убрать ${name}, заметки останутся в поиске`,
  removeDelete: "Убрать и удалить заметки…",
  removeDeleteFor: (name: string) => `Убрать ${name} и удалить её заметки`,
  removing: "Убираем папку…",
  removedKept: (name: string) => `Memo перестал читать ${name}. Её заметки остаются в поиске.`,
  removedDeleted: (name: string, notes: number | null) =>
    `Memo перестал читать ${name} и удалил ${
      notes === null
        ? "её заметки"
        : plural("ru", notes, { one: "# заметку", few: "# заметки", many: "# заметок", other: "# заметки" })
    } из своего хранилища.`,
  confirmTitle: (name: string) => `Убрать ${name} и удалить её заметки?`,
  confirmWhat: (path: string) =>
    `Memo удалит из своего хранилища все заметки, прочитанные из ${path}, и поиск их больше не найдёт. Ваши файлы на диске не тронут, заметки из других папок останутся.`,
  confirmDelete: "Убрать и удалить заметки",
  confirmCancel: "Отменить",
  syncTitle: "Прочитайте заметки",
  syncWhat:
    "Memo один раз читает все заметки в этих папках. Несколько сотен заметок занимают меньше минуты. Дальше он читает только то, что изменилось.",
  syncNeedsFolder: "Сначала выберите папку.",
  syncStart: "Прочитать заметки",
  syncAgain: "Прочитать снова",
  syncRunning: "Читаем заметки…",
  syncLabel: "Чтение заметок",
  syncCount: (done: number, total: number, folder: string | null) =>
    `${folder ? `${folder}: ` : ""}${done} из ${total} ${plural("ru", total, { one: "файла", few: "файлов", many: "файлов", other: "файлов" })}`,
  syncDone: (changed: number, failed: number) => {
    const head =
      changed === 0
        ? "Заметки уже были актуальны."
        : plural("ru", changed, {
            one: "Прочитана # заметка.",
            few: "Прочитано # заметки.",
            many: "Прочитано # заметок.",
            other: "Прочитано # заметки.",
          })
    return failed > 0
      ? `${head} ${plural("ru", failed, {
          one: "# заметку не удалось прочитать.",
          few: "# заметки не удалось прочитать.",
          many: "# заметок не удалось прочитать.",
          other: "# заметки не удалось прочитать.",
        })}`
      : head
  },
  searchNow: "Теперь по ним можно искать по словам. Шаг 3 добавит поиск по смыслу.",
  modelTitle: "Поиск по смыслу (необязательно)",
  modelWhat:
    "С моделью на этом компьютере запрос «отпуск» найдёт и заметку про каникулы. Она скачивается один раз, работает на вашем компьютере и ничего никуда не отправляет. Без неё поиск идёт только по словам.",
  modelLighter: "Лёгкая быстрая модель",
  modelSize: (mb) => `${mb} МБ`,
  inUse: "Используется",
  useModel: "Использовать эту модель",
  downloadAndUse: (mb) => `Скачать ${mb} МБ и использовать`,
  switching: "Переключаю…",
  switched: (minutes) =>
    minutes === null
      ? "Переключено. Memo переиндексирует заметки и почту при следующих синхронизациях; поиск всё это время работает."
      : minutes === 0
        ? "Переключено. Для поиска уже всё готово."
        : `Переключено. Переиндексация займёт около ${minutes} мин при следующих синхронизациях; поиск всё это время работает.`,
  modelsLabel: "Модели поиска",
  modelStart: (mb: number) => `Скачать ${mb} МБ`,
  modelRunning: (mb: number) =>
    `Скачиваем ${mb} МБ… Memo не сообщает, сколько уже скачано. Это может занять несколько минут.`,
  modelPreparing: "Готово. Готовим заметки к поиску по смыслу…",
  modelLabel: "Загрузка модели поиска",
  modelCount: (done: number, total: number) => `${done} из ${total} МБ`,
  modelCancel: "Отменить",
  modelStopped: "Загрузка отменена. Ничего не сохранилось, можно начать снова в любой момент.",
  modelDone:
    "Поиск по смыслу включён. В результатах будет видно, как найдена заметка: по словам, по смыслу или так и так.",
  modelReady: "Модель поиска уже есть на этом компьютере.",
  tryAgain: "Повторить",
  chooseOther: "Выбрать другую папку…",
  loadFailed: "Не удалось прочитать настройки заметок.",
  noMemo: "Установите Memo, чтобы настроить заметки.",
  old: (version: string | null, need: string) =>
    `${version ? `Memo ${version}` : "Этот Memo"} слишком старый для этой настройки. Обновите его до ${need} или новее выше и вернитесь сюда.`,
  problem: {
    folderUnreadable:
      "WireCat не может прочитать эту папку. Её могли переместить, или система не даёт приложению её открыть. Выберите её снова или другую папку.",
    diskFull: "На компьютере не хватает свободного места. Освободите около 300 МБ и повторите.",
    offline: "Загрузка не дошла до интернета. Проверьте соединение и повторите.",
    tooOld: "В этой версии Memo нет такой команды. Обновите Memo выше и повторите.",
    busy: "Другой запуск Memo использует ваши заметки, например синхронизация или импорт. Дождитесь его конца и повторите.",
    other: "Memo остановился с ошибкой. Повторите. Если повторится, запуск виден на странице «Журнал».",
  },
}

const es: typeof en = {
  title: "Configura tus notas",
  what: "Memo lee las notas de las carpetas que elijas, en este equipo. Guarda una copia para buscar en su propio almacén y nunca cambia tus archivos. Tres pasos, el último opcional.",
  folderTitle: "Elige tus carpetas de notas",
  folderWhat:
    "Se abre una ventana del sistema. Elige la carpeta donde guardas tus notas (Obsidian o archivos Markdown normales). Puedes añadir más de una.",
  choose: "Elegir una carpeta…",
  chooseAnother: "Añadir otra carpeta…",
  picking: "Esperando la ventana de carpetas…",
  adding: "Añadiendo la carpeta…",
  foldersLabel: "Carpetas que lee Memo",
  noFolder: "Aún no hay ninguna carpeta.",
  folderAdded: (name: string) => `Se añadió ${name}. El paso siguiente la lee.`,
  removeKeep: "Quitar",
  removeKeepFor: (name: string) => `Quitar ${name} y dejar sus notas en la búsqueda`,
  removeDelete: "Quitar y borrar notas…",
  removeDeleteFor: (name: string) => `Quitar ${name} y borrar sus notas`,
  removing: "Quitando la carpeta…",
  removedKept: (name: string) => `Memo dejó de leer ${name}. Sus notas siguen en la búsqueda.`,
  removedDeleted: (name: string, notes: number | null) =>
    `Memo dejó de leer ${name} y borró ${notes === null ? "sus notas" : plural("es", notes, { one: "# nota", other: "# notas" })} de su almacén.`,
  confirmTitle: (name: string) => `¿Quitar ${name} y borrar sus notas?`,
  confirmWhat: (path: string) =>
    `Memo borra de su propio almacén todas las notas que leyó de ${path}, y la búsqueda ya no las encuentra. Tus archivos en el disco no se tocan y las notas de tus otras carpetas se quedan.`,
  confirmDelete: "Quitar y borrar notas",
  confirmCancel: "Cancelar",
  syncTitle: "Lee tus notas",
  syncWhat:
    "Memo lee una vez todas las notas de estas carpetas. Unos cientos de notas tardan menos de un minuto. Después solo lee lo que cambió.",
  syncNeedsFolder: "Primero elige una carpeta.",
  syncStart: "Leer mis notas",
  syncAgain: "Leer de nuevo",
  syncRunning: "Leyendo tus notas…",
  syncLabel: "Leyendo tus notas",
  syncCount: (done: number, total: number, folder: string | null) =>
    `${folder ? `${folder}: ` : ""}${done} de ${plural("es", total, { one: "# archivo", other: "# archivos" })}`,
  syncDone: (changed: number, failed: number) => {
    const head =
      changed === 0
        ? "Tus notas ya estaban al día."
        : plural("es", changed, { one: "Se leyó # nota.", other: "Se leyeron # notas." })
    return failed > 0
      ? `${head} ${plural("es", failed, { one: "No se pudo leer # nota.", other: "No se pudieron leer # notas." })}`
      : head
  },
  searchNow: "Ya puedes buscar en ellas por palabras. El paso 3 añade la búsqueda por significado.",
  modelTitle: "Búsqueda por significado (opcional)",
  modelWhat:
    "Con un modelo en este equipo, buscar «vacaciones» también encuentra una nota sobre un viaje de descanso. Se descarga una sola vez, funciona en tu equipo y no envía nada fuera. Sin él, la búsqueda usa solo palabras.",
  modelLighter: "Modelo ligero y rápido",
  modelSize: (mb) => `${mb} MB`,
  inUse: "En uso",
  useModel: "Usar este modelo",
  downloadAndUse: (mb) => `Descargar ${mb} MB y usar`,
  switching: "Cambiando…",
  switched: (minutes) =>
    minutes === null
      ? "Cambiado. Memo vuelve a indexar notas y correo en las próximas sincronizaciones; la búsqueda sigue funcionando mientras tanto."
      : minutes === 0
        ? "Cambiado. La búsqueda ya tiene todo lo que necesita."
        : `Cambiado. Volver a indexar lleva unos ${minutes} min en las próximas sincronizaciones; la búsqueda sigue funcionando mientras tanto.`,
  modelsLabel: "Modelos de búsqueda",
  modelStart: (mb: number) => `Descargar ${mb} MB`,
  modelRunning: (mb: number) => `Descargando ${mb} MB… Memo no indica cuánto lleva. Puede tardar unos minutos.`,
  modelPreparing: "Listo. Preparando tus notas para la búsqueda por significado…",
  modelLabel: "Descargando el modelo de búsqueda",
  modelCount: (done: number, total: number) => `${done} de ${total} MB`,
  modelCancel: "Cancelar",
  modelStopped: "Descarga cancelada. No se guardó nada, así que puedes empezar de nuevo cuando quieras.",
  modelDone:
    "La búsqueda por significado está activa. Cada resultado dirá si coincidió por palabras, por significado o por ambos.",
  modelReady: "El modelo de búsqueda ya está en este equipo.",
  tryAgain: "Reintentar",
  chooseOther: "Elegir otra carpeta…",
  loadFailed: "No se pudo leer la configuración de las notas.",
  noMemo: "Instala Memo para configurar tus notas.",
  old: (version: string | null, need: string) =>
    `${version ? `Memo ${version}` : "Este Memo"} es demasiado antiguo para esta configuración. Actualízalo a ${need} o posterior, arriba, y vuelve aquí.`,
  problem: {
    folderUnreadable:
      "WireCat no puede leer esa carpeta. Puede que la hayan movido, o que el sistema no deje abrirla a esta app. Elígela de nuevo o elige otra carpeta.",
    diskFull: "No hay suficiente espacio libre en este equipo. Libera unos 300 MB y vuelve a intentarlo.",
    offline: "La descarga no llegó a internet. Revisa tu conexión y vuelve a intentarlo.",
    tooOld: "Esta versión de Memo no tiene ese comando. Actualiza Memo arriba y vuelve a intentarlo.",
    busy: "Otra ejecución de Memo está usando tus notas, por ejemplo una sincronización o una importación. Espera a que termine y vuelve a intentarlo.",
    other:
      "Memo se detuvo con un error. Vuelve a intentarlo. Si se repite, la página de registros muestra la ejecución.",
  },
}

export const notesSetupMessages: Messages<typeof en> = { en, ru, es }
export type NotesSetupText = typeof en
