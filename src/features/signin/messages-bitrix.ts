import type { AppProblem, WebhookScope } from "@/domain/bitrix-signin"
import type { Messages } from "@/i18n"

type Problem = { title: string; cause: string }

const en = {
  portal: {
    title: "Your Bitrix24 portal",
    lead: "The address you open Bitrix24 at. The next step's links lead to it.",
    label: "Portal address",
    placeholder: "mycompany.bitrix24.ru",
    hint: "Only the domain, such as mycompany.bitrix24.ru, with nothing after it.",
    missing: "Enter your portal's address, such as mycompany.bitrix24.ru.",
    notDomain: "This is not a portal's address. Type its domain, such as mycompany.bitrix24.ru.",
    path: (host: string) => `Remove everything after ${host}: the address is the domain alone.`,
    way: "How to sign in",
    ways: {
      webhook: { name: "Incoming webhook", detail: "Quickest. Acts as the employee who makes it." },
      app: { name: "Local application", detail: "Acts as the employee who signs in, in the browser." },
    },
    tooOld: "A local application works after the update; the webhook works now.",
  },
  webhook: {
    title: "Make an incoming webhook",
    lead: (host: string) =>
      `A webhook is a private address that lets WireCat work in ${host}. You make it once, in Bitrix24.`,
    open: "Open Developer resources",
    steps: {
      open: (host: string) => `Open Developer resources on ${host}.`,
      other: "Choose Other, then Incoming webhook.",
      rights:
        "At the bottom of the page, under Assign permissions, press the + link beside the field. A list with a search field opens: type each code below, user_basic, crm and department, and tick it.",
      save: (host: string) => `Press Save, then copy the webhook's address. It starts with https://${host}/rest/.`,
    },
    scopes: {
      crm: "CRM",
      user_basic: "Users (basic)",
      department: "Company structure",
    } as Record<WebhookScope, string>,
    copyCode: (code: string) => `Copy ${code}`,
    shot: {
      alt: "Bitrix24's Incoming webhook page. At the bottom, under the permissions, Users (basic) user_basic, CRM crm and Company structure department are chosen.",
      caption: "The three permissions, chosen",
    },
    enlarge: (caption: string) => `Enlarge: ${caption}`,
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
        "In Bitrix24, open the webhook and check that all three permissions are chosen: Users (basic), user_basic; CRM, crm; Company structure, department. Save. The address stays the same: press Check again.",
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
  app: {
    title: "Make a local application",
    lead: (host: string) =>
      `A local application lets WireCat work in ${host} with the rights of the employee who signs in. You make it once, in Bitrix24. Its sign-in renews by itself.`,
    open: "Open Developer resources",
    steps: {
      open: (host: string) => `Open Developer resources on ${host}. Choose Other, then Local application.`,
      server: "Choose Server. Paste this address into Your handler path:",
      install: 'Leave Initial installation path empty, and leave "Application completes the installation itself" off.',
      rights: "Under the access permissions, tick these three.",
      save: "Press Save. Copy the Application ID (client_id) and the Application key (client_secret) into the fields below.",
    },
    copyHandler: "Copy the handler path",
    docs: "Full guide on wirecat.dev",
    idLabel: "Application ID (client_id)",
    idPlaceholder: "local.0123abcd.45678901",
    keyLabel: "Application key (client_secret)",
    show: "Show the key",
    hide: "Hide the key",
    keyHint: "It stays on this computer, in the system keyring.",
    kept: "The key you typed is still here. Type it again only if you changed it in Bitrix24.",
    missingId: "Paste the Application ID Bitrix24 shows, such as local.0123abcd.45678901.",
    missingKey: "Paste the Application key Bitrix24 shows beside the ID.",
    browser:
      "Next, the portal's sign-in opens in the browser. Allow the application, and the browser hands the sign-in back to WireCat.",
    acts: "The agent acts with the rights of the employee who signs in: it sees and changes only what they can.",
    time: "About 5 minutes",
    signIn: "Sign in in the browser",
    again: "Sign in again",
    problem: {
      refused: {
        title: "Bitrix24 refused the Application ID or key.",
        cause: "Copy both again from the application's page, and check that it is saved on this portal.",
      },
      payment: {
        title: "Bitrix24 gives applications no access on this plan.",
        cause: "The portal's plan does not allow it. Use the incoming webhook instead: Back, then Incoming webhook.",
      },
      wrongPortal: {
        title: "The browser signed in to another portal.",
        cause: "Sign in to the portal you typed on the first step, or change it there.",
      },
      unreachable: {
        title: "WireCat could not reach Bitrix24's sign-in.",
        cause: "Check your connection and try again in a minute.",
      },
      scope: {
        title: "The application may not read who signed in.",
        cause:
          "In Bitrix24, open the application and check that all three permissions are chosen: Users (basic), user_basic; CRM, crm; Company structure, department. Save and sign in again.",
      },
      invalid: {
        title: "Bitrix24's tool refused what was typed.",
        cause: "Check the portal's address and the Application ID.",
      },
    } as Record<AppProblem["kind"], Problem>,
  },
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
    hint: "Только домен, например mycompany.bitrix24.ru, и ничего после него.",
    missing: "Введите адрес портала, например mycompany.bitrix24.ru.",
    notDomain: "Это не адрес портала. Введите его домен, например mycompany.bitrix24.ru.",
    path: (host) => `Уберите всё после ${host}: адрес портала это только домен.`,
    way: "Как войти",
    ways: {
      webhook: { name: "Входящий вебхук", detail: "Быстрее всего. Действует от имени сотрудника, создавшего его." },
      app: { name: "Локальное приложение", detail: "Действует от имени сотрудника, который входит в браузере." },
    },
    tooOld: "Локальное приложение заработает после обновления, вебхук работает уже сейчас.",
  },
  webhook: {
    title: "Создайте входящий вебхук",
    lead: (host) =>
      `Вебхук это закрытый адрес, через который WireCat работает в ${host}. Его создают один раз, в Битрикс24.`,
    open: "Открыть «Разработчикам»",
    steps: {
      open: (host) => `Откройте раздел «Разработчикам» на ${host}.`,
      other: "Выберите «Другое», затем «Входящий вебхук».",
      rights:
        "Внизу страницы, в разделе «Настройка прав», нажмите «+ выбрать» рядом с полем. Откроется список с поиском: введите по очереди коды user_basic, crm и department и выберите каждое право.",
      save: (host) => `Нажмите «Сохранить» и скопируйте адрес вебхука. Он начинается с https://${host}/rest/.`,
    },
    scopes: {
      crm: "CRM",
      user_basic: "Пользователи (базовый)",
      department: "Структура компании",
    },
    copyCode: (code) => `Скопировать ${code}`,
    shot: {
      alt: "Страница «Входящий вебхук» в Битрикс24. Внизу, в разделе «Настройка прав», выбраны «Пользователи (базовый) (user_basic)», «CRM (crm)» и «Структура компании (department)».",
      caption: "Три права выбраны",
    },
    enlarge: (caption) => `Увеличить: ${caption}`,
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
        "В Битрикс24 откройте вебхук и проверьте, что в «Настройке прав» выбраны все три права: «Пользователи (базовый)», user_basic; «CRM», crm; «Структура компании», department. Сохраните. Адрес не изменится: нажмите «Проверить снова».",
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
  app: {
    title: "Создайте локальное приложение",
    lead: (host) =>
      `Локальное приложение позволяет WireCat работать в ${host} с правами сотрудника, который входит. Его создают один раз, в Битрикс24. Вход продлевается сам.`,
    open: "Открыть «Разработчикам»",
    steps: {
      open: (host) => `Откройте раздел «Разработчикам» на ${host}. Выберите «Другое», затем «Локальное приложение».`,
      server: "Выберите «Серверное». В поле «Путь вашего обработчика» вставьте этот адрес:",
      install:
        "«Путь для первоначальной установки» оставьте пустым. Галочку о том, что приложение само завершает установку, не ставьте.",
      rights: "В правах доступа отметьте эти три.",
      save: "Нажмите «Сохранить». Скопируйте код приложения (client_id) и ключ приложения (client_secret) в поля ниже.",
    },
    copyHandler: "Скопировать путь обработчика",
    docs: "Подробная инструкция на wirecat.dev",
    idLabel: "Код приложения (client_id)",
    idPlaceholder: "local.0123abcd.45678901",
    keyLabel: "Ключ приложения (client_secret)",
    show: "Показать ключ",
    hide: "Скрыть ключ",
    keyHint: "Он хранится на этом компьютере, в системной связке ключей.",
    kept: "Введенный ключ сохранен здесь. Введите его снова, только если изменили его в Битрикс24.",
    missingId: "Вставьте код приложения из Битрикс24, например local.0123abcd.45678901.",
    missingKey: "Вставьте ключ приложения, он рядом с кодом в Битрикс24.",
    browser: "Дальше в браузере откроется вход в портал. Разрешите доступ приложению, и браузер вернет вход в WireCat.",
    acts: "Агент действует с правами сотрудника, который входит: видит и меняет только то, что может он.",
    time: "Около 5 минут",
    signIn: "Войти в браузере",
    again: "Войти снова",
    problem: {
      refused: {
        title: "Битрикс24 отклонил код или ключ приложения.",
        cause: "Скопируйте оба еще раз со страницы приложения и проверьте, что оно сохранено на этом портале.",
      },
      payment: {
        title: "На этом тарифе Битрикс24 не дает доступ приложениям.",
        cause: "Тариф портала этого не позволяет. Войдите через входящий вебхук: «Назад», затем «Входящий вебхук».",
      },
      wrongPortal: {
        title: "В браузере выполнен вход в другой портал.",
        cause: "Войдите в портал, указанный на первом шаге, или измените адрес там.",
      },
      unreachable: {
        title: "WireCat не смог связаться со входом Битрикс24.",
        cause: "Проверьте подключение и попробуйте через минуту.",
      },
      scope: {
        title: "Приложению не хватает права читать пользователей.",
        cause:
          "В Битрикс24 откройте приложение и проверьте, что выбраны все три права: «Пользователи (базовый)», user_basic; «CRM», crm; «Структура компании», department. Сохраните и войдите снова.",
      },
      invalid: {
        title: "Инструмент Битрикс24 не принял введенное.",
        cause: "Проверьте адрес портала и код приложения.",
      },
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
    hint: "Solo el dominio, por ejemplo mycompany.bitrix24.es, sin nada detrás.",
    missing: "Escribe la dirección de tu portal, por ejemplo mycompany.bitrix24.es.",
    notDomain: "Esto no es la dirección de un portal. Escribe su dominio, por ejemplo mycompany.bitrix24.es.",
    path: (host) => `Quita todo lo que va después de ${host}: la dirección es solo el dominio.`,
    way: "Cómo iniciar sesión",
    ways: {
      webhook: { name: "Webhook entrante", detail: "Lo más rápido. Actúa como el empleado que lo crea." },
      app: { name: "Aplicación local", detail: "Actúa como el empleado que inicia sesión en el navegador." },
    },
    tooOld: "La aplicación local funcionará tras actualizar; el webhook funciona ya.",
  },
  webhook: {
    title: "Crea un webhook entrante",
    lead: (host) =>
      `Un webhook es una dirección privada con la que WireCat trabaja en ${host}. Se crea una sola vez, en Bitrix24.`,
    open: "Abrir Recursos para desarrolladores",
    steps: {
      open: (host) => `Abre Recursos para desarrolladores en ${host}.`,
      other: "Elige Otro y luego Webhook entrante.",
      rights:
        "Al final de la página, en la sección de permisos, pulsa el enlace + junto al campo. Se abre una lista con buscador: escribe uno a uno los códigos user_basic, crm y department y elige cada permiso.",
      save: (host) => `Pulsa Guardar y copia la dirección del webhook. Empieza por https://${host}/rest/.`,
    },
    scopes: {
      crm: "CRM",
      user_basic: "Usuarios (básico)",
      department: "Estructura de la empresa",
    },
    copyCode: (code) => `Copiar ${code}`,
    shot: {
      alt: "La página Webhook entrante de Bitrix24. Abajo, en los permisos, están elegidos Usuarios (básico) user_basic, CRM crm y Estructura de la empresa department.",
      caption: "Los tres permisos, elegidos",
    },
    enlarge: (caption) => `Ampliar: ${caption}`,
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
        "En Bitrix24, abre el webhook y comprueba que están elegidos los tres permisos: Usuarios (básico), user_basic; CRM, crm; Estructura de la empresa, department. Guarda. La dirección no cambia: pulsa Comprobar de nuevo.",
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
  app: {
    title: "Crea una aplicación local",
    lead: (host) =>
      `Una aplicación local permite a WireCat trabajar en ${host} con los permisos del empleado que inicia sesión. Se crea una sola vez, en Bitrix24. La sesión se renueva sola.`,
    open: "Abrir Recursos para desarrolladores",
    steps: {
      open: (host) => `Abre Recursos para desarrolladores en ${host}. Elige Otro y luego Aplicación local.`,
      server: "Elige Servidor. Pega esta dirección en la ruta de tu controlador:",
      install:
        "Deja vacía la ruta de instalación inicial y deja sin marcar la opción de que la aplicación completa la instalación por sí misma.",
      rights: "En los permisos de acceso, marca estos tres.",
      save: "Pulsa Guardar. Copia el ID de la aplicación (client_id) y la clave de la aplicación (client_secret) en los campos de abajo.",
    },
    copyHandler: "Copiar la ruta del controlador",
    docs: "Guía completa en wirecat.dev",
    idLabel: "ID de la aplicación (client_id)",
    idPlaceholder: "local.0123abcd.45678901",
    keyLabel: "Clave de la aplicación (client_secret)",
    show: "Mostrar la clave",
    hide: "Ocultar la clave",
    keyHint: "Se queda en este ordenador, en el llavero del sistema.",
    kept: "La clave que escribiste sigue aquí. Escríbela de nuevo solo si la cambiaste en Bitrix24.",
    missingId: "Pega el ID de la aplicación que muestra Bitrix24, por ejemplo local.0123abcd.45678901.",
    missingKey: "Pega la clave de la aplicación que Bitrix24 muestra junto al ID.",
    browser:
      "Después se abre en el navegador el inicio de sesión del portal. Permite la aplicación y el navegador devuelve la sesión a WireCat.",
    acts: "El agente actúa con los permisos del empleado que inicia sesión: ve y cambia solo lo que esa persona puede.",
    time: "Unos 5 minutos",
    signIn: "Iniciar sesión en el navegador",
    again: "Iniciar sesión de nuevo",
    problem: {
      refused: {
        title: "Bitrix24 rechazó el ID o la clave de la aplicación.",
        cause: "Copia los dos de nuevo desde la página de la aplicación y comprueba que está guardada en este portal.",
      },
      payment: {
        title: "Bitrix24 no da acceso a aplicaciones en este plan.",
        cause: "El plan del portal no lo permite. Usa el webhook entrante: Atrás y luego Webhook entrante.",
      },
      wrongPortal: {
        title: "El navegador inició sesión en otro portal.",
        cause: "Inicia sesión en el portal que escribiste en el primer paso, o cámbialo allí.",
      },
      unreachable: {
        title: "WireCat no pudo conectar con el inicio de sesión de Bitrix24.",
        cause: "Revisa tu conexión y vuelve a intentarlo en un minuto.",
      },
      scope: {
        title: "La aplicación no puede leer quién inició sesión.",
        cause:
          "En Bitrix24, abre la aplicación y comprueba que están elegidos los tres permisos: Usuarios (básico), user_basic; CRM, crm; Estructura de la empresa, department. Guarda e inicia sesión de nuevo.",
      },
      invalid: {
        title: "La herramienta de Bitrix24 rechazó lo escrito.",
        cause: "Revisa la dirección del portal y el ID de la aplicación.",
      },
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
