import { type Messages, plural } from "@/i18n"

type Phase = "resolve" | "fetch" | "setup" | "quiet"

const en = {
  label: "Install progress",
  elapsed: "Time so far",
  looking: (n: number) => (n ? `Looking up packages: ${n} so far` : "Looking up packages"),
  of: (done: number, total: number) =>
    `Downloading ${done} of ${plural("en", total, { one: "# package", other: "# packages" })}`,
  unpacking: (n: number) => `Unpacking packages: ${n} so far`,
  setup: "Setting up on this computer",
  quiet: "Installing",
  /** What is happening, in one sentence, under the bar. */
  now: {
    resolve: "npm is checking what the tool needs.",
    fetch: "npm is fetching the tool and everything it needs.",
    setup: "Everything is downloaded. npm is putting the tool in place and reports nothing until it is done.",
    quiet: "The package manager reports nothing until it finishes.",
  } as Record<Phase, string>,
}

export type ProgressText = typeof en

const ru: ProgressText = {
  label: "Ход установки",
  elapsed: "Прошло",
  looking: (n) => (n ? `Ищем пакеты: найдено ${n}` : "Ищем пакеты"),
  // "из 21 пакета", but "из 5 пакетов" and "из 60 пакетов".
  of: (done, total) => `Скачиваем ${done} ${plural("ru", total, { one: "из # пакета", other: "из # пакетов" })}`,
  unpacking: (n) => `Распаковываем пакеты: ${n}`,
  setup: "Устанавливаем на этот компьютер",
  quiet: "Устанавливаем",
  now: {
    resolve: "npm выясняет, что нужно инструменту.",
    fetch: "npm получает инструмент и всё, что ему нужно.",
    setup: "Всё скачано. npm устанавливает инструмент и ничего не сообщает, пока не закончит.",
    quiet: "Менеджер пакетов ничего не сообщает, пока не закончит.",
  },
}

const es: ProgressText = {
  label: "Progreso de la instalación",
  elapsed: "Tiempo transcurrido",
  looking: (n) => (n ? `Buscando paquetes: ${n} hasta ahora` : "Buscando paquetes"),
  of: (done, total) => `Descargando ${done} de ${plural("es", total, { one: "# paquete", other: "# paquetes" })}`,
  unpacking: (n) => `Descomprimiendo paquetes: ${n} hasta ahora`,
  setup: "Instalando en este equipo",
  quiet: "Instalando",
  now: {
    resolve: "npm está comprobando qué necesita la herramienta.",
    fetch: "npm está obteniendo la herramienta y todo lo que necesita.",
    setup: "Ya está todo descargado. npm está instalando la herramienta y no informa de nada hasta terminar.",
    quiet: "El gestor de paquetes no informa de nada hasta que termina.",
  },
}

export const progressMessages: Messages<ProgressText> = { en, ru, es }
