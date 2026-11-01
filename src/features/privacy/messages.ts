import type { Messages } from "@/i18n"

type Sent = { name: string; when: string; text: string }

const en = {
  title: "Privacy",
  lead: "WireCat works on this computer. Your data stays here, and WireCat has no account for you.",
  stays: {
    title: "Stays on this computer",
    text: "Everything: your messages, mail, documents, notes, memories, tasks and settings. Sign-in keys stay in your system's keyring or in the tool's folder. WireCat keeps no copy anywhere else.",
  },
  sends: {
    title: "What the app sends, and when",
    news: {
      name: "News check",
      when: "At start, then every hour",
      text: "Only the app version and your system. WireCat's server does not save your IP address for it; only the web server's access log still lists it. What you read stays here.",
    } as Sent,
    report: {
      name: "Bug report",
      when: "Only when you send one",
      text: "Your text, the versions, and recent failed runs with personal details hidden. The public GitHub issue has no logs; the logs are kept privately and deleted after 90 days, and from backups 14 days later.",
    } as Sent,
    tools: {
      name: "Tool versions",
      when: "When you open Tools; kept for an hour",
      text: "Your npm asks its registry for the newest version of each WireCat tool. WireCat adds nothing to that request.",
    } as Sent,
    update: {
      name: "Update check",
      when: "At start, then every 6 hours",
      text: "Reads a small file from GitHub, with no version or id. GitHub sees your IP address, as for any download.",
    } as Sent,
    others:
      "Each tool talks to its own service, such as Telegram or Google, directly and never through WireCat. Other services only when a feature needs them: nodejs.org when Node.js is missing, npm to install tools, Tailscale or Cloudflare to connect an AI app.",
  },
  logs: {
    title: "Logs on this computer",
    text: "Each WireCat tool keeps a log of its runs in its own folder: by default, successful runs for 7 days and failed ones for 30. Read them on the Logs page; the Storage page shows the folders. The app itself keeps no log, apart from the Cloudflare tunnel's log if you use one.",
  },
  never: {
    title: "Never collected",
    text: "No analytics, no tracking, no ads. The app's window can talk only to the app itself.",
  },
  policy: "Full privacy policy",
  close: "Close",
}

const ru: typeof en = {
  title: "Конфиденциальность",
  lead: "WireCat работает на этом компьютере. Ваши данные остаются здесь, и у WireCat нет вашего аккаунта.",
  stays: {
    title: "Остаётся на этом компьютере",
    text: "Всё: сообщения, почта, документы, заметки, записи памяти, задачи и настройки. Ключи входа хранятся в системном хранилище ключей или в папке инструмента. WireCat нигде больше не хранит их копий.",
  },
  sends: {
    title: "Что приложение отправляет и когда",
    news: {
      name: "Проверка новостей",
      when: "При запуске, затем раз в час",
      text: "Только версия приложения и ваша система. Сервер WireCat не сохраняет для неё ваш IP-адрес; он пока есть только в журнале доступа веб-сервера. Что вы прочитали, остаётся здесь.",
    },
    report: {
      name: "Отчёт об ошибке",
      when: "Только когда вы его отправляете",
      text: "Ваш текст, версии и последние упавшие запуски, где личные данные скрыты. В публичном обращении на GitHub логов нет; логи хранятся закрыто и удаляются через 90 дней, а из резервных копий — ещё через 14 дней.",
    },
    tools: {
      name: "Версии инструментов",
      when: "Когда вы открываете «Инструменты»; ответ хранится час",
      text: "Ваш npm спрашивает у своего реестра последнюю версию каждого инструмента WireCat. WireCat ничего не добавляет к этому запросу.",
    },
    update: {
      name: "Проверка обновлений",
      when: "При запуске, затем раз в 6 часов",
      text: "Читает небольшой файл с GitHub, без версии и идентификатора. GitHub видит ваш IP-адрес, как при любом скачивании.",
    },
    others:
      "Каждый инструмент связывается со своим сервисом, например Telegram или Google, напрямую, а не через WireCat. К другим сервисам — только когда они нужны функции: к nodejs.org, когда нет Node.js, к npm, чтобы установить инструменты, к Tailscale или Cloudflare, чтобы подключить ИИ-приложение.",
  },
  logs: {
    title: "Логи на этом компьютере",
    text: "Каждый инструмент WireCat ведёт лог своих запусков в своей папке: по умолчанию успешные хранятся 7 дней, упавшие — 30. Читайте их на странице «Журнал»; папки показывает страница «Хранилище». Само приложение логов не ведёт, кроме лога туннеля Cloudflare, если вы им пользуетесь.",
  },
  never: {
    title: "Никогда не собирается",
    text: "Нет аналитики, слежки и рекламы. Окно приложения может связываться только с самим приложением.",
  },
  policy: "Полная политика конфиденциальности",
  close: "Закрыть",
}

const es: typeof en = {
  title: "Privacidad",
  lead: "WireCat funciona en este ordenador. Tus datos se quedan aquí, y WireCat no tiene una cuenta tuya.",
  stays: {
    title: "Se queda en este ordenador",
    text: "Todo: tus mensajes, correo, documentos, notas, memorias, tareas y ajustes. Las claves de inicio de sesión se quedan en el llavero de tu sistema o en la carpeta de la herramienta. WireCat no guarda ninguna copia en otro sitio.",
  },
  sends: {
    title: "Qué envía la aplicación, y cuándo",
    news: {
      name: "Comprobación de novedades",
      when: "Al iniciar, y después cada hora",
      text: "Solo la versión de la aplicación y tu sistema. El servidor de WireCat no guarda tu dirección IP para ella; solo la registra aún el registro de accesos del servidor web. Lo que lees se queda aquí.",
    },
    report: {
      name: "Informe de error",
      when: "Solo cuando envías uno",
      text: "Tu texto, las versiones y las últimas ejecuciones fallidas, con los datos personales ocultos. La incidencia pública de GitHub no lleva logs; los logs se guardan en privado y se borran a los 90 días, y de las copias de seguridad 14 días después.",
    },
    tools: {
      name: "Versiones de las herramientas",
      when: "Al abrir Herramientas; se guarda una hora",
      text: "Tu npm pregunta a su registro por la versión más reciente de cada herramienta de WireCat. WireCat no añade nada a esa petición.",
    },
    update: {
      name: "Comprobación de actualizaciones",
      when: "Al iniciar, y después cada 6 horas",
      text: "Lee un pequeño archivo de GitHub, sin versión ni identificador. GitHub ve tu dirección IP, como en cualquier descarga.",
    },
    others:
      "Cada herramienta habla con su propio servicio, como Telegram o Google, directamente y nunca a través de WireCat. Otros servicios solo cuando una función los necesita: nodejs.org cuando falta Node.js, npm para instalar herramientas, Tailscale o Cloudflare para conectar una aplicación de IA.",
  },
  logs: {
    title: "Registros en este ordenador",
    text: "Cada herramienta de WireCat guarda un registro de sus ejecuciones en su propia carpeta: por defecto, las correctas 7 días y las fallidas 30. Léelos en la página Registros; la página Almacenamiento muestra las carpetas. La aplicación no guarda ningún log propio, salvo el del túnel de Cloudflare si lo usas.",
  },
  never: {
    title: "Nunca se recoge",
    text: "Sin analítica, sin seguimiento, sin anuncios. La ventana de la aplicación solo puede comunicarse con la propia aplicación.",
  },
  policy: "Política de privacidad completa",
  close: "Cerrar",
}

export const privacyMessages: Messages<typeof en> = { en, ru, es }
