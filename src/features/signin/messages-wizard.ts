import type { FailureReason } from "@/domain/signin-failure"
import type { Messages } from "@/i18n"
import type { WizardStep } from "./wizard"

type Failure = { title: (name: string) => string; cause: (name: string) => string }

const en = {
  steps: {
    intro: () => "Before you start",
    keys: () => "Your app keys, the first time",
    app: () => "Your Zoom app, the first time",
    scan: () => "Scan the QR code",
    phone: () => "Phone number",
    code: (name: string) => `Code from ${name}`,
    password: () => "Two-step password, if set",
    token: () => "Paste the token",
    browser: () => "Approve in the browser",
    history: () => "Receive recent chats",
    check: () => "Check the password",
    done: () => "Done",
  } as Record<WizardStep, (name: string) => string>,
  method: {
    qr: "Sign in with a QR code",
    phone: "Sign in with your phone number",
    token: "Sign in with a token",
    browser: "Sign in in the browser",
  } as Record<string, string>,
  progress: (at: number, total: number) => `Step ${at} of ${total}`,
  needHeading: "Have at hand",
  need: {
    tg: ["Your phone with Telegram on it.", "Your two-step password, if you set one."],
    "max:qr": ["Your phone with the MAX app on it.", "Your MAX cloud password, if you set one."],
    "max:token": ["A browser on this computer, signed in to web.max.ru."],
    wa: ["Your phone with WhatsApp on it, unlocked and online until the chats arrive."],
    zm: [
      "Your Zoom login.",
      "The first time: about ten minutes to make your Zoom app. The steps are shown here, with buttons to copy each value.",
    ],
    drive: ["Your Google login."],
    gcal: ["Your Google login."],
    "email:microsoft": ["Your mail address and your Microsoft login."],
    "email:gmail": ["Your Gmail address.", "An app password. Google offers it only with 2-Step Verification on."],
    "email:imap": ["Your mail address.", "An app password from your mail service's settings."],
  } as Record<string, string[]>,
  failure: {
    needsUpdate: {
      title: (name) => `This version of ${name} cannot sign in inside WireCat.`,
      cause: () => "It is older than the window's sign-in. An update takes a minute; the terminal works meanwhile.",
    },
    qrExpired: {
      title: () => "The QR code expired before it was scanned.",
      cause: () => "Each code is valid for a short time. Start again for a new one and scan it within the time shown.",
    },
    loginInUse: {
      title: (name) => `${name} is busy receiving messages in the background.`,
      cause: (name) =>
        `${name} lets one connection use a linked device at a time. Stop the background service on ${name}'s page, then sign in again.`,
    },
    clientIdMissing: {
      title: () => "Zoom needs an app of your own first.",
      cause: () => "Make it once with the steps below.",
    },
    browserNoReturn: {
      title: () => "The browser never came back to WireCat.",
      cause: (name) =>
        `The page may still be open, or blocked by a pop-up blocker. Start again; if the browser ends on an error page, copy its address and paste it in the field ${name} shows.`,
    },
    denied: {
      title: () => "Access was not allowed.",
      cause: (name) =>
        `The page in the browser was closed or declined. Start again and choose Allow to sign ${name} in.`,
    },
    timeout: {
      title: () => "The sign-in waited too long and stopped.",
      cause: () => "No step was finished in time. Start again when you have the phone or the browser at hand.",
    },
    network: {
      title: (name) => `${name} could not reach its service.`,
      cause: () => "This computer looks offline, or a firewall or VPN blocks the connection. Check it, then try again.",
    },
    cancelled: {
      title: () => "The sign-in was stopped.",
      cause: () => "Nothing was saved. Start again when you are ready.",
    },
    ended: {
      title: (name) => `${name} stopped without saying why.`,
      cause: () => "Try again. If it stops again, report it: the report carries what the tool said, never a code.",
    },
    unknown: {
      title: (name) => `${name} could not finish the sign-in.`,
      cause: () => "What the tool said is under Details. Try again, or report it if it repeats.",
    },
  } as Record<FailureReason, Failure>,
  actions: {
    retry: "Try again",
    newCode: "Show a new code",
    update: (name: string) => `Open ${name} to update`,
    toolPage: (name: string) => `Open ${name}`,
    copy: "Copy the stop command",
  },
  details: "Details",
  token: {
    title: "Copy your MAX token from the web version",
    steps: [
      "Open web.max.ru in Chrome, Edge, Firefox or Brave on this computer and sign in there.",
      "Open the developer tools: F12, or Ctrl+Shift+I (⌥⌘I on a Mac).",
      "Chrome and Edge: Application → Local storage → https://web.max.ru. Firefox: Storage → Local Storage.",
      "Find the key __oneme_auth and copy its whole value. Paste it below as it is: WireCat sends only the token in it.",
    ],
    open: "Open web.max.ru",
    empty: "Paste the value of __oneme_auth first.",
  },
  zoom: {
    title: "Make your Zoom app",
    lead: "Zoom lets a program in only through an app you register in the Zoom App Marketplace. You do it once. Tick each step as you go.",
    done: (n: number, total: number) => `${n} of ${total} done`,
    steps: [
      "Open the Zoom App Marketplace and sign in. Choose Develop → Build App → General App, then Create.",
      "Name it, for example My meeting archive, and choose User-managed.",
      "Stay in the Development environment. In Basic Information → App Credentials, turn on Use Public Client OAuth.",
      "In OAuth Information, paste this address into both OAuth Redirect URL and OAuth Allow Lists. No slash at the end.",
      "In Scopes, choose Add Scopes and add these five:",
      "In Local Test, choose Add App Now and allow it.",
      "Copy the Public Client ID from Basic Information → App Credentials and paste it below. Not the Client ID or the Client Secret.",
    ],
    openMarketplace: "Open the Marketplace",
    copyRedirect: "Copy the redirect address",
    copyScope: (scope: string) => `Copy ${scope}`,
    copyScopes: "Copy all five",
    guide: "The guide with pictures",
  },
  noApp: {
    summary: "No Zoom app? Use transcript files instead",
    text: "Zoom can also read the .vtt transcripts you download or get from the host, with no app and no sign-in. Put them in one folder, named like 2026-10-01_1000_planning.vtt. Each sync then reads that folder instead of your Zoom account.",
    folder: "Folder with the .vtt files",
    folderHint: "The whole path, for example /home/you/Zoom transcripts. Subfolders are not read.",
    timezone: "Time zone of the times in the file names",
    save: "Use these files",
    saving: "Saving…",
    needFolder: "Type the folder's path first.",
    saved: (folder: string) => `Zoom now reads transcripts from ${folder}. Sync to import them.`,
    back: "Use my Zoom account instead",
  },
  next: {
    sync: "Sync now",
    syncLead: (name: string) =>
      `${name} is ready. The first sync copies your data to this computer, so your agent can search it.`,
  },
}

