import { APP_PASSWORD_PAGES, type AppPasswordProvider } from "@/domain/mail-signin"
import type { Messages } from "@/i18n"

/**
 * Each provider's app password in the window's own steps. The labels quoted are mail-cli's (`src/providers.ts`, 0.20),
 * which checked them on the providers' help pages; the window names no screen label mail-cli does not.
 */
type Step = { text: string; open?: { url: string; label: string } }
type Guide = { name: string; title: string; notYours: string; steps: Step[]; notes: string[]; time: string }
type Way = { name: string; badge?: string; detail: string; needs: string; note?: string; time: string }

const en = {
  ways: {
    legend: "How do you want to sign in?",
    others: "Other ways",
    browser: {
      name: "Sign in with Google",
      badge: "Recommended",
      detail: "Approve on Google's own page in the browser.",
      needs: "Needs a Google client of your own: a Desktop app made in Google Cloud Console.",
      time: "About 15 minutes the first time.",
    },
    appPassword: {
      name: "App password",
      detail: "Works today with any personal Gmail.",
      needs: "Needs 2-Step Verification on your Google Account. A Google Workspace admin can turn app passwords off.",
      note: "Until Google verifies WireCat's app, this is the fastest way in.",
      time: "About 2 minutes.",
    },
  } as { legend: string; others: string } & Record<"appPassword" | "browser", Way>,
  guides: {
    gmail: {
      name: "Gmail",
      title: "Make an app password for Gmail",
      notYours: "Not your Google password: a separate 16-letter password Google makes for WireCat.",
      steps: [
        {
          text: "Open Google's app passwords page and sign in to your Google Account.",
          open: { url: APP_PASSWORD_PAGES.gmail, label: "Open Google app passwords" },
        },
        {
          text: "2-Step Verification must be on. If Google says the setting is not available, turn on 2-Step Verification first, then open the page again.",
        },
        { text: "Type WireCat as the app name and click Create." },
        { text: "Copy the 16-letter password Google shows, and paste it below. Spaces do not matter." },
      ],
      notes: [
        "Google offers no app passwords on some work or school accounts, with Advanced Protection, or when 2-Step Verification uses only security keys.",
      ],
      time: "About 2 minutes.",
    },
    yandex: {
      name: "Yandex",
      title: "Make an app password for Yandex Mail",
      notYours: "Not your Yandex password: a separate password Yandex makes for WireCat.",
      steps: [
        {
          text: "In the mail settings, under «Почтовые программы», turn on «С сервера imap.yandex.ru по протоколу IMAP» and «Пароли приложений и OAuth-токены», then save.",
          open: { url: APP_PASSWORD_PAGES.yandexImap, label: "Open the mail settings" },
        },
        {
          text: "In Yandex ID open «Безопасность» → «Пароли приложений» and create a password of the type «Почта», named WireCat.",
          open: { url: APP_PASSWORD_PAGES.yandex, label: "Open Yandex ID" },
        },
        { text: "Copy the password at once: Yandex shows it only once. Paste it below." },
      ],
      notes: ["A new app password can take 2 to 3 hours to start working."],
      time: "About 3 minutes.",
    },
    mailru: {
      name: "Mail.ru",
      title: "Make an app password for Mail.ru",
      notYours: "Not your Mail.ru password: a separate password Mail.ru makes for WireCat.",
      steps: [
        {
          text: "Open Mail.ru, then «Настройки» → «Все настройки» → «Безопасность» → «Пароли для внешних приложений».",
          open: { url: APP_PASSWORD_PAGES.mailru, label: "Open Mail.ru" },
        },
        { text: "Click «Создать», name it WireCat, choose «Полный доступ к Почте» and click «Продолжить»." },
        { text: "Copy the password: Mail.ru shows it only once. Paste it below." },
      ],
      notes: ["Mail.ru asks for a phone number linked to the mailbox first."],
      time: "About 3 minutes.",
    },
    icloud: {
      name: "iCloud",
      title: "Make an app password for iCloud Mail",
      notYours: "Not your Apple Account password: a separate password Apple makes for WireCat.",
      steps: [
        { text: "Two-factor authentication must be on for your Apple Account." },
        {
          text: "Sign in at account.apple.com and choose «Sign-In and Security» → «App-Specific Passwords».",
          open: { url: APP_PASSWORD_PAGES.icloud, label: "Open account.apple.com" },
        },
        { text: "Generate a password named WireCat, copy it, and paste it below." },
      ],
      notes: [],
      time: "About 3 minutes.",
    },
  } as Record<AppPasswordProvider, Guide>,
  field: "App password",
  fieldHint: (name: string) => `Checked with ${name} before anything is saved. WireCat keeps no copy.`,
  needPassword: "Paste the app password first.",
  back: "Back",
  signIn: "Sign in",
  next: "Continue",
  useBrowser: "Sign in with Google instead",
  refused: {
    "mail.app-password-required": {
      title: (name: string) => `${name} did not take that password: it needs an app password.`,
      cause: "Your account password does not work here. Make an app password with the steps below and paste it.",
    },
    "mail.login-refused": {
      title: (name: string) => `${name} refused the login.`,
      cause:
        "Most often the account password was pasted, or the app password was copied only in part. Make a new one and paste it.",
    },
  } as Record<string, { title: (name: string) => string; cause: string }>,
  details: "Details",
  client: {
    typed: "Enter client ID and secret",
    id: "Client ID",
    idHint: "Ends with .apps.googleusercontent.com.",
    idWrong: "This is not a Google client ID: it ends with .apps.googleusercontent.com.",
    secret: "Client secret",
    secretHint:
      "Both are on the client's page in Google Cloud Console. They go to the tool in a file only you can read.",
    missing: "Choose the client file, or type the client ID and secret.",
  },
  runtime: {
    notYours: "Not your account password: a separate app password made in your mail service's settings.",
    server: "Server",
  },
}

