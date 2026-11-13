import type { PhoneProblem } from "@/domain/phone"
import type { KeyHint, KeyProblem, TelegramFailureKind } from "@/domain/telegram-signin"
import type { Messages } from "@/i18n"

type Parts = { hours: number; minutes: number; seconds: number }
type Explained = { cause: string; fix: string }
export type PhoneOs = "android" | "iphone"

/**
 * Telegram's own sign-in, in WireCat's words. The app steps follow tg's `session start` with `--app browser`, the
 * app's default: tg opens my.telegram.org/apps, then asks for App api_id and App api_hash (tg-cli
 * `src/commands/session.ts`). The form's rules are the ones my.telegram.org shows (2026-11-04). The password line was
 * checked in `signin.rs` (the answer goes to the tool's stdin and is wiped, never logged) and tg-cli (the password is
 * never written; mtcute's `checkPassword` sends Telegram an SRP proof, not the password).
 */
const en = {
  firstTime: "First time only",
  appSteps: [
    "Open my.telegram.org in the browser and sign in with your phone number. Telegram sends a code as a message in your Telegram app. Type it on the site, and never give it to anyone else.",
    'Open Development Tools and create an app. App title: at least 5 characters. Short name: 5 to 32 letters and digits. Platform: Desktop, for example. URL and description can stay empty. Do not use the word "Telegram" in the title or the short name. If you already have an app, skip this step.',
    "Copy App api_id and App api_hash and paste them here. The api_hash is a secret: keep it private. With these keys the tool reaches your account through your own app.",
  ],
  createWarning: {
    title: "Fill in the form carefully: Telegram blocks quickly",
    body: 'One refused attempt can lock you out of my.telegram.org/apps with "Too many attempts. Please try again later." Nothing can undo it but waiting. Telegram does not say for how long; people report from a few hours to about a day. Check each field against the rules above before you press Create application. If you see that error, close the page and come back later: every new try can make the wait longer.',
  },
  guideTitle: "Your own Telegram app keys",
  shots: {
    create: {
      alt: 'The "Create new application" form on my.telegram.org: App title, Short name, URL, Platform and Description.',
      caption: "The form for a new app",
    },
    credentials: {
      alt: "The Credentials card on my.telegram.org: App api_id, a number, and App api_hash, marked secret.",
      caption: "Where the keys are",
    },
  },
  enlarge: (caption: string) => `Enlarge: ${caption}`,
  copyLink: (host: string) => `Copy the link to ${host}`,
  keyring: {
    title: "Your sign-in is saved in a file",
    body: "The system password store did not answer, so the tool saved the sign-in in a file that only you can read. This is not a problem: everything works.",
    file: "File",
    details: "Details",
    said: "The tool said:",
  },
  password:
    "WireCat does not keep this password, and neither does the tool. It is used once to sign in: Telegram receives only a proof made from it, never the password itself.",
  next: {
    qr: "After the keys: a QR code to scan with Telegram on your phone.",
    phone: "After the keys: your phone number, then the code Telegram sends.",
  } as Record<string, string>,
  method: {
    qr: "Sign in with a QR code",
    phone: "Sign in with your phone number",
  } as Record<string, string>,
  switching: {
    qr: "Switching to QR code sign-in…",
    phone: "Switching to phone sign-in…",
  } as Record<string, string>,
  switchingWhy: "Telegram's sign-in starts again the new way. This takes a few seconds.",
  switchFailed: {
    qr: "Could not switch to QR code sign-in.",
    phone: "Could not switch to phone sign-in.",
  } as Record<string, string>,
  phoneHint: "With + and the country code, for example +34 612 345 678. Spaces and dashes are removed.",
  phonePreview: (phone: string) => `Telegram gets ${phone}.`,
  phoneProblem: (p: PhoneProblem): string => {
    switch (p.problem) {
      case "empty":
        return "Type your phone number first, with + and the country code."
      case "noCountry":
        return "Start with + and the country code, for example +34 for Spain or +7 for Russia."
      case "zeroCountry":
        return "A country code never starts with 0. Type + and then the country code."
      case "short":
        return `This has ${p.digits} digits. A number with its country code has at least 8.`
      case "long":
        return `This has ${p.digits} digits. A number with its country code has at most 15.`
    }
  },
  keyProblem: (p: KeyProblem): string => {
    switch (p.problem) {
      case "empty":
        return "Paste the value from my.telegram.org first."
      case "idNotDigits":
        return "The api_id is a number: digits only, with no letters."
      case "idTooLong":
        return `This has ${p.length} digits; an api_id has at most 12. Check that only the api_id was copied.`
      case "idIsHash":
        return "This looks like the api_hash. The api_id is the short number above it."
      case "hashLength":
        return `This has ${p.length} characters; an api_hash has 32. Copy it again in full.`
      case "hashNotHex":
        return "An api_hash has only digits and the letters a to f. Copy it again from my.telegram.org."
      case "hashIsId":
        return "This looks like the api_id. The api_hash is the long value below it."
    }
  },
  keyHintsLead: "Also check:",
  keyHints: {
    idShort: "The api_id has fewer than 5 digits; most have 8, so a digit may be missing.",
    idLong: "The api_id has more than 10 digits; it may have another number stuck to it.",
    hashCapitals: "The api_hash has capital letters; my.telegram.org shows it in small letters.",
  } as Record<KeyHint, string>,
  scanPhone: "Your phone",
  scanSteps: {
    android: ["Open Telegram, then Settings → Devices.", "Press Add Device.", "Point the phone at this code."],
    iphone: ["Open Telegram, then Settings → Devices.", "Press Link Desktop Device.", "Point the phone at this code."],
  } as Record<PhoneOs, string[]>,
  scanShot: {
    alt: "Telegram for Android, the Devices screen, with the blue Add Device button.",
    caption: "Devices in Telegram for Android",
  },
  notCamera: "Scan with Telegram itself, not with the camera app.",
  codeSent: {
    app: "Telegram sent the code as a message in your Telegram app.",
    sms: "Telegram sent the code by SMS.",
    call: "Telegram calls you and says the code.",
    other: "Telegram sent the code.",
  } as Record<"app" | "sms" | "call" | "other", string>,
  notAccepted: {
    code: "Telegram did not accept that code. Check it and type it again.",
    password: "Telegram did not accept that password. Type it again.",
  } as Record<"code" | "password", string>,
  telegramSaid: "Telegram's error:",
  fix: {
    keys: "Enter the keys again",
    phone: "Enter the number again",
    code: "Get a new code",
    password: "Enter the password again",
  },
  wait: ({ hours, minutes, seconds }: Parts) =>
    [hours && `${hours} h`, minutes && `${minutes} min`, (seconds || (!hours && !minutes)) && `${seconds} s`]
      .filter(Boolean)
      .join(" "),
  failures: {
    apiIdInvalid: {
      cause: "Telegram did not accept the app keys.",
      fix: "The api_id and the api_hash must come from the same app. Copy both again from my.telegram.org, and check for a missing digit or an extra space.",
    },
    apiIdPublished: {
      cause: "Telegram no longer accepts these app keys: they were published, for example in code on the internet.",
      fix: "Use keys that were never shared. If my.telegram.org does not let you make a new app, ask Telegram support for new keys.",
    },
    phoneInvalid: {
      cause: "Telegram does not know this phone number.",
      fix: "Enter it in international format, with the country code: for example +34 600 000 000.",
    },
    phoneBanned: {
      cause: "Telegram has blocked this phone number.",
      fix: "WireCat cannot change this. Contact Telegram support at telegram.org/support.",
    },
    codeInvalid: {
      cause: "The login code was wrong.",
      fix: "Get a new code, and type it exactly as Telegram sent it.",
    },
    codeExpired: {
      cause: "The login code has expired.",
      fix: "Get a new code, and enter it within a few minutes.",
    },
    passwordInvalid: {
      cause: "The two-step verification password was wrong.",
      fix: "Enter the password you set in Telegram under Settings → Privacy and Security → Two-Step Verification.",
    },
    passwordNeeded: {
      cause: "This account has two-step verification.",
      fix: "Try again: the sign-in then asks for its password.",
    },
    loginEnded: {
      cause: "Telegram ended the earlier login, for example after Terminate All Other Sessions.",
      fix: "Try again to sign in anew.",
    },
    floodWait: {
      cause: "Telegram asks you to wait before the next try.",
      fix: "Try again later. Trying too early makes the wait longer.",
    },
    network: {
      cause: "WireCat could not reach Telegram.",
      fix: "Check the internet connection, and the VPN or proxy if you use one. Then try again.",
    },
    telegramDown: {
      cause: "Telegram had a problem on its side.",
      fix: "Wait a minute, then try again.",
    },
  } as Record<TelegramFailureKind, Explained>,
  waitFor: (wait: string) => `Telegram asks you to wait ${wait} before the next try.`,
  waitUntil: (clock: string) => `You can try again at ${clock}. Trying earlier makes the wait longer.`,
}