export type WizardText = typeof en

const ru: WizardText = {
  steps: {
    intro: () => "Перед началом",
    keys: () => "Ключи приложения, в первый раз",
    app: () => "Своё приложение Zoom, в первый раз",
    scan: () => "Сканирование QR-кода",
    phone: () => "Номер телефона",
    code: (name) => `Код от ${name}`,
    password: () => "Облачный пароль, если есть",
    token: () => "Вставьте токен",
    browser: () => "Подтверждение в браузере",
    history: () => "Получение недавних чатов",
    check: () => "Проверка пароля",
    done: () => "Готово",
  },
  method: {
    qr: "Вход по QR-коду",
    phone: "Вход по номеру телефона",
    token: "Вход по токену",
    browser: "Вход через браузер",
  },
  progress: (at, total) => `Шаг ${at} из ${total}`,
  needHeading: "Что понадобится",
  need: {
    tg: ["Телефон с Telegram.", "Облачный пароль, если вы его задавали."],
    "max:qr": ["Телефон с приложением MAX.", "Облачный пароль MAX, если вы его задавали."],
    "max:token": ["Браузер на этом компьютере, где выполнен вход в web.max.ru."],
    wa: ["Телефон с WhatsApp: разблокированный и в сети, пока не придут чаты."],
    zm: [
      "Логин и пароль Zoom.",
      "В первый раз — около десяти минут на своё приложение Zoom. Шаги показаны здесь, с кнопками для копирования каждого значения.",
    ],
    drive: ["Логин и пароль Google."],
    gcal: ["Логин и пароль Google."],
    "email:microsoft": ["Адрес почты и логин Microsoft."],
    "email:gmail": [
      "Адрес Gmail.",
      "Пароль приложения. Google даёт его только при включённой двухэтапной аутентификации.",
    ],
    "email:imap": ["Адрес почты.", "Пароль приложения из настроек вашей почты."],
  },
  failure: {
    needsUpdate: {
      title: (name) => `Эта версия ${name} не умеет входить внутри WireCat.`,
      cause: () => "Она старше, чем вход в этом окне. Обновление займёт минуту, а пока можно войти в терминале.",
    },
    qrExpired: {
      title: () => "QR-код истёк, его не успели отсканировать.",
      cause: () =>
        "Каждый код действует недолго. Начните заново, чтобы получить новый, и отсканируйте его за указанное время.",
    },
    loginInUse: {
      title: (name) => `${name} занят: принимает сообщения в фоне.`,
      cause: (name) =>
        `${name} позволяет только одно подключение к привязанному устройству. Остановите фоновую службу на странице ${name} и войдите снова.`,
    },
    clientIdMissing: {
      title: () => "Сначала Zoom нужно своё приложение.",
      cause: () => "Создайте его один раз по шагам ниже.",
    },
    browserNoReturn: {
      title: () => "Браузер так и не вернулся в WireCat.",
      cause: (name) =>
        `Страница может быть ещё открыта или заблокирована блокировщиком всплывающих окон. Начните заново; если браузер остановится на странице с ошибкой, скопируйте её адрес и вставьте в поле, которое покажет ${name}.`,
    },
    denied: {
      title: () => "Доступ не разрешён.",
      cause: (name) =>
        `Страницу в браузере закрыли или нажали «Отклонить». Начните заново и разрешите доступ, чтобы войти в ${name}.`,
    },
    timeout: {
      title: () => "Вход ждал слишком долго и остановился.",
      cause: () => "Ни один шаг не завершился вовремя. Начните заново, когда телефон или браузер будут под рукой.",
    },
    network: {
      title: (name) => `${name} не смог связаться со своим сервисом.`,
      cause: () =>
        "Похоже, компьютер не в сети, или соединение блокирует файрвол или VPN. Проверьте и попробуйте снова.",
    },
    cancelled: {
      title: () => "Вход остановлен.",
      cause: () => "Ничего не сохранено. Начните заново, когда будете готовы.",
    },
    ended: {
      title: (name) => `${name} остановился и не сказал почему.`,
      cause: () =>
        "Попробуйте снова. Если повторится, сообщите об ошибке: в отчёт попадает то, что сказал инструмент, но не коды.",
    },
    unknown: {
      title: (name) => `${name} не смог завершить вход.`,
      cause: () => "Что сказал инструмент — в «Подробностях». Попробуйте снова или сообщите, если повторится.",
    },
  },
  actions: {
    retry: "Попробовать снова",
    newCode: "Показать новый код",
    update: (name) => `Открыть ${name} для обновления`,
    toolPage: (name) => `Открыть ${name}`,
    copy: "Скопировать команду остановки",
  },
  details: "Подробности",
  token: {
    title: "Скопируйте токен MAX из веб-версии",
    steps: [
      "Откройте web.max.ru в Chrome, Edge, Firefox или Brave на этом компьютере и войдите там.",
      "Откройте инструменты разработчика: F12 или Ctrl+Shift+I (⌥⌘I на Mac).",
      "Chrome и Edge: Application → Local storage → https://web.max.ru. Firefox: Хранилище → Локальное хранилище.",
      "Найдите ключ __oneme_auth и скопируйте всё значение. Вставьте его ниже как есть: WireCat отправит только токен из него.",
    ],
    open: "Открыть web.max.ru",
    empty: "Сначала вставьте значение __oneme_auth.",
  },
  zoom: {
    title: "Создайте своё приложение Zoom",
    lead: "Zoom пускает программы только через приложение, зарегистрированное в Zoom App Marketplace. Это делается один раз. Отмечайте шаги по ходу.",
    done: (n, total) => `Готово ${n} из ${total}`,
    steps: [
      "Откройте Zoom App Marketplace и войдите. Выберите Develop → Build App → General App, затем Create.",
      "Назовите его, например «Мой архив встреч», и выберите User-managed.",
      "Оставайтесь в среде Development. В Basic Information → App Credentials включите Use Public Client OAuth.",
      "В OAuth Information вставьте этот адрес в оба поля: OAuth Redirect URL и OAuth Allow Lists. Без косой черты в конце.",
      "В Scopes нажмите Add Scopes и добавьте эти пять:",
      "В Local Test нажмите Add App Now и разрешите доступ.",
      "Скопируйте Public Client ID из Basic Information → App Credentials и вставьте ниже. Не Client ID и не Client Secret.",
    ],
    openMarketplace: "Открыть Marketplace",
    copyRedirect: "Скопировать адрес перенаправления",
    copyScope: (scope) => `Скопировать ${scope}`,
    copyScopes: "Скопировать все пять",
    guide: "Инструкция с картинками",
  },
  noApp: {
    summary: "Нет приложения Zoom? Используйте файлы расшифровок",
    text: "Zoom может читать и расшифровки .vtt, которые вы скачали или получили от организатора, — без приложения и без входа. Сложите их в одну папку с именами вроде 2026-10-01_1000_planning.vtt. Каждая синхронизация будет читать эту папку вместо аккаунта Zoom.",
    folder: "Папка с файлами .vtt",
    folderHint: "Полный путь, например /home/you/Zoom transcripts. Вложенные папки не читаются.",
    timezone: "Часовой пояс времени в именах файлов",
    save: "Использовать эти файлы",
    saving: "Сохраняем…",
    needFolder: "Сначала укажите путь к папке.",
    saved: (folder) => `Zoom теперь читает расшифровки из ${folder}. Запустите синхронизацию, чтобы их загрузить.`,
    back: "Использовать аккаунт Zoom",
  },
  next: {
    sync: "Синхронизировать сейчас",
    syncLead: (name) =>
      `${name} готов. Первая синхронизация копирует данные на этот компьютер, чтобы агент мог по ним искать.`,
  },
}