export type MailText = typeof en

const ru: MailText = {
  ways: {
    legend: "Как вы хотите войти?",
    others: "Другие способы",
    browser: {
      name: "Войти через Google",
      badge: "Рекомендуем",
      detail: "Подтвердить на странице Google в браузере.",
      needs: "Нужен свой клиент Google: приложение типа Desktop app в Google Cloud Console.",
      time: "Около 15 минут в первый раз.",
    },
    appPassword: {
      name: "Пароль приложения",
      detail: "Работает уже сейчас с любым личным Gmail.",
      needs:
        "Нужна включённая двухэтапная аутентификация в аккаунте Google. Администратор Google Workspace может отключить пароли приложений.",
      note: "Пока Google не проверил приложение WireCat, это самый быстрый способ войти.",
      time: "Около 2 минут.",
    },
  },
  guides: {
    gmail: {
      name: "Gmail",
      title: "Создайте пароль приложения для Gmail",
      notYours: "Это не пароль от Google, а отдельный пароль из 16 букв, который Google создаёт для WireCat.",
      steps: [
        {
          text: "Откройте страницу паролей приложений Google и войдите в аккаунт Google.",
          open: { url: APP_PASSWORD_PAGES.gmail, label: "Открыть пароли приложений Google" },
        },
        {
          text: "Двухэтапная аутентификация должна быть включена. Если Google пишет, что настройка недоступна, сначала включите двухэтапную аутентификацию, затем откройте страницу снова.",
        },
        { text: "Введите WireCat как название приложения и нажмите «Создать»." },
        { text: "Скопируйте пароль из 16 букв, который покажет Google, и вставьте его ниже. Пробелы не важны." },
      ],
      notes: [
        "Google не даёт паролей приложений на некоторых рабочих и учебных аккаунтах, с Расширенной защитой и когда двухэтапная аутентификация настроена только на электронные ключи.",
      ],
      time: "Около 2 минут.",
    },
    yandex: {
      name: "Яндекс",
      title: "Создайте пароль приложения для Яндекс Почты",
      notYours: "Это не пароль от Яндекса, а отдельный пароль, который Яндекс создаёт для WireCat.",
      steps: [
        {
          text: "В настройках почты, в разделе «Почтовые программы», включите «С сервера imap.yandex.ru по протоколу IMAP» и «Пароли приложений и OAuth-токены», затем сохраните.",
          open: { url: APP_PASSWORD_PAGES.yandexImap, label: "Открыть настройки почты" },
        },
        {
          text: "В Яндекс ID откройте «Безопасность» → «Пароли приложений» и создайте пароль типа «Почта» с названием WireCat.",
          open: { url: APP_PASSWORD_PAGES.yandex, label: "Открыть Яндекс ID" },
        },
        { text: "Сразу скопируйте пароль: Яндекс показывает его только один раз. Вставьте его ниже." },
      ],
      notes: ["Новый пароль приложения может начать работать только через 2–3 часа."],
      time: "Около 3 минут.",
    },
    mailru: {
      name: "Mail.ru",
      title: "Создайте пароль приложения для Mail.ru",
      notYours: "Это не пароль от Mail.ru, а отдельный пароль, который Mail.ru создаёт для WireCat.",
      steps: [
        {
          text: "Откройте Mail.ru, затем «Настройки» → «Все настройки» → «Безопасность» → «Пароли для внешних приложений».",
          open: { url: APP_PASSWORD_PAGES.mailru, label: "Открыть Mail.ru" },
        },
        {
          text: "Нажмите «Создать», назовите пароль WireCat, выберите «Полный доступ к Почте» и нажмите «Продолжить».",
        },
        { text: "Скопируйте пароль: Mail.ru показывает его только один раз. Вставьте его ниже." },
      ],
      notes: ["Сначала Mail.ru попросит привязать к ящику номер телефона."],
      time: "Около 3 минут.",
    },
    icloud: {
      name: "iCloud",
      title: "Создайте пароль приложения для почты iCloud",
      notYours: "Это не пароль Apple ID, а отдельный пароль, который Apple создаёт для WireCat.",
      steps: [
        { text: "Для Apple ID должна быть включена двухфакторная аутентификация." },
        {
          text: "Войдите на account.apple.com и откройте раздел входа и безопасности, затем пароли для приложений.",
          open: { url: APP_PASSWORD_PAGES.icloud, label: "Открыть account.apple.com" },
        },
        { text: "Создайте пароль с названием WireCat, скопируйте его и вставьте ниже." },
      ],
      notes: [],
      time: "Около 3 минут.",
    },
  },
  field: "Пароль приложения",
  fieldHint: (name) => `${name} проверит его до того, как что-то сохранится. WireCat не хранит копию.`,
  needPassword: "Сначала вставьте пароль приложения.",
  back: "Назад",
  signIn: "Войти",
  next: "Дальше",
  useBrowser: "Лучше войти через Google",
  refused: {
    "mail.app-password-required": {
      title: (name) => `${name} не принял этот пароль: нужен пароль приложения.`,
      cause: "Пароль от аккаунта здесь не подходит. Создайте пароль приложения по шагам ниже и вставьте его.",
    },
    "mail.login-refused": {
      title: (name) => `${name} не пустил с этим паролем.`,
      cause:
        "Чаще всего вставлен пароль от аккаунта или пароль приложения скопирован не целиком. Создайте новый и вставьте его.",
    },
  },
  details: "Подробности",
  client: {
    typed: "Ввести Client ID и secret",
    id: "Client ID",
    idHint: "Заканчивается на .apps.googleusercontent.com.",
    idWrong: "Это не Client ID Google: он заканчивается на .apps.googleusercontent.com.",
    secret: "Client secret",
    secretHint:
      "Оба значения есть на странице клиента в Google Cloud Console. Инструмент получит их в файле, который можете прочитать только вы.",
    missing: "Выберите файл клиента или введите Client ID и secret.",
  },
  runtime: {
    notYours: "Это не пароль от аккаунта, а отдельный пароль приложения из настроек вашей почты.",
    server: "Сервер",
  },
}

