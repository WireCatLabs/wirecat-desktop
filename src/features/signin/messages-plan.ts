import type { Messages } from "@/i18n"

/**
 * What each sign-in will ask and what happens to it. Every claim is the tool's own behaviour, checked in its source
 * (2026-11-02): tg-cli `src/telegram/credentials.ts` (app keys in the keyring, else a file in its config folder),
 * `storage.ts` (the session file), `session.ts` (the questions, the phone asked once; the password is never written),
 * mtcute's `checkPassword` (Telegram gets an SRP proof, not the password); max-cli `session.ts` (two minutes for the
 * scan); tg-cli's postinstall note ("allow about five minutes"). Files are 0600, which binds only on macOS and Linux,
 * so the text does not promise that only the owner can read them. A tool without an entry shows only the steps and WireCat's own line.
 * Mail, Calendar and Drive (2026-11-05): mail-cli 0.14 `src/oauth.ts` (the scopes and what they allow, WireCat's
 * Microsoft app, no WireCat Google app yet), `src/providers.ts` (Outlook.com's IMAP switch, Gmail's app password),
 * `session start` (the server found from the address, the domain alone sent to DNS and autoconfig, the password
 * checked before it is saved); gcal 0.19 and drive 0.59 ask for `calendar.readonly` and `drive.readonly`, and keep the
 * owner's client with the sign-in; zoom-cli `docs/zoom-app.md` (no WireCat Zoom app, the Public Client ID).
 */
/**
 * `appKeys`: the steps open with making the owner's own app keys (`messages-telegram.ts`), the first time only.
 * `guide`: a page with the provider's own steps. `own`: what "Use my own app" means for this sign-in, and its guide.
 */
type Plan = {
  steps: string[]
  time?: string
  kept?: string[]
  appKeys?: boolean
  guide?: { url: string; label: string }
  own?: { text: string; guide?: string }
}

const PROVIDERS_GUIDE = "https://wirecat.dev/en/docs/mail/providers"
const MICROSOFT_APP_GUIDE = "https://wirecat.dev/en/docs/mail/oauth-microsoft"
const GOOGLE_APP_GUIDE = "https://wirecat.dev/en/docs/mail/oauth-google"
const GOOGLE_PASSWORDS = "https://myaccount.google.com/apppasswords"
const ZOOM_APP_GUIDE = "https://wirecat.dev/en/docs/zm/zoom-app"