const ru: typeof en = {
  firstTime: "Только в первый раз",
  appSteps: [
    "Откройте my.telegram.org в браузере и войдите по номеру телефона. Telegram пришлёт код сообщением в приложение Telegram. Введите его на сайте и никому не сообщайте.",
    "Откройте Development Tools и создайте приложение. App title — не короче 5 символов. Short name — от 5 до 32 латинских букв и цифр. Platform — например, Desktop. URL и описание можно не заполнять. Не используйте слово «Telegram» в названии и в коротком имени. Если приложение уже есть, пропустите этот шаг.",
    "Скопируйте App api_id и App api_hash и вставьте их сюда. api_hash — секрет, никому его не показывайте. С этими ключами инструмент входит в ваш аккаунт через ваше собственное приложение.",
  ],
  createWarning: {
    title: "Заполняйте форму внимательно: Telegram блокирует быстро",
    body: "Одна отклонённая попытка может закрыть доступ к my.telegram.org/apps с ошибкой «Too many attempts. Please try again later.» Исправить это нельзя, остаётся только ждать. Telegram не сообщает сколько: по отзывам, от нескольких часов до суток. Перед «Create application» сверьте каждое поле с правилами выше. Если увидели эту ошибку, закройте страницу и вернитесь позже: каждая новая попытка может продлить ожидание.",
  },
  guideTitle: "Ваши собственные ключи приложения Telegram",
  shots: {
    create: {
      alt: "Форма «Create new application» на my.telegram.org: App title, Short name, URL, Platform и Description.",
      caption: "Форма нового приложения",
    },
    credentials: {
      alt: "Карточка Credentials на my.telegram.org: App api_id — число, и App api_hash с пометкой secret.",
      caption: "Где найти ключи",
    },
  },
  enlarge: (caption) => `Увеличить: ${caption}`,
  copyLink: (host) => `Скопировать ссылку на ${host}`,
  keyring: {
    title: "Вход сохранён в файле",
    body: "Системное хранилище паролей не ответило, поэтому инструмент сохранил вход в файле, который можете прочитать только вы. Это не страшно: всё работает.",
    file: "Файл",
    details: "Подробности",
    said: "Сообщение инструмента:",
  },
  password:
    "Ни WireCat, ни инструмент не сохраняют этот пароль. Он нужен один раз для входа: Telegram получает только доказательство, вычисленное из него, а не сам пароль.",
  next: {
    qr: "После ключей — QR-код, который нужно отсканировать в Telegram на телефоне.",
    phone: "После ключей — номер телефона, затем код от Telegram.",
  },
  method: {
    qr: "Вход по QR-коду",
    phone: "Вход по номеру телефона",
  },
  switching: {
    qr: "Переключаемся на вход по QR-коду…",
    phone: "Переключаемся на вход по номеру телефона…",
  },
  switchingWhy: "Вход в Telegram начинается заново, новым способом. Это займёт несколько секунд.",
  switchFailed: {
    qr: "Не удалось переключиться на вход по QR-коду.",
    phone: "Не удалось переключиться на вход по номеру телефона.",
  },
  phoneHint: "С + и кодом страны, например +7 912 345 6789. Пробелы и дефисы убираются.",
  phonePreview: (phone) => `Telegram получит ${phone}.`,
  phoneProblem: (p) => {
    switch (p.problem) {
      case "empty":
        return "Сначала введите номер телефона с + и кодом страны."
      case "noCountry":
        return "Начните с + и кода страны, например +7 для России или +34 для Испании."
      case "zeroCountry":
        return "Код страны не начинается с 0. Введите + и затем код страны."
      case "short":
        return `Здесь ${p.digits} цифр. В номере с кодом страны их не меньше 8.`
      case "long":
        return `Здесь ${p.digits} цифр. В номере с кодом страны их не больше 15.`
    }
  },
  keyProblem: (p) => {
    switch (p.problem) {
      case "empty":
        return "Сначала вставьте значение с my.telegram.org."
      case "idNotDigits":
        return "api_id — это число: только цифры, без букв."
      case "idTooLong":
        return `Здесь ${p.length} цифр, а в api_id их не больше 12. Проверьте, что скопирован только api_id.`
      case "idIsHash":
        return "Похоже на api_hash. api_id — короткое число над ним."
      case "hashLength":
        return `Здесь ${p.length} символов, а в api_hash их 32. Скопируйте его заново целиком.`
      case "hashNotHex":
        return "В api_hash только цифры и латинские буквы от a до f. Скопируйте его заново с my.telegram.org."
      case "hashIsId":
        return "Похоже на api_id. api_hash — длинное значение под ним."
    }
  },
  keyHintsLead: "Проверьте также:",
  keyHints: {
    idShort: "В api_id меньше 5 цифр; обычно их 8, возможно, одна потерялась.",
    idLong: "В api_id больше 10 цифр; возможно, к нему приклеилось другое число.",
    hashCapitals: "В api_hash есть заглавные буквы, а my.telegram.org показывает его строчными.",
  },
  scanPhone: "Ваш телефон",
  scanSteps: {
    android: [
      "Откройте Telegram, затем Настройки → Устройства.",
      "Нажмите «Подключить устройство» (Add Device).",
      "Наведите телефон на этот код.",
    ],
    iphone: [
      "Откройте Telegram, затем Настройки → Устройства.",
      "Нажмите «Подключить устройство» (Link Desktop Device).",
      "Наведите телефон на этот код.",
    ],
  },
  scanShot: {
    alt: "Telegram для Android, экран «Устройства» с синей кнопкой Add Device.",
    caption: "«Устройства» в Telegram для Android",
  },
  notCamera: "Сканируйте самим Telegram, а не приложением камеры.",
  codeSent: {
    app: "Telegram прислал код сообщением в приложение Telegram.",
    sms: "Telegram прислал код по SMS.",
    call: "Telegram позвонит и продиктует код.",
    other: "Telegram прислал код.",
  },
  notAccepted: {
    code: "Telegram не принял этот код. Проверьте его и введите снова.",
    password: "Telegram не принял этот пароль. Введите его снова.",
  },
  telegramSaid: "Ошибка Telegram:",
  fix: {
    keys: "Ввести ключи заново",
    phone: "Ввести номер заново",
    code: "Получить новый код",
    password: "Ввести пароль заново",
  },
  wait: ({ hours, minutes, seconds }) =>
    [hours && `${hours} ч`, minutes && `${minutes} мин`, (seconds || (!hours && !minutes)) && `${seconds} с`]
      .filter(Boolean)
      .join(" "),
  failures: {
    apiIdInvalid: {
      cause: "Telegram не принял ключи приложения.",
      fix: "api_id и api_hash должны быть от одного приложения. Скопируйте оба заново с my.telegram.org и проверьте, нет ли пропущенной цифры или лишнего пробела.",
    },
    apiIdPublished: {
      cause: "Telegram больше не принимает эти ключи: они были опубликованы, например в коде в интернете.",
      fix: "Используйте ключи, которые никому не передавались. Если my.telegram.org не даёт создать новое приложение, попросите новые ключи у поддержки Telegram.",
    },
    phoneInvalid: {
      cause: "Telegram не знает этот номер телефона.",
      fix: "Введите его в международном формате, с кодом страны: например +7 900 000-00-00.",
    },
    phoneBanned: {
      cause: "Telegram заблокировал этот номер.",
      fix: "WireCat не может это изменить. Обратитесь в поддержку Telegram: telegram.org/support.",
    },
    codeInvalid: {
      cause: "Код входа неверный.",
      fix: "Получите новый код и введите его точно так, как его прислал Telegram.",
    },
    codeExpired: {
      cause: "Срок кода входа истёк.",
      fix: "Получите новый код и введите его в течение нескольких минут.",
    },
    passwordInvalid: {
      cause: "Пароль двухэтапной проверки неверный.",
      fix: "Введите пароль, заданный в Telegram: Настройки → Конфиденциальность → Облачный пароль.",
    },
    passwordNeeded: {
      cause: "У этого аккаунта включена двухэтапная проверка.",
      fix: "Повторите вход: он спросит пароль.",
    },
    loginEnded: {
      cause: "Telegram завершил прежний вход, например после «Завершить все другие сеансы».",
      fix: "Повторите, чтобы войти заново.",
    },
    floodWait: {
      cause: "Telegram просит подождать перед следующей попыткой.",
      fix: "Повторите позже. Слишком ранняя попытка удлиняет ожидание.",
    },
    network: {
      cause: "WireCat не смог связаться с Telegram.",
      fix: "Проверьте подключение к интернету, а также VPN или прокси, если они есть. Затем повторите.",
    },
    telegramDown: {
      cause: "У Telegram сбой на его стороне.",
      fix: "Подождите минуту и повторите.",
    },
  },
  waitFor: (wait) => `Telegram просит подождать ${wait} перед следующей попыткой.`,
  waitUntil: (clock) => `Повторить можно в ${clock}. Более ранняя попытка удлинит ожидание.`,
}