const es: MailText = {
  ways: {
    legend: "¿Cómo quieres entrar?",
    others: "Otras formas",
    browser: {
      name: "Entrar con Google",
      badge: "Recomendado",
      detail: "Apruebas en la propia página de Google, en el navegador.",
      needs: "Necesita un cliente de Google propio: una Desktop app creada en Google Cloud Console.",
      time: "Unos 15 minutos la primera vez.",
    },
    appPassword: {
      name: "Contraseña de aplicación",
      detail: "Funciona hoy con cualquier Gmail personal.",
      needs:
        "Necesita la verificación en dos pasos activada en tu cuenta de Google. El administrador de Google Workspace puede desactivar las contraseñas de aplicación.",
      note: "Mientras Google no verifique la app de WireCat, es la forma más rápida de entrar.",
      time: "Unos 2 minutos.",
    },
  },
  guides: {
    gmail: {
      name: "Gmail",
      title: "Crea una contraseña de aplicación para Gmail",
      notYours: "No es tu contraseña de Google: es otra, de 16 letras, que Google crea para WireCat.",
      steps: [
        {
          text: "Abre la página de contraseñas de aplicación de Google e inicia sesión en tu cuenta de Google.",
          open: { url: APP_PASSWORD_PAGES.gmail, label: "Abrir las contraseñas de aplicación de Google" },
        },
        {
          text: "La verificación en dos pasos tiene que estar activada. Si Google dice que el ajuste no está disponible, actívala primero y vuelve a abrir la página.",
        },
        { text: "Escribe WireCat como nombre de la aplicación y pulsa Crear." },
        { text: "Copia la contraseña de 16 letras que muestra Google y pégala abajo. Los espacios no importan." },
      ],
      notes: [
        "Google no ofrece contraseñas de aplicación en algunas cuentas de trabajo o de centro educativo, con la Protección avanzada o cuando la verificación en dos pasos usa solo llaves de seguridad.",
      ],
      time: "Unos 2 minutos.",
    },
    yandex: {
      name: "Yandex",
      title: "Crea una contraseña de aplicación para Yandex Mail",
      notYours: "No es tu contraseña de Yandex: es otra que Yandex crea para WireCat.",
      steps: [
        {
          text: "En los ajustes del correo, en «Почтовые программы», activa «С сервера imap.yandex.ru по протоколу IMAP» y «Пароли приложений и OAuth-токены», y guarda.",
          open: { url: APP_PASSWORD_PAGES.yandexImap, label: "Abrir los ajustes del correo" },
        },
        {
          text: "En Yandex ID abre «Безопасность» → «Пароли приложений» y crea una contraseña del tipo «Почта» llamada WireCat.",
          open: { url: APP_PASSWORD_PAGES.yandex, label: "Abrir Yandex ID" },
        },
        { text: "Cópiala en el momento: Yandex la muestra una sola vez. Pégala abajo." },
      ],
      notes: ["Una contraseña de aplicación nueva puede tardar de 2 a 3 horas en funcionar."],
      time: "Unos 3 minutos.",
    },
    mailru: {
      name: "Mail.ru",
      title: "Crea una contraseña de aplicación para Mail.ru",
      notYours: "No es tu contraseña de Mail.ru: es otra que Mail.ru crea para WireCat.",
      steps: [
        {
          text: "Abre Mail.ru y luego «Настройки» → «Все настройки» → «Безопасность» → «Пароли для внешних приложений».",
          open: { url: APP_PASSWORD_PAGES.mailru, label: "Abrir Mail.ru" },
        },
        { text: "Pulsa «Создать», llámala WireCat, elige «Полный доступ к Почте» y pulsa «Продолжить»." },
        { text: "Copia la contraseña: Mail.ru la muestra una sola vez. Pégala abajo." },
      ],
      notes: ["Mail.ru pide antes un número de teléfono vinculado al buzón."],
      time: "Unos 3 minutos.",
    },
    icloud: {
      name: "iCloud",
      title: "Crea una contraseña de aplicación para el correo de iCloud",
      notYours: "No es la contraseña de tu cuenta de Apple: es otra que Apple crea para WireCat.",
      steps: [
        { text: "La autenticación de doble factor tiene que estar activada en tu cuenta de Apple." },
        {
          text: "Inicia sesión en account.apple.com y elige «Sign-In and Security» → «App-Specific Passwords».",
          open: { url: APP_PASSWORD_PAGES.icloud, label: "Abrir account.apple.com" },
        },
        { text: "Genera una contraseña llamada WireCat, cópiala y pégala abajo." },
      ],
      notes: [],
      time: "Unos 3 minutos.",
    },
  },
  field: "Contraseña de aplicación",
  fieldHint: (name) => `Se comprueba con ${name} antes de guardar nada. WireCat no guarda ninguna copia.`,
  needPassword: "Pega primero la contraseña de aplicación.",
  back: "Atrás",
  signIn: "Entrar",
  next: "Continuar",
  useBrowser: "Mejor entrar con Google",
  refused: {
    "mail.app-password-required": {
      title: (name) => `${name} no aceptó esa contraseña: necesita una contraseña de aplicación.`,
      cause:
        "La contraseña de tu cuenta no sirve aquí. Crea una contraseña de aplicación con los pasos de abajo y pégala.",
    },
    "mail.login-refused": {
      title: (name) => `${name} rechazó el inicio de sesión.`,
      cause:
        "Casi siempre se pegó la contraseña de la cuenta, o la de aplicación solo en parte. Crea una nueva y pégala.",
    },
  },
  details: "Detalles",
  client: {
    typed: "Escribir el client ID y el secret",
    id: "Client ID",
    idHint: "Termina en .apps.googleusercontent.com.",
    idWrong: "No es un client ID de Google: termina en .apps.googleusercontent.com.",
    secret: "Client secret",
    secretHint:
      "Los dos están en la página del cliente en Google Cloud Console. La herramienta los recibe en un archivo que solo tú puedes leer.",
    missing: "Elige el archivo del cliente, o escribe el client ID y el secret.",
  },
  runtime: {
    notYours: "No es la contraseña de tu cuenta: es una contraseña de aplicación creada en los ajustes de tu correo.",
    server: "Servidor",
  },
}

export const mailMessages: Messages<MailText> = { en, ru, es }