const en = {
  what: "What happens",
  time: "How long",
  kept: "What happens to what you share",
  start: "Start sign-in",
  wirecat: "WireCat keeps no copy: what you type goes straight to the tool on this computer.",
  pick: "Where is your mail?",
  providers: {
    microsoft: { name: "Microsoft", detail: "Outlook.com, Hotmail, Live and Microsoft 365" },
    gmail: { name: "Gmail", detail: "Gmail and Google Workspace" },
    imap: { name: "Another mail server", detail: "Yandex, iCloud, Mail.ru, Fastmail, a domain of your own…" },
  } as Record<string, { name: string; detail: string }>,
  address: "Mail address",
  password: "App password",
  needAddress: "Type the mail address first.",
  needPassword: "Paste the app password first, or use your own app below.",
  ownApp: "Use my own app",
  ownGuide: "How to make the app",
  clientFile: "Choose the client file",
  clientFileOther: "Choose another file",
  clientFileChosen: (name: string) => `Chosen: ${name}. It is read once, when you sign in.`,
  clientFileUnreadable: "This file could not be read. Choose the JSON file you downloaded.",
  clientFileDrop: "Remove",
  clientId: "Application (client) ID",
  clientIdHint: "Leave it empty to sign in with WireCat's app.",
  noWireCatApp: (name: string) =>
    `This version of ${name} has no WireCat app for Google yet. Sign in with a Google app of your own: choose its client file.`,
  plans: {
    "tg:qr": {
      appKeys: true,
      steps: [
        "Scan a QR code in Telegram on your phone: Settings → Devices → Link Desktop Device.",
        "If your account has two-step verification: its password.",
      ],
      time: "Allow about five minutes.",
      kept: [
        "Your phone number and the codes go only to Telegram.",
        "The two-step password is never saved. Telegram receives only a proof made from it, not the password itself.",
        "The app keys (api_id and api_hash) are saved in your system's password store, or in the tool's own folder when there is none, so you are not asked again.",
        "The sign-in itself is saved on this computer, in the tool's own folder.",
      ],
    },
    "tg:phone": {
      appKeys: true,
      steps: ["The login code Telegram sends.", "If your account has two-step verification: its password."],
      time: "Allow about five minutes.",
      kept: [
        "Your phone number and the codes go only to Telegram.",
        "The two-step password is never saved. Telegram receives only a proof made from it, not the password itself.",
        "The app keys (api_id and api_hash) are saved in your system's password store, or in the tool's own folder when there is none, so you are not asked again.",
        "The sign-in itself is saved on this computer, in the tool's own folder.",
      ],
    },
    wa: {
      steps: [
        "Scan a QR code in WhatsApp on your phone: Settings → Linked devices → Link a device.",
        "WhatsApp then sends your recent chats to this computer. Keep it open on the phone until it is done.",
      ],
      kept: ["Nothing to type: the phone and WhatsApp confirm it is you."],
    },
    max: {
      steps: ["Scan a QR code with the MAX app on your phone."],
      time: "The code waits up to two minutes for the scan.",
      kept: ["Nothing to type: the phone and MAX confirm it is you."],
    },
    zm: {
      steps: [
        "The first time: an app of your own in the Zoom App Marketplace. Zoom lets a program in only through such an app, and it has not approved a WireCat app for everyone yet. You make it once; the guide shows each screen.",
        "Paste its Public Client ID here when asked. Not the Client ID or the Client Secret: the tool uses neither.",
        "Your browser opens Zoom to approve access. You approve it there, not here.",
      ],
      guide: { url: ZOOM_APP_GUIDE, label: "How to make the Zoom app" },
      kept: [
        "Your Zoom password is typed only on Zoom's own page.",
        "The tool can do only what you allow when you make the app. The guide lists the five permissions that read your meetings, transcripts and summaries.",
      ],
    },
    drive: {
      steps: ["Your browser opens Google: choose the account and allow read-only access to Drive, with WireCat's app."],
      kept: [
        "Your Google password is typed only on Google's own page.",
        "Read-only: the tool cannot change your files. The folders you choose are copied to this computer only.",
        "The sign-in is saved in your system's password store, or in the tool's own folder when there is none.",
      ],
      own: {
        text: "Sign in with a Google app of your own instead of WireCat's: a Desktop app client from Google Cloud Console. Choose its JSON file. The tool keeps the client with the sign-in, so the file is not needed again.",
      },
    },
    gcal: {
      steps: [
        "Your browser opens Google: choose the account and allow read-only access to Calendar, with WireCat's app.",
      ],
      kept: [
        "Your Google password is typed only on Google's own page.",
        "Read-only: the tool cannot change your calendar. Your events are copied to this computer only.",
        "The sign-in is saved in your system's password store, or in the tool's own folder when there is none.",
      ],
      own: {
        text: "Sign in with a Google app of your own instead of WireCat's: a Desktop app client from Google Cloud Console. Choose its JSON file. The tool keeps the client with the sign-in, so the file is not needed again.",
      },
    },
    "email:microsoft": {
      steps: [
        "Type your mail address. The server is found from it.",
        "Outlook.com, Hotmail and Live only: turn on IMAP first. In Outlook on the web open Settings → Mail → Forwarding and IMAP, turn on Let devices and apps use IMAP, and save.",
        "Your browser opens Microsoft. Sign in there and allow access for WireCat's app.",
      ],
      kept: [
        "Your Microsoft password is typed only on Microsoft's own page.",
        "Microsoft asks for three things: to stay signed in, so a sync needs no new sign-in; to read and change your mail; to send mail as you. A sync only reads. Mail is sent only when you or your agent ask for it.",
        "Your mail is copied to this computer only. A sync never changes your mailbox.",
        "The sign-in is saved in your system's password store, or in the tool's own folder when there is none.",
      ],
      own: {
        text: "If your organisation does not allow WireCat's app, register a Microsoft app of your own and paste its Application (client) ID here. It is saved for this profile only.",
        guide: MICROSOFT_APP_GUIDE,
      },
    },
    "email:gmail": {
      steps: [
        "Type your Gmail address.",
        "Make an app password: a password made only for this program. Turn on 2-Step Verification in your Google Account, then open myaccount.google.com/apppasswords and create one.",
        "Paste the 16-character app password here. It is checked with Gmail before anything is saved.",
      ],
      guide: { url: GOOGLE_PASSWORDS, label: "Open Google app passwords" },
      kept: [
        "Your Google password stays with you: the program never sees it. You can delete the app password in your Google Account at any time, and the program then loses access.",
        "Your mail is copied to this computer only. A sync never changes your mailbox.",
        "The app password is saved in your system's password store, or in the tool's own folder when there is none.",
      ],
      own: {
        text: "To sign in with Google in the browser instead of an app password, choose the JSON file of a Desktop app client of your own from Google Cloud Console. WireCat has no Google app for mail yet. Google then asks to read, change and send your Gmail: it has no narrower access for mail programs.",
        guide: GOOGLE_APP_GUIDE,
      },
    },
    "email:imap": {
      steps: [
        "Type your mail address. The server is found from it. For a domain the tool does not know, only the domain, never the whole address, goes to DNS and to the public lists of mail servers.",
        "Make an app password in your mail service's settings: a password made only for this program. Your main password stays secret, and you can delete the app password at any time. Some services also need IMAP turned on.",
        "Paste the app password here. It is checked with the server before anything is saved.",
      ],
      guide: { url: PROVIDERS_GUIDE, label: "Steps for Yandex, iCloud, Mail.ru and others" },
      kept: [
        "Your mail is copied to this computer only. A sync never changes your mailbox.",
        "The app password is saved in your system's password store, or in the tool's own folder when there is none.",
      ],
    },
  } as Record<string, Plan>,
}

