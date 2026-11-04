import { type Messages, plural } from "@/i18n"

type Phase = "waiting" | "check" | "resolve" | "fetch" | "setup" | "quiet" | "verify"

const en = {
  label: "Install progress",
  elapsed: "Time so far",
  looking: (n: number) => (n ? `Looking up packages: ${n} so far` : "Looking up packages"),
  of: (done: number, total: number) =>
    `Downloading ${done} of ${plural("en", total, { one: "# package", other: "# packages" })}`,
  unpacking: (n: number) => `Unpacking packages: ${n} so far`,
  setup: "Setting up on this computer",
  quiet: "Installing",
  waiting: "Waiting for its turn",
  checking: "Checking the package",
  verifying: "Checking that it starts",
  percent: (n: number) => `${n}%`,
  labelFor: (name: string) => `Installing ${name}`,
  still: (name: string, pct: string, more: number) =>
    `Still installing: ${name} ${pct}${more ? `, ${plural("en", more, { one: "# more waits", other: "# more wait" })}` : ""}`,
  /** What is happening, in one sentence, under the bar. */
  now: {
    waiting: "One install runs at a time; this one starts when the one before it ends.",
    check: "Looking up the newest version and checking where npm may install it.",
    resolve: "npm is checking what the tool needs.",
    fetch: "npm is fetching the tool and everything it needs.",
    setup: "Everything is downloaded. npm is putting the tool in place and reports nothing until it is done.",
    quiet: "The package manager reports nothing until it finishes.",
    verify: "The tool is in place. WireCat runs it once to check that it starts.",
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
  waiting: "Ждёт своей очереди",
  checking: "Проверяем пакет",
  verifying: "Проверяем, что запускается",
  percent: (n) => `${n}%`,
  labelFor: (name) => `Установка ${name}`,
  still: (name, pct, more) => `Ещё устанавливается: ${name} ${pct}${more ? `, в очереди ${more}` : ""}`,
  now: {
    waiting: "Установки идут по одной; эта начнётся, когда закончится предыдущая.",
    check: "Узнаём последнюю версию и проверяем, куда npm может её установить.",
    resolve: "npm выясняет, что нужно инструменту.",
    fetch: "npm получает инструмент и всё, что ему нужно.",
    setup: "Всё скачано. npm устанавливает инструмент и ничего не сообщает, пока не закончит.",
    quiet: "Менеджер пакетов ничего не сообщает, пока не закончит.",
    verify: "Инструмент на месте. WireCat запускает его один раз, чтобы проверить.",
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
  waiting: "Esperando su turno",
  checking: "Comprobando el paquete",
  verifying: "Comprobando que arranca",
  percent: (n) => `${n} %`,
  labelFor: (name) => `Instalando ${name}`,
  still: (name, pct, more) => `Aún se instala: ${name} ${pct}${more ? `, ${more} más en espera` : ""}`,
  now: {
    waiting: "Las instalaciones van de una en una; esta empieza cuando termine la anterior.",
    check: "Buscando la versión más reciente y comprobando dónde puede instalarla npm.",
    resolve: "npm está comprobando qué necesita la herramienta.",
    fetch: "npm está obteniendo la herramienta y todo lo que necesita.",
    setup: "Ya está todo descargado. npm está instalando la herramienta y no informa de nada hasta terminar.",
    quiet: "El gestor de paquetes no informa de nada hasta que termina.",
    verify: "La herramienta ya está en su sitio. WireCat la ejecuta una vez para comprobar que arranca.",
  },
}

export const progressMessages: Messages<ProgressText> = { en, ru, es }
