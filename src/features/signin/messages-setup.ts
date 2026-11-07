import type { Messages } from "@/i18n"

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const en = {
  drive: {
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
    add: (n: number) => (n === 0 ? "Choose a folder first" : `Add ${n} ${plural(n, "folder", "folders")}`),
    adding: "Adding…",
    done: (n: number) => `${n} ${plural(n, "folder", "folders")} added. Sync to copy their files.`,
    notAdded: (names: string) => `Not added: ${names}. Try again in a minute.`,
    retry: "Try again",
    kind: { my_drive: "Your files", shared_drive: "Shared drive", shared_with_me: "" } as Record<string, string>,
  },
  zoom: {
    askTitle: "Your Zoom app's Public Client ID",
    askLead:
      "Zoom lets a program in only through an app you make once. Make it with the steps below, then paste its ID.",
    copyRequired: (n: number) => `Copy all ${n}`,
    optional: (n: number) => `${n} more, only for other zm features`,
    loading: "Asking zm what the app needs…",
  },
  mail: {
    serverHint: {
      imap_host: "For example imap.example.com. Your mail service's help page names it.",
      imap_port: "Leave empty for 993.",
      smtp_host: "Leave empty to only read mail.",
      smtp_port: "Leave empty for 465.",
    } as Record<string, string>,
    serverEmpty: "Type the server's name first.",
    portWrong: "A port is a number from 1 to 65535.",
    prepare: "Before the password",
  },
  wa: {
    phoneHint:
      "With + and the country code, for example +34 612 345 678. WhatsApp then shows a code to type on the phone.",
    phonePreview: (phone: string) => `WhatsApp gets ${phone}.`,
  },
}

export type SetupText = typeof en

const ru: SetupText = {
  drive: {
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
    add: (n) => (n === 0 ? "Сначала выберите папку" : `Добавить папки: ${n}`),
    adding: "Добавляю…",
    done: (n) => `Добавлено папок: ${n}. Синхронизируйте, чтобы скопировать файлы.`,
    notAdded: (names) => `Не добавлены: ${names}. Попробуйте через минуту.`,
    retry: "Попробовать снова",
    kind: { my_drive: "Ваши файлы", shared_drive: "Общий диск", shared_with_me: "" },
  },
  zoom: {
    askTitle: "Public Client ID вашего приложения Zoom",
    askLead:
      "Zoom пускает программу только через приложение, которое вы создаёте один раз. Создайте его по шагам ниже и вставьте его ID.",
    copyRequired: (n) => `Скопировать все (${n})`,
    optional: (n) => `Ещё ${n}, только для других функций zm`,
    loading: "Спрашиваю у zm, что нужно приложению…",
  },
  mail: {
    serverHint: {
      imap_host: "Например, imap.example.com. Он указан в справке вашей почты.",
      imap_port: "Оставьте пустым для 993.",
      smtp_host: "Оставьте пустым, чтобы только читать почту.",
      smtp_port: "Оставьте пустым для 465.",
    },
    serverEmpty: "Сначала введите имя сервера.",
    portWrong: "Порт — число от 1 до 65535.",
    prepare: "Перед паролем",
  },
  wa: {
    phoneHint:
      "С + и кодом страны, например +7 912 345 6789. Затем WhatsApp покажет код, который нужно ввести на телефоне.",
    phonePreview: (phone) => `WhatsApp получит ${phone}.`,
  },
}

const es: SetupText = {
  drive: {
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
    add: (n) => (n === 0 ? "Elige primero una carpeta" : `Añadir ${n} ${plural(n, "carpeta", "carpetas")}`),
    adding: "Añadiendo…",
    done: (n) => `${n} ${plural(n, "carpeta añadida", "carpetas añadidas")}. Sincroniza para copiar sus archivos.`,
    notAdded: (names) => `No añadidas: ${names}. Vuelve a intentarlo en un minuto.`,
    retry: "Reintentar",
    kind: { my_drive: "Tus archivos", shared_drive: "Unidad compartida", shared_with_me: "" },
  },
  zoom: {
    askTitle: "El Public Client ID de tu app de Zoom",
    askLead:
      "Zoom deja entrar a un programa solo mediante una app que creas una vez. Créala con los pasos de abajo y pega su ID.",
    copyRequired: (n) => `Copiar los ${n}`,
    optional: (n) => `${n} más, solo para otras funciones de zm`,
    loading: "Preguntando a zm qué necesita la app…",
  },
  mail: {
    serverHint: {
      imap_host: "Por ejemplo imap.example.com. Lo indica la ayuda de tu servicio de correo.",
      imap_port: "Déjalo vacío para 993.",
      smtp_host: "Déjalo vacío para solo leer el correo.",
      smtp_port: "Déjalo vacío para 465.",
    },
    serverEmpty: "Escribe primero el nombre del servidor.",
    portWrong: "Un puerto es un número del 1 al 65535.",
    prepare: "Antes de la contraseña",
  },
  wa: {
    phoneHint:
      "Con + y el prefijo del país, por ejemplo +34 612 345 678. Después WhatsApp muestra un código para escribir en el teléfono.",
    phonePreview: (phone) => `WhatsApp recibe ${phone}.`,
  },
}

export const setupMessages: Messages<SetupText> = { en, ru, es }
