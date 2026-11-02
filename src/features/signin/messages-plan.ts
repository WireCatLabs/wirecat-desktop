import type { Messages } from "@/i18n"

/**
 * What each sign-in will ask and what happens to it. Every claim is the tool's own behaviour, checked in its source
 * (2026-11-02): tg-cli `src/telegram/credentials.ts` (app keys in the keyring, else a file in its config folder),
 * `storage.ts` (the session file), `session.ts` (the questions, the phone asked once; the password is never written),
 * mtcute's `checkPassword` (Telegram gets an SRP proof, not the password); max-cli `session.ts` (two minutes for the
 * scan); tg-cli's postinstall note ("allow about five minutes"). Files are 0600, which binds only on macOS and Linux,
 * so the text does not promise that only the owner can read them. A tool without an entry shows only the steps and WireCat's own line.
 */
type Plan = { steps: string[]; time?: string; kept?: string[] }

const en = {
  what: "What happens",
  time: "How long",
  kept: "What happens to what you share",
  start: "Start sign-in",
  wirecat: "WireCat keeps no copy: what you type goes straight to the tool on this computer.",
  plans: {
    "tg:qr": {
      steps: [
        "The first time for this account: your phone number, then the code Telegram sends to your Telegram app. With them the tool makes your own Telegram app keys.",
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
      steps: [
        "The first time for this account: your phone number, then the code Telegram sends to your Telegram app. With them the tool makes your own Telegram app keys.",
        "The login code Telegram sends.",
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
        "The first time: the Public Client ID of a Zoom app of your own, made once in the Zoom App Marketplace.",
        "Your browser opens Zoom to approve access. You approve it there, not here.",
      ],
      kept: ["Your Zoom password is typed only on Zoom's own page."],
    },
    drive: {
      steps: ["Your browser opens Google: choose the account and allow read-only access to Drive."],
      kept: [
        "Your Google password is typed only on Google's own page.",
        "Read-only: the tool cannot change your files.",
      ],
    },
  } as Record<string, Plan>,
}

export type PlanText = typeof en

const TG_RU: Plan = {
  steps: [
    "В первый раз для этого аккаунта: номер телефона, затем код, который Telegram пришлёт в приложение Telegram. С ними инструмент создаст ваши собственные ключи приложения Telegram.",
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
  plans: {
    "tg:qr": TG_RU,
    "tg:phone": {
      ...TG_RU,
      steps: [TG_RU.steps[0] ?? "", "Код входа, который пришлёт Telegram.", TG_RU.steps[2] ?? ""],
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
        "В первый раз: Public Client ID вашего собственного приложения Zoom, созданного один раз в Zoom App Marketplace.",
        "Браузер откроет Zoom, чтобы разрешить доступ. Разрешаете вы там, а не здесь.",
      ],
      kept: ["Пароль от Zoom вводится только на странице самого Zoom."],
    },
    drive: {
      steps: ["Браузер откроет Google: выберите аккаунт и разрешите доступ к Диску только для чтения."],
      kept: [
        "Пароль от Google вводится только на странице самого Google.",
        "Только чтение: инструмент не может изменить ваши файлы.",
      ],
    },
  },
}

const TG_ES: Plan = {
  steps: [
    "La primera vez para esta cuenta: tu número de teléfono y luego el código que Telegram envía a tu app de Telegram. Con ellos la herramienta crea tus propias claves de aplicación de Telegram.",
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
  plans: {
    "tg:qr": TG_ES,
    "tg:phone": {
      ...TG_ES,
      steps: [TG_ES.steps[0] ?? "", "El código de inicio de sesión que envía Telegram.", TG_ES.steps[2] ?? ""],
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
        "La primera vez: el Public Client ID de una app de Zoom propia, creada una vez en Zoom App Marketplace.",
        "El navegador abre Zoom para aprobar el acceso. Lo apruebas allí, no aquí.",
      ],
      kept: ["Tu contraseña de Zoom solo se escribe en la propia página de Zoom."],
    },
    drive: {
      steps: ["El navegador abre Google: elige la cuenta y permite acceso de solo lectura a Drive."],
      kept: [
        "Tu contraseña de Google solo se escribe en la propia página de Google.",
        "Solo lectura: la herramienta no puede cambiar tus archivos.",
      ],
    },
  },
}

export const planMessages: Messages<PlanText> = { en, ru, es }

export const planFor = (m: PlanText, tool: string, method: string | null): Plan | undefined =>
  m.plans[`${tool}:${method}`] ?? m.plans[tool]