const es: typeof en = {
  firstTime: "Solo la primera vez",
  appSteps: [
    "Abre my.telegram.org en el navegador e inicia sesión con tu número de teléfono. Telegram envía un código como mensaje en tu app de Telegram. Escríbelo en el sitio y no se lo des a nadie.",
    "Abre Development Tools y crea una app. App title: al menos 5 caracteres. Short name: de 5 a 32 letras y cifras. Platform: por ejemplo, Desktop. La URL y la descripción pueden quedar vacías. No uses la palabra «Telegram» en el título ni en el nombre corto. Si ya tienes una app, salta este paso.",
    "Copia App api_id y App api_hash y pégalos aquí. El api_hash es secreto: no lo compartas. Con estas claves la herramienta entra en tu cuenta a través de tu propia app.",
  ],
  createWarning: {
    title: "Rellena el formulario con cuidado: Telegram bloquea enseguida",
    body: "Un solo intento rechazado puede bloquearte my.telegram.org/apps con el error «Too many attempts. Please try again later.» No hay forma de deshacerlo: solo queda esperar. Telegram no dice cuánto; quienes lo han visto hablan de unas horas a un día. Revisa cada campo con las reglas de arriba antes de pulsar Create application. Si ves ese error, cierra la página y vuelve más tarde: cada nuevo intento puede alargar la espera.",
  },
  guideTitle: "Tus propias claves de app de Telegram",
  shots: {
    create: {
      alt: "El formulario «Create new application» de my.telegram.org: App title, Short name, URL, Platform y Description.",
      caption: "El formulario de una app nueva",
    },
    credentials: {
      alt: "La tarjeta Credentials de my.telegram.org: App api_id, un número, y App api_hash, marcado como secreto.",
      caption: "Dónde están las claves",
    },
  },
  enlarge: (caption) => `Ampliar: ${caption}`,
  copyLink: (host) => `Copiar el enlace a ${host}`,
  keyring: {
    title: "Tu sesión se guardó en un archivo",
    body: "El almacén de contraseñas del sistema no respondió, así que la herramienta guardó la sesión en un archivo que solo tú puedes leer. No es un problema: todo funciona.",
    file: "Archivo",
    details: "Detalles",
    said: "La herramienta dijo:",
  },
  password:
    "Ni WireCat ni la herramienta guardan esta contraseña. Se usa una vez para iniciar sesión: Telegram recibe solo una prueba calculada a partir de ella, nunca la contraseña.",
  next: {
    qr: "Después de las claves: un código QR para escanear con Telegram en el teléfono.",
    phone: "Después de las claves: tu número de teléfono y el código que envía Telegram.",
  },
  method: {
    qr: "Iniciar sesión con un código QR",
    phone: "Iniciar sesión con tu número de teléfono",
  },
  switching: {
    qr: "Cambiando al inicio de sesión con código QR…",
    phone: "Cambiando al inicio de sesión con el teléfono…",
  },
  switchingWhy: "El inicio de sesión de Telegram empieza de nuevo de la otra forma. Tarda unos segundos.",
  switchFailed: {
    qr: "No se pudo cambiar al inicio de sesión con código QR.",
    phone: "No se pudo cambiar al inicio de sesión con el teléfono.",
  },
  phoneHint: "Con + y el prefijo del país, por ejemplo +34 612 345 678. Se quitan los espacios y guiones.",
  phonePreview: (phone) => `Telegram recibe ${phone}.`,
  phoneProblem: (p) => {
    switch (p.problem) {
      case "empty":
        return "Primero escribe tu número con + y el prefijo del país."
      case "noCountry":
        return "Empieza con + y el prefijo del país, por ejemplo +34 para España o +52 para México."
      case "zeroCountry":
        return "Un prefijo de país nunca empieza por 0. Escribe + y después el prefijo."
      case "short":
        return `Tiene ${p.digits} dígitos. Un número con su prefijo tiene al menos 8.`
      case "long":
        return `Tiene ${p.digits} dígitos. Un número con su prefijo tiene como máximo 15.`
    }
  },
  keyProblem: (p) => {
    switch (p.problem) {
      case "empty":
        return "Pega primero el valor de my.telegram.org."
      case "idNotDigits":
        return "El api_id es un número: solo cifras, sin letras."
      case "idTooLong":
        return `Tiene ${p.length} cifras; un api_id tiene como mucho 12. Comprueba que copiaste solo el api_id.`
      case "idIsHash":
        return "Parece el api_hash. El api_id es el número corto que está encima."
      case "hashLength":
        return `Tiene ${p.length} caracteres; un api_hash tiene 32. Cópialo de nuevo entero.`
      case "hashNotHex":
        return "Un api_hash solo tiene cifras y las letras de la a a la f. Cópialo de nuevo desde my.telegram.org."
      case "hashIsId":
        return "Parece el api_id. El api_hash es el valor largo que está debajo."
    }
  },
  keyHintsLead: "Revisa también:",
  keyHints: {
    idShort: "El api_id tiene menos de 5 cifras; casi todos tienen 8, quizá falte una.",
    idLong: "El api_id tiene más de 10 cifras; quizá lleva otro número pegado.",
    hashCapitals: "El api_hash tiene mayúsculas; my.telegram.org lo muestra en minúsculas.",
  },
  scanPhone: "Tu teléfono",
  scanSteps: {
    android: [
      "Abre Telegram y ve a Ajustes → Dispositivos.",
      "Pulsa Añadir dispositivo (Add Device).",
      "Apunta el teléfono a este código.",
    ],
    iphone: [
      "Abre Telegram y ve a Ajustes → Dispositivos.",
      "Pulsa Vincular dispositivo (Link Desktop Device).",
      "Apunta el teléfono a este código.",
    ],
  },
  scanShot: {
    alt: "Telegram para Android, la pantalla Dispositivos con el botón azul Add Device.",
    caption: "Dispositivos en Telegram para Android",
  },
  notCamera: "Escanea con Telegram, no con la app de la cámara.",
  codeSent: {
    app: "Telegram envió el código como mensaje en tu app de Telegram.",
    sms: "Telegram envió el código por SMS.",
    call: "Telegram te llama y te dice el código.",
    other: "Telegram envió el código.",
  },
  notAccepted: {
    code: "Telegram no aceptó ese código. Revísalo y escríbelo de nuevo.",
    password: "Telegram no aceptó esa contraseña. Escríbela de nuevo.",
  },
  telegramSaid: "Error de Telegram:",
  fix: {
    keys: "Volver a escribir las claves",
    phone: "Volver a escribir el número",
    code: "Pedir un código nuevo",
    password: "Volver a escribir la contraseña",
  },
  wait: ({ hours, minutes, seconds }) =>
    [hours && `${hours} h`, minutes && `${minutes} min`, (seconds || (!hours && !minutes)) && `${seconds} s`]
      .filter(Boolean)
      .join(" "),
  failures: {
    apiIdInvalid: {
      cause: "Telegram no aceptó las claves de la app.",
      fix: "El api_id y el api_hash deben ser de la misma app. Cópialos de nuevo desde my.telegram.org y revisa que no falte una cifra ni sobre un espacio.",
    },
    apiIdPublished: {
      cause: "Telegram ya no acepta estas claves: se publicaron, por ejemplo en código en internet.",
      fix: "Usa claves que nunca se hayan compartido. Si my.telegram.org no te deja crear otra app, pide claves nuevas al soporte de Telegram.",
    },
    phoneInvalid: {
      cause: "Telegram no conoce este número de teléfono.",
      fix: "Escríbelo en formato internacional, con el prefijo del país: por ejemplo +34 600 000 000.",
    },
    phoneBanned: {
      cause: "Telegram ha bloqueado este número.",
      fix: "WireCat no puede cambiarlo. Escribe al soporte de Telegram en telegram.org/support.",
    },
    codeInvalid: {
      cause: "El código de inicio de sesión era incorrecto.",
      fix: "Pide un código nuevo y escríbelo tal como lo envió Telegram.",
    },
    codeExpired: {
      cause: "El código de inicio de sesión ha caducado.",
      fix: "Pide un código nuevo y escríbelo en pocos minutos.",
    },
    passwordInvalid: {
      cause: "La contraseña de la verificación en dos pasos era incorrecta.",
      fix: "Escribe la contraseña que pusiste en Telegram, en Ajustes → Privacidad y seguridad → Verificación en dos pasos.",
    },
    passwordNeeded: {
      cause: "Esta cuenta tiene verificación en dos pasos.",
      fix: "Reintenta: el inicio de sesión pedirá su contraseña.",
    },
    loginEnded: {
      cause: "Telegram cerró la sesión anterior, por ejemplo tras «Cerrar todas las demás sesiones».",
      fix: "Reintenta para iniciar sesión de nuevo.",
    },
    floodWait: {
      cause: "Telegram pide esperar antes del siguiente intento.",
      fix: "Reintenta más tarde. Intentarlo antes alarga la espera.",
    },
    network: {
      cause: "WireCat no pudo conectar con Telegram.",
      fix: "Revisa la conexión a internet, y la VPN o el proxy si usas uno. Después reintenta.",
    },
    telegramDown: {
      cause: "Telegram tuvo un problema por su parte.",
      fix: "Espera un minuto y reintenta.",
    },
  },
  waitFor: (wait) => `Telegram pide esperar ${wait} antes del siguiente intento.`,
  waitUntil: (clock) => `Podrás reintentar a las ${clock}. Intentarlo antes alarga la espera.`,
}

export type TelegramMessages = typeof en

export const telegramMessages: Messages<TelegramMessages> = { en, ru, es }