export type PlanText = typeof en

const TG_RU: Plan = {
  appKeys: true,
  steps: [
    "Отсканируйте QR-код в Telegram на телефоне: Настройки → Устройства → Подключить устройство.",
    "Если включена двухэтапная проверка — её пароль.",
  ],
  time: "Заложите около пяти минут.",
  kept: [
    "Номер телефона и коды уходят только в Telegram.",
    "Пароль двухэтапной проверки нигде не сохраняется. Telegram получает только доказательство, вычисленное из него, а не сам пароль.",
    "Ключи приложения (api_id и api_hash) сохраняются в системном хранилище паролей, а если его нет — в папке самого инструмента, чтобы не спрашивать их снова.",
    "Сам вход сохраняется на этом компьютере, в папке самого инструмента.",
  ],
}

const ru: PlanText = {
  what: "Что будет",
  time: "Сколько займёт",
  kept: "Что происходит с тем, что вы вводите",
  start: "Начать вход",
  wirecat: "WireCat не хранит копий: всё, что вы вводите, идёт прямо в инструмент на этом компьютере.",
  pick: "Где ваша почта?",
  providers: {
    microsoft: { name: "Microsoft", detail: "Outlook.com, Hotmail, Live и Microsoft 365" },
    gmail: { name: "Gmail", detail: "Gmail и Google Workspace" },
    imap: { name: "Другой почтовый сервер", detail: "Яндекс, iCloud, Mail.ru, Fastmail, свой домен…" },
  },
  address: "Адрес почты",
  password: "Пароль приложения",
  needAddress: "Сначала введите адрес почты.",
  needPassword: "Сначала вставьте пароль приложения или выберите своё приложение ниже.",
  ownApp: "Использовать своё приложение",
  ownGuide: "Как создать приложение",
  clientFile: "Выбрать файл клиента",
  clientFileOther: "Выбрать другой файл",
  clientFileChosen: (name) => `Выбран: ${name}. Он читается один раз, при входе.`,
  clientFileUnreadable: "Не удалось прочитать файл. Выберите скачанный JSON-файл.",
  clientFileDrop: "Убрать",
  clientId: "Application (client) ID",
  clientIdHint: "Оставьте пустым, чтобы войти через приложение WireCat.",
  noWireCatApp: (name) =>
    `В этой версии ${name} ещё нет приложения WireCat для Google. Войдите через своё приложение Google: выберите файл его клиента.`,
  plans: {
    "tg:qr": TG_RU,
    "tg:phone": {
      ...TG_RU,
      steps: ["Код входа, который пришлёт Telegram.", TG_RU.steps[1] ?? ""],
    },
    wa: {
      steps: [
        "Отсканируйте QR-код в WhatsApp на телефоне: Настройки → Связанные устройства → Привязка устройства.",
        "Затем WhatsApp отправит недавние чаты на этот компьютер. Не закрывайте его на телефоне, пока это не закончится.",
      ],
      kept: ["Вводить ничего не нужно: телефон и WhatsApp сами подтверждают, что это вы."],
    },
    max: {
      steps: ["Отсканируйте QR-код приложением MAX на телефоне."],
      time: "Код ждёт сканирования до двух минут.",
      kept: ["Вводить ничего не нужно: телефон и MAX сами подтверждают, что это вы."],
    },
    zm: {
      steps: [
        "В первый раз: своё приложение в Zoom App Marketplace. Zoom пускает программу только через такое приложение, а приложение WireCat для всех ещё не одобрил. Вы создаёте его один раз; в инструкции показан каждый экран.",
        "Когда спросят, вставьте его Public Client ID. Не Client ID и не Client Secret: инструмент не использует ни то, ни другое.",
        "Браузер откроет Zoom, чтобы разрешить доступ. Разрешаете вы там, а не здесь.",
      ],
      guide: { url: ZOOM_APP_GUIDE, label: "Как создать приложение Zoom" },
      kept: [
        "Пароль от Zoom вводится только на странице самого Zoom.",
        "Инструмент может только то, что вы разрешите при создании приложения. В инструкции перечислены пять разрешений, чтобы читать встречи, расшифровки и итоги.",
      ],
    },
    drive: {
      steps: [
        "Браузер откроет Google: выберите аккаунт и разрешите приложению WireCat доступ к Диску только для чтения.",
      ],
      kept: [
        "Пароль от Google вводится только на странице самого Google.",
        "Только чтение: инструмент не может изменить ваши файлы. Выбранные папки копируются только на этот компьютер.",
        "Вход сохраняется в системном хранилище паролей, а если его нет — в папке самого инструмента.",
      ],
      own: {
        text: "Войдите через своё приложение Google вместо приложения WireCat: клиент типа Desktop app из Google Cloud Console. Выберите его JSON-файл. Инструмент хранит клиента вместе со входом, так что файл больше не понадобится.",
      },
    },
    gcal: {
      steps: [
        "Браузер откроет Google: выберите аккаунт и разрешите приложению WireCat доступ к Календарю только для чтения.",
      ],
      kept: [
        "Пароль от Google вводится только на странице самого Google.",
        "Только чтение: инструмент не может изменить ваш календарь. События копируются только на этот компьютер.",
        "Вход сохраняется в системном хранилище паролей, а если его нет — в папке самого инструмента.",
      ],
      own: {
        text: "Войдите через своё приложение Google вместо приложения WireCat: клиент типа Desktop app из Google Cloud Console. Выберите его JSON-файл. Инструмент хранит клиента вместе со входом, так что файл больше не понадобится.",
      },
    },
    "email:microsoft": {
      steps: [
        "Введите адрес почты. Сервер найдётся по нему.",
        "Только Outlook.com, Hotmail и Live: сначала включите IMAP. В Outlook в браузере откройте Settings → Mail → Forwarding and IMAP (так в английском интерфейсе), включите Let devices and apps use IMAP и сохраните.",
        "Браузер откроет Microsoft. Войдите там и разрешите доступ приложению WireCat.",
      ],
      kept: [
        "Пароль от Microsoft вводится только на странице самого Microsoft.",
        "Microsoft попросит три разрешения: оставаться в системе, чтобы синхронизация не требовала нового входа; читать и изменять почту; отправлять письма от вашего имени. Синхронизация только читает. Письмо уходит, только когда об этом попросите вы или ваш агент.",
        "Почта копируется только на этот компьютер. Синхронизация никогда не меняет ваш ящик.",
        "Вход сохраняется в системном хранилище паролей, а если его нет — в папке самого инструмента.",
      ],
      own: {
        text: "Если ваша организация не разрешает приложение WireCat, зарегистрируйте своё приложение Microsoft и вставьте сюда его Application (client) ID. Он сохранится только для этого профиля.",
        guide: MICROSOFT_APP_GUIDE,
      },
    },
    "email:gmail": {
      steps: [
        "Введите адрес Gmail.",
        "Создайте пароль приложения — отдельный пароль только для этой программы. Включите двухэтапную аутентификацию в аккаунте Google, затем откройте myaccount.google.com/apppasswords и создайте пароль.",
        "Вставьте сюда пароль приложения из 16 символов. Он проверяется в Gmail до того, как что-то сохранится.",
      ],
      guide: { url: GOOGLE_PASSWORDS, label: "Открыть пароли приложений Google" },
      kept: [
        "Пароль от Google остаётся у вас: программа его не видит. Пароль приложения можно удалить в аккаунте Google в любой момент — тогда программа потеряет доступ.",
        "Почта копируется только на этот компьютер. Синхронизация никогда не меняет ваш ящик.",
        "Пароль приложения сохраняется в системном хранилище паролей, а если его нет — в папке самого инструмента.",
      ],
      own: {
        text: "Чтобы входить через Google в браузере, а не по паролю приложения, выберите JSON-файл своего клиента типа Desktop app из Google Cloud Console. Своего приложения Google для почты у WireCat пока нет. Google попросит разрешение читать, изменять и отправлять почту Gmail: более узкого доступа для почтовых программ у него нет.",
        guide: GOOGLE_APP_GUIDE,
      },
    },
    "email:imap": {
      steps: [
        "Введите адрес почты. Сервер найдётся по нему. Для незнакомого домена в DNS и в открытые списки почтовых серверов уходит только домен, а не весь адрес.",
        "Создайте пароль приложения в настройках почты — отдельный пароль только для этой программы. Основной пароль остаётся в секрете, а пароль приложения можно удалить в любой момент. В некоторых сервисах нужно ещё включить IMAP.",
        "Вставьте сюда пароль приложения. Он проверяется на сервере до того, как что-то сохранится.",
      ],
      guide: { url: PROVIDERS_GUIDE, label: "Шаги для Яндекса, iCloud, Mail.ru и других" },
      kept: [
        "Почта копируется только на этот компьютер. Синхронизация никогда не меняет ваш ящик.",
        "Пароль приложения сохраняется в системном хранилище паролей, а если его нет — в папке самого инструмента.",
      ],
    },
  },
}

