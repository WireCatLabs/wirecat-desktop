import type { WebhookScope } from "@/domain/bitrix-signin"
import type { Messages } from "@/i18n"

type Problem = { title: string; cause: string }

const en = {
  portal: {
    title: "Your Bitrix24 portal",
    lead: "The address you open Bitrix24 at. The next step's links lead to it.",
    label: "Portal address",
    placeholder: "mycompany.bitrix24.ru",
    hint: "A whole address copied from the browser works too: only the portal's name is kept.",
    missing: "Enter your portal's address, such as mycompany.bitrix24.ru.",
  },
  webhook: {
    title: "Make an incoming webhook",
    lead: (host: string) =>
      `A webhook is a private address that lets WireCat work in ${host}. You make it once, in Bitrix24.`,
    open: "Open Developer resources",
    steps: {
      open: (host: string) => `Open Developer resources on ${host}.`,
      other: "Choose Other, then Incoming webhook.",
      rights: "Under the rights, tick these three. The list has a search field: the code finds each one.",
      save: (host: string) => `Press Save, then copy the webhook's address. It starts with https://${host}/rest/.`,
    },
    scopes: {
      crm: "CRM",
      user_basic: "Users (basic)",
      department: "Company structure",
    } as Record<WebhookScope, string>,
    copyCode: (code: string) => `Copy ${code}`,
    acts: "The agent acts with the rights of the employee who makes the webhook: it sees and changes only what they can.",
    admin: "Only a webhook made by a portal administrator can delete or merge records in the CRM.",
    noItem:
      "No Incoming webhook item? An administrator allows it in Settings, Security: who can create incoming webhooks.",
    time: "About 2 minutes",
  },
  paste: {
    title: "Paste the webhook's address",
    label: "Webhook address",
    show: "Show the address",
    hide: "Hide the address",
    hint: (host: string) =>
      `It looks like https://${host}/rest/12/…/ and stays on this computer, in the system keyring.`,
    kept: "The address you pasted is still here. Press Check again once it is fixed in Bitrix24.",
    missing: "Paste the webhook's address you copied in Bitrix24.",
    checking: (host: string) => `Checking the webhook with ${host}…`,
    check: "Check and sign in",
    checkAgain: "Check again",
  },
  problem: {
    malformed: {
      title: "This is not a webhook address.",
      cause:
        "Copy the whole address from the webhook's page in Bitrix24. It starts with https:// and has /rest/ in it.",
    },
    scope: {
      title: "The webhook may not read who made it.",
      cause:
        "In Bitrix24, open the webhook, tick Users (basic), user_basic, and save. The address stays the same: press Check again.",
    },
    refused: {
      title: "Bitrix24 refused this webhook.",
      cause: "It may be deleted, or copied in part. Copy the address again from the webhook's page.",
    },
    unreachable: {
      title: "WireCat could not reach the portal.",
      cause: "Check the portal's address and your connection. Back changes the address.",
    },
  } as Record<"malformed" | "scope" | "refused" | "unreachable", Problem>,
  wrongPortal: (host: string, portal: string) => ({
    title: `This webhook is for ${host}, not ${portal}.`,
    cause: `Make the webhook on ${portal}, or use ${host} instead.`,
  }),
  switchPortal: (host: string) => `Use ${host}`,
  duplicate: (profile: string | null) => ({
    title: profile ? `Profile ${profile} already uses this webhook.` : "Another profile already uses this webhook.",
    cause: "One webhook signs in one profile. Use that profile, or remove it first.",
  }),
  manage: (profile: string | null) => (profile ? `Manage ${profile}` : "Manage accounts"),
}

export type BitrixText = typeof en

const ru: BitrixText = {
  portal: {
    title: "Ваш портал Битрикс24",
    lead: "Адрес, по которому вы открываете Битрикс24. Ссылки следующего шага ведут на него.",
    label: "Адрес портала",
    placeholder: "mycompany.bitrix24.ru",
    hint: "Подойдет и полный адрес из браузера: сохраняется только имя портала.",
    missing: "Введите адрес портала, например mycompany.bitrix24.ru.",
  },
  webhook: {
    title: "Создайте входящий вебхук",
    lead: (host) =>
      `Вебхук это закрытый адрес, через который WireCat работает в ${host}. Его создают один раз, в Битрикс24.`,
    open: "Открыть «Разработчикам»",
    steps: {
      open: (host) => `Откройте раздел «Разработчикам» на ${host}.`,
      other: "Выберите «Другое», затем «Входящий вебхук».",
      rights: "В правах доступа отметьте эти три. В списке есть поиск: каждое находится по коду.",
      save: (host) => `Нажмите «Сохранить» и скопируйте адрес вебхука. Он начинается с https://${host}/rest/.`,
    },
    scopes: {
      crm: "CRM",
      user_basic: "Пользователи (базовые)",
      department: "Структура компании",
    },
    copyCode: (code) => `Скопировать ${code}`,
    acts: "Агент действует с правами сотрудника, создавшего вебхук: видит и меняет только то, что может он.",
    admin: "Удалять и объединять записи в CRM может только вебхук администратора портала.",
    noItem:
      "Нет пункта «Входящий вебхук»? Администратор разрешает его в настройках, раздел «Безопасность»: кто может создавать входящие вебхуки.",
    time: "Около 2 минут",
  },
  paste: {
    title: "Вставьте адрес вебхука",
    label: "Адрес вебхука",
    show: "Показать адрес",
    hide: "Скрыть адрес",
    hint: (host) =>
      `Он выглядит как https://${host}/rest/12/…/ и хранится на этом компьютере, в системной связке ключей.`,
    kept: "Вставленный адрес сохранен здесь. Когда исправите вебхук в Битрикс24, нажмите «Проверить снова».",
    missing: "Вставьте адрес вебхука, скопированный в Битрикс24.",
    checking: (host) => `Проверяем вебхук на ${host}…`,
    check: "Проверить и войти",
    checkAgain: "Проверить снова",
  },
  problem: {
    malformed: {
      title: "Это не адрес вебхука.",
      cause: "Скопируйте адрес целиком со страницы вебхука в Битрикс24. Он начинается с https:// и содержит /rest/.",
    },
    scope: {
      title: "Вебхуку не хватает права читать пользователей.",
      cause:
        "В Битрикс24 откройте вебхук, отметьте «Пользователи (базовые)», user_basic, и сохраните. Адрес не изменится: нажмите «Проверить снова».",
    },
    refused: {
      title: "Битрикс24 отклонил этот вебхук.",
      cause: "Возможно, его удалили или скопировали не целиком. Скопируйте адрес еще раз со страницы вебхука.",
    },
    unreachable: {
      title: "WireCat не смог связаться с порталом.",
      cause: "Проверьте адрес портала и подключение. Кнопка «Назад» позволяет изменить адрес.",
    },
  },
  wrongPortal: (host, portal) => ({
    title: `Этот вебхук для ${host}, а не для ${portal}.`,
    cause: `Создайте вебхук на ${portal} или используйте ${host}.`,
  }),
  switchPortal: (host) => `Использовать ${host}`,
  duplicate: (profile) => ({
    title: profile ? `Профиль ${profile} уже использует этот вебхук.` : "Другой профиль уже использует этот вебхук.",
    cause: "Один вебхук входит в один профиль. Используйте тот профиль или сначала удалите его.",
  }),
  manage: (profile) => (profile ? `Открыть ${profile}` : "Открыть аккаунты"),
}