const es: WizardText = {
  steps: {
    intro: () => "Antes de empezar",
    keys: () => "Tus claves de app, la primera vez",
    app: () => "Tu app de Zoom, la primera vez",
    scan: () => "Escanear el código QR",
    phone: () => "Número de teléfono",
    code: (name) => `Código de ${name}`,
    password: () => "Contraseña de dos pasos, si la hay",
    token: () => "Pegar el token",
    browser: () => "Aprobar en el navegador",
    history: () => "Recibir los chats recientes",
    check: () => "Comprobar la contraseña",
    done: () => "Listo",
  },
  method: {
    qr: "Iniciar sesión con un código QR",
    phone: "Iniciar sesión con tu número de teléfono",
    token: "Iniciar sesión con un token",
    browser: "Iniciar sesión en el navegador",
  },
  progress: (at, total) => `Paso ${at} de ${total}`,
  needHeading: "Ten a mano",
  need: {
    tg: ["Tu teléfono con Telegram.", "Tu contraseña de dos pasos, si la configuraste."],
    "max:qr": ["Tu teléfono con la app de MAX.", "Tu contraseña en la nube de MAX, si la configuraste."],
    "max:token": ["Un navegador en este equipo con la sesión iniciada en web.max.ru."],
    wa: ["Tu teléfono con WhatsApp, desbloqueado y conectado hasta que lleguen los chats."],
    zm: [
      "Tu usuario de Zoom.",
      "La primera vez: unos diez minutos para crear tu app de Zoom. Los pasos se muestran aquí, con botones para copiar cada valor.",
    ],
    drive: ["Tu usuario de Google."],
    gcal: ["Tu usuario de Google."],
    "email:microsoft": ["Tu dirección de correo y tu usuario de Microsoft."],
    "email:gmail": [
      "Tu dirección de Gmail.",
      "Una contraseña de aplicación. Google solo la ofrece con la verificación en dos pasos activada.",
    ],
    "email:imap": ["Tu dirección de correo.", "Una contraseña de aplicación de los ajustes de tu servicio de correo."],
  },
  failure: {
    needsUpdate: {
      title: (name) => `Esta versión de ${name} no puede iniciar sesión dentro de WireCat.`,
      cause: () =>
        "Es anterior al inicio de sesión en esta ventana. Actualizar tarda un minuto; mientras tanto, la terminal funciona.",
    },
    qrExpired: {
      title: () => "El código QR caducó antes de escanearlo.",
      cause: () =>
        "Cada código vale poco tiempo. Empieza de nuevo para obtener otro y escanéalo dentro del tiempo indicado.",
    },
    loginInUse: {
      title: (name) => `${name} está ocupado recibiendo mensajes en segundo plano.`,
      cause: (name) =>
        `${name} permite una sola conexión por dispositivo vinculado. Detén el servicio en segundo plano en la página de ${name} y vuelve a iniciar sesión.`,
    },
    clientIdMissing: {
      title: () => "Zoom necesita primero una app tuya.",
      cause: () => "Créala una vez con los pasos de abajo.",
    },
    browserNoReturn: {
      title: () => "El navegador no volvió a WireCat.",
      cause: (name) =>
        `Puede que la página siga abierta o que la bloquee un bloqueador de ventanas emergentes. Empieza de nuevo; si el navegador acaba en una página de error, copia su dirección y pégala en el campo que muestra ${name}.`,
    },
    denied: {
      title: () => "No se permitió el acceso.",
      cause: (name) =>
        `La página del navegador se cerró o se rechazó. Empieza de nuevo y elige Permitir para iniciar sesión en ${name}.`,
    },
    timeout: {
      title: () => "El inicio de sesión esperó demasiado y se detuvo.",
      cause: () => "Ningún paso terminó a tiempo. Empieza de nuevo cuando tengas el teléfono o el navegador a mano.",
    },
    network: {
      title: (name) => `${name} no pudo conectar con su servicio.`,
      cause: () =>
        "Parece que este equipo no tiene conexión, o un cortafuegos o VPN la bloquea. Revísalo y vuelve a intentarlo.",
    },
    cancelled: {
      title: () => "Se detuvo el inicio de sesión.",
      cause: () => "No se guardó nada. Empieza de nuevo cuando quieras.",
    },
    ended: {
      title: (name) => `${name} se detuvo sin decir por qué.`,
      cause: () =>
        "Vuelve a intentarlo. Si se repite, infórmalo: el informe lleva lo que dijo la herramienta, nunca un código.",
    },
    unknown: {
      title: (name) => `${name} no pudo terminar el inicio de sesión.`,
      cause: () => "Lo que dijo la herramienta está en Detalles. Vuelve a intentarlo o infórmalo si se repite.",
    },
  },
  actions: {
    retry: "Reintentar",
    newCode: "Mostrar un código nuevo",
    update: (name) => `Abrir ${name} para actualizar`,
    toolPage: (name) => `Abrir ${name}`,
    copy: "Copiar el comando para detenerlo",
  },
  details: "Detalles",
  token: {
    title: "Copia tu token de MAX desde la versión web",
    steps: [
      "Abre web.max.ru en Chrome, Edge, Firefox o Brave en este equipo e inicia sesión allí.",
      "Abre las herramientas de desarrollo: F12, o Ctrl+Mayús+I (⌥⌘I en Mac).",
      "Chrome y Edge: Application → Local storage → https://web.max.ru. Firefox: Almacenamiento → Almacenamiento local.",
      "Busca la clave __oneme_auth y copia su valor entero. Pégalo abajo tal cual: WireCat envía solo el token que contiene.",
    ],
    open: "Abrir web.max.ru",
    empty: "Pega primero el valor de __oneme_auth.",
  },
  zoom: {
    title: "Crea tu app de Zoom",
    lead: "Zoom solo deja entrar a un programa a través de una app que registras en el Zoom App Marketplace. Se hace una vez. Marca cada paso al terminarlo.",
    done: (n, total) => `${n} de ${total} hechos`,
    steps: [
      "Abre el Zoom App Marketplace e inicia sesión. Elige Develop → Build App → General App y luego Create.",
      "Ponle un nombre, por ejemplo Mi archivo de reuniones, y elige User-managed.",
      "Quédate en el entorno Development. En Basic Information → App Credentials, activa Use Public Client OAuth.",
      "En OAuth Information, pega esta dirección en OAuth Redirect URL y en OAuth Allow Lists. Sin barra al final.",
      "En Scopes, elige Add Scopes y añade estos cinco:",
      "En Local Test, elige Add App Now y permite el acceso.",
      "Copia el Public Client ID de Basic Information → App Credentials y pégalo abajo. No el Client ID ni el Client Secret.",
    ],
    openMarketplace: "Abrir el Marketplace",
    copyRedirect: "Copiar la dirección de redirección",
    copyScope: (scope) => `Copiar ${scope}`,
    copyScopes: "Copiar los cinco",
    guide: "La guía con imágenes",
  },
  noApp: {
    summary: "¿Sin app de Zoom? Usa archivos de transcripción",
    text: "Zoom también puede leer las transcripciones .vtt que descargas o te pasa el anfitrión, sin app y sin iniciar sesión. Ponlas en una carpeta, con nombres como 2026-10-01_1000_planning.vtt. Cada sincronización lee entonces esa carpeta en lugar de tu cuenta de Zoom.",
    folder: "Carpeta con los archivos .vtt",
    folderHint: "La ruta completa, por ejemplo /home/tu/Zoom transcripts. No se leen las subcarpetas.",
    timezone: "Zona horaria de las horas en los nombres de archivo",
    save: "Usar estos archivos",
    saving: "Guardando…",
    needFolder: "Escribe primero la ruta de la carpeta.",
    saved: (folder) => `Zoom lee ahora las transcripciones de ${folder}. Sincroniza para importarlas.`,
    back: "Usar mi cuenta de Zoom",
  },
  next: {
    sync: "Sincronizar ahora",
    syncLead: (name) =>
      `${name} está listo. La primera sincronización copia tus datos a este equipo para que tu agente pueda buscar en ellos.`,
  },
}

export const wizardMessages: Messages<WizardText> = { en, ru, es }

export const needFor = (m: WizardText, tool: string, method: string | null) =>
  m.need[`${tool}:${method}`] ?? m.need[tool] ?? []