const TG_ES: Plan = {
  appKeys: true,
  steps: [
    "Escanea un código QR en Telegram en el teléfono: Ajustes → Dispositivos → Vincular dispositivo.",
    "Si tu cuenta tiene verificación en dos pasos: su contraseña.",
  ],
  time: "Cuenta con unos cinco minutos.",
  kept: [
    "Tu número y los códigos solo van a Telegram.",
    "La contraseña de dos pasos nunca se guarda. Telegram recibe solo una prueba calculada a partir de ella, no la contraseña.",
    "Las claves de la aplicación (api_id y api_hash) se guardan en el almacén de contraseñas del sistema, o en la carpeta de la propia herramienta si no hay ninguno, para no volver a pedirlas.",
    "El inicio de sesión se guarda en este equipo, en la carpeta de la propia herramienta.",
  ],
}

const es: PlanText = {
  what: "Qué va a pasar",
  time: "Cuánto tarda",
  kept: "Qué pasa con lo que compartes",
  start: "Empezar",
  wirecat: "WireCat no guarda copia: lo que escribes va directo a la herramienta en este equipo.",
  pick: "¿Dónde está tu correo?",
  providers: {
    microsoft: { name: "Microsoft", detail: "Outlook.com, Hotmail, Live y Microsoft 365" },
    gmail: { name: "Gmail", detail: "Gmail y Google Workspace" },
    imap: { name: "Otro servidor de correo", detail: "Yandex, iCloud, Mail.ru, Fastmail, un dominio propio…" },
  },
  address: "Dirección de correo",
  password: "Contraseña de aplicación",
  needAddress: "Escribe primero la dirección de correo.",
  needPassword: "Pega primero la contraseña de aplicación, o usa tu propia app abajo.",
  ownApp: "Usar mi propia app",
  ownGuide: "Cómo crear la app",
  clientFile: "Elegir el archivo del cliente",
  clientFileOther: "Elegir otro archivo",
  clientFileChosen: (name) => `Elegido: ${name}. Se lee una vez, al iniciar sesión.`,
  clientFileUnreadable: "No se pudo leer el archivo. Elige el JSON que descargaste.",
  clientFileDrop: "Quitar",
  clientId: "Application (client) ID",
  clientIdHint: "Déjalo vacío para entrar con la app de WireCat.",
  noWireCatApp: (name) =>
    `Esta versión de ${name} aún no tiene app de WireCat para Google. Entra con una app de Google propia: elige el archivo de su cliente.`,
  plans: {
    "tg:qr": TG_ES,
    "tg:phone": {
      ...TG_ES,
      steps: ["El código de inicio de sesión que envía Telegram.", TG_ES.steps[1] ?? ""],
    },
    wa: {
      steps: [
        "Escanea un código QR en WhatsApp en el teléfono: Ajustes → Dispositivos vinculados → Vincular un dispositivo.",
        "Después WhatsApp envía tus chats recientes a este equipo. Mantenlo abierto en el teléfono hasta que termine.",
      ],
      kept: ["No hay que escribir nada: el teléfono y WhatsApp confirman que eres tú."],
    },
    max: {
      steps: ["Escanea un código QR con la app MAX en el teléfono."],
      time: "El código espera el escaneo hasta dos minutos.",
      kept: ["No hay que escribir nada: el teléfono y MAX confirman que eres tú."],
    },
    zm: {
      steps: [
        "La primera vez: una app propia en Zoom App Marketplace. Zoom solo deja entrar a un programa a través de una app así, y aún no ha aprobado una app de WireCat para todos. La creas una vez; la guía muestra cada pantalla.",
        "Cuando se pida, pega su Public Client ID. No el Client ID ni el Client Secret: la herramienta no usa ninguno.",
        "El navegador abre Zoom para aprobar el acceso. Lo apruebas allí, no aquí.",
      ],
      guide: { url: ZOOM_APP_GUIDE, label: "Cómo crear la app de Zoom" },
      kept: [
        "Tu contraseña de Zoom solo se escribe en la propia página de Zoom.",
        "La herramienta solo puede hacer lo que permitas al crear la app. La guía lista los cinco permisos para leer reuniones, transcripciones y resúmenes.",
      ],
    },
    drive: {
      steps: [
        "El navegador abre Google: elige la cuenta y permite a la app de WireCat acceso de solo lectura a Drive.",
      ],
      kept: [
        "Tu contraseña de Google solo se escribe en la propia página de Google.",
        "Solo lectura: la herramienta no puede cambiar tus archivos. Las carpetas que elijas se copian solo a este equipo.",
        "El inicio de sesión se guarda en el almacén de contraseñas del sistema, o en la carpeta de la propia herramienta si no hay ninguno.",
      ],
      own: {
        text: "Entra con una app de Google propia en lugar de la de WireCat: un cliente Desktop app de Google Cloud Console. Elige su archivo JSON. La herramienta guarda el cliente con el inicio de sesión, así que el archivo no hace falta otra vez.",
      },
    },
    gcal: {
      steps: [
        "El navegador abre Google: elige la cuenta y permite a la app de WireCat acceso de solo lectura a Calendar.",
      ],
      kept: [
        "Tu contraseña de Google solo se escribe en la propia página de Google.",
        "Solo lectura: la herramienta no puede cambiar tu calendario. Tus eventos se copian solo a este equipo.",
        "El inicio de sesión se guarda en el almacén de contraseñas del sistema, o en la carpeta de la propia herramienta si no hay ninguno.",
      ],
      own: {
        text: "Entra con una app de Google propia en lugar de la de WireCat: un cliente Desktop app de Google Cloud Console. Elige su archivo JSON. La herramienta guarda el cliente con el inicio de sesión, así que el archivo no hace falta otra vez.",
      },
    },
    "email:microsoft": {
      steps: [
        "Escribe tu dirección de correo. El servidor se encuentra a partir de ella.",
        "Solo Outlook.com, Hotmail y Live: activa IMAP primero. En Outlook en la web abre Settings → Mail → Forwarding and IMAP (así en la interfaz en inglés), activa Let devices and apps use IMAP y guarda.",
        "El navegador abre Microsoft. Inicia sesión allí y permite el acceso a la app de WireCat.",
      ],
      kept: [
        "Tu contraseña de Microsoft solo se escribe en la propia página de Microsoft.",
        "Microsoft pide tres cosas: mantener la sesión, para que la sincronización no pida entrar de nuevo; leer y cambiar tu correo; enviar correo en tu nombre. La sincronización solo lee. Un correo se envía solo cuando tú o tu agente lo pedís.",
        "Tu correo se copia solo a este equipo. La sincronización nunca cambia tu buzón.",
        "El inicio de sesión se guarda en el almacén de contraseñas del sistema, o en la carpeta de la propia herramienta si no hay ninguno.",
      ],
      own: {
        text: "Si tu organización no permite la app de WireCat, registra una app de Microsoft propia y pega aquí su Application (client) ID. Se guarda solo para este perfil.",
        guide: MICROSOFT_APP_GUIDE,
      },
    },
    "email:gmail": {
      steps: [
        "Escribe tu dirección de Gmail.",
        "Crea una contraseña de aplicación: una contraseña solo para este programa. Activa la verificación en dos pasos en tu cuenta de Google, abre myaccount.google.com/apppasswords y crea una.",
        "Pega aquí la contraseña de aplicación de 16 caracteres. Se comprueba con Gmail antes de guardar nada.",
      ],
      guide: { url: GOOGLE_PASSWORDS, label: "Abrir las contraseñas de aplicación de Google" },
      kept: [
        "Tu contraseña de Google se queda contigo: el programa no la ve. Puedes borrar la contraseña de aplicación en tu cuenta de Google cuando quieras, y el programa pierde el acceso.",
        "Tu correo se copia solo a este equipo. La sincronización nunca cambia tu buzón.",
        "La contraseña de aplicación se guarda en el almacén de contraseñas del sistema, o en la carpeta de la propia herramienta si no hay ninguno.",
      ],
      own: {
        text: "Para entrar con Google en el navegador en lugar de con una contraseña de aplicación, elige el archivo JSON de un cliente Desktop app propio de Google Cloud Console. WireCat aún no tiene app de Google para el correo. Google pedirá leer, cambiar y enviar tu Gmail: no ofrece un acceso más limitado para programas de correo.",
        guide: GOOGLE_APP_GUIDE,
      },
    },
    "email:imap": {
      steps: [
        "Escribe tu dirección de correo. El servidor se encuentra a partir de ella. Para un dominio que la herramienta no conoce, solo el dominio, nunca la dirección entera, va al DNS y a las listas públicas de servidores de correo.",
        "Crea una contraseña de aplicación en los ajustes de tu correo: una contraseña solo para este programa. Tu contraseña principal sigue en secreto, y puedes borrar la de aplicación cuando quieras. Algunos servicios piden además activar IMAP.",
        "Pega aquí la contraseña de aplicación. Se comprueba con el servidor antes de guardar nada.",
      ],
      guide: { url: PROVIDERS_GUIDE, label: "Pasos para Yandex, iCloud, Mail.ru y otros" },
      kept: [
        "Tu correo se copia solo a este equipo. La sincronización nunca cambia tu buzón.",
        "La contraseña de aplicación se guarda en el almacén de contraseñas del sistema, o en la carpeta de la propia herramienta si no hay ninguno.",
      ],
    },
  },
}

export const planMessages: Messages<PlanText> = { en, ru, es }

export const planFor = (m: PlanText, tool: string, method: string | null): Plan | undefined =>
  m.plans[`${tool}:${method}`] ?? m.plans[tool]