const es: BitrixText = {
  portal: {
    title: "Tu portal de Bitrix24",
    lead: "La dirección con la que abres Bitrix24. Los enlaces del siguiente paso llevan a ella.",
    label: "Dirección del portal",
    placeholder: "mycompany.bitrix24.es",
    hint: "También vale la dirección completa copiada del navegador: solo se guarda el nombre del portal.",
    missing: "Escribe la dirección de tu portal, por ejemplo mycompany.bitrix24.es.",
  },
  webhook: {
    title: "Crea un webhook entrante",
    lead: (host) =>
      `Un webhook es una dirección privada con la que WireCat trabaja en ${host}. Se crea una sola vez, en Bitrix24.`,
    open: "Abrir Recursos para desarrolladores",
    steps: {
      open: (host) => `Abre Recursos para desarrolladores en ${host}.`,
      other: "Elige Otro y luego Webhook entrante.",
      rights: "En los permisos, marca estos tres. La lista tiene un buscador: el código encuentra cada uno.",
      save: (host) => `Pulsa Guardar y copia la dirección del webhook. Empieza por https://${host}/rest/.`,
    },
    scopes: {
      crm: "CRM",
      user_basic: "Usuarios (básico)",
      department: "Estructura de la empresa",
    },
    copyCode: (code) => `Copiar ${code}`,
    acts: "El agente actúa con los permisos del empleado que crea el webhook: ve y cambia solo lo que esa persona puede.",
    admin: "Solo un webhook creado por un administrador del portal puede borrar o fusionar registros en el CRM.",
    noItem:
      "¿No aparece Webhook entrante? Un administrador lo permite en Ajustes, Seguridad: quién puede crear webhooks entrantes.",
    time: "Unos 2 minutos",
  },
  paste: {
    title: "Pega la dirección del webhook",
    label: "Dirección del webhook",
    show: "Mostrar la dirección",
    hide: "Ocultar la dirección",
    hint: (host) =>
      `Tiene la forma https://${host}/rest/12/…/ y se queda en este ordenador, en el llavero del sistema.`,
    kept: "La dirección que pegaste sigue aquí. Cuando la arregles en Bitrix24, pulsa Comprobar de nuevo.",
    missing: "Pega la dirección del webhook que copiaste en Bitrix24.",
    checking: (host) => `Comprobando el webhook con ${host}…`,
    check: "Comprobar e iniciar sesión",
    checkAgain: "Comprobar de nuevo",
  },
  problem: {
    malformed: {
      title: "Esto no es una dirección de webhook.",
      cause:
        "Copia la dirección completa desde la página del webhook en Bitrix24. Empieza por https:// y lleva /rest/.",
    },
    scope: {
      title: "El webhook no puede leer quién lo creó.",
      cause:
        "En Bitrix24, abre el webhook, marca Usuarios (básico), user_basic, y guarda. La dirección no cambia: pulsa Comprobar de nuevo.",
    },
    refused: {
      title: "Bitrix24 rechazó este webhook.",
      cause: "Puede que se haya borrado o copiado a medias. Copia otra vez la dirección desde la página del webhook.",
    },
    unreachable: {
      title: "WireCat no pudo conectar con el portal.",
      cause: "Revisa la dirección del portal y tu conexión. Atrás permite cambiar la dirección.",
    },
  },
  wrongPortal: (host, portal) => ({
    title: `Este webhook es de ${host}, no de ${portal}.`,
    cause: `Crea el webhook en ${portal} o usa ${host}.`,
  }),
  switchPortal: (host) => `Usar ${host}`,
  duplicate: (profile) => ({
    title: profile ? `El perfil ${profile} ya usa este webhook.` : "Otro perfil ya usa este webhook.",
    cause: "Un webhook inicia sesión en un solo perfil. Usa ese perfil o quítalo primero.",
  }),
  manage: (profile) => (profile ? `Gestionar ${profile}` : "Gestionar cuentas"),
}

export const bitrixMessages: Messages<BitrixText> = { en, ru, es }
