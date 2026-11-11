import type { ReactNode } from "react"
import type { ACCOUNT_KEEPS, ACCOUNT_REMOVES } from "@/domain/catalog"
import type { Messages } from "@/i18n"
import type { RemovalHolder, RemovalKind } from "@/platform/bindings"

type Removes = (typeof ACCOUNT_REMOVES)[number]
type Keeps = (typeof ACCOUNT_KEEPS)[number]
export type DataWhat = "messages" | "files" | "meetings" | "mail" | "events"

const en = {
  row: {
    menu: (profile: string) => `More for ${profile}`,
    more: "More",
    check: "Check",
    checking: "Checking…",
    folders: "Choose folders",
    settings: "Settings",
    signInAgain: "Reconnect",
    signIn: "Sign in",
    remove: "Remove account",
    region: (tool: string, profile: string) => `${tool} account ${profile}`,
    list: (tool: string) => `${tool} accounts`,
    closeCheck: "Close the check",
  },
  remove: {
    title: (profile: string) => `Remove ${profile}?`,
    lead: (tool: string) => `Choose what happens to this ${tool} account on this computer.`,
    keepTitle: "Sign out, keep its data",
    deleteTitle: "Sign out and delete its data",
    removesHead: "This removes",
    keepsHead: "This stays",
    removes: {
      signIn: () => "The sign-in on this computer",
      serverSession: (tool: string) => `The session ${tool} keeps for this computer: ${tool} ends it too`,
      deviceKeys: () => "The keys of this linked device",
      linkedDevice: (tool: string) => `This computer in ${tool}'s linked devices on your phone`,
    } satisfies Record<Removes, (tool: string) => string>,
    keeps: {
      appKeys: () => "Your Telegram app keys (API id and hash) in the system keyring",
      settings: () => "The account's settings",
      folders: () => "The folders you chose to import, and its settings",
      data: (what: string) => `The ${what} already copied here: you and your agent can still search them`,
      mail: () => "The mail already copied here: you and your agent can still search it",
      listed: () => "Its name in this list, as signed out: sign in again to use it",
      googleAccess: () => "WireCat's access in your Google account. To end it, remove WireCat at myaccount.google.com",
      providerAccess: () =>
        "The access you gave at your mail provider. End it in your mail account's security settings",
    } satisfies Record<Keeps, (what: string) => string>,
    what: {
      messages: "messages",
      files: "file texts",
      meetings: "meetings and transcripts",
      mail: "mail",
      events: "calendar events",
    } satisfies Record<DataWhat, string>,
    noDelete: (tool: string) =>
      `${tool} cannot delete one account's data yet. Clear storage on the Storage page deletes the data of every account.`,
    noSignOut: (tool: string) =>
      `${tool} cannot sign an account out yet. To end its access, remove the app you made in your ${tool} account.`,
    runs: "It runs:",
    cancel: "Keep the account",
    confirm: "Sign out",
    running: "Signing out…",
    done: (profile: string, tool: string): ReactNode => (
      <>
        {profile} is signed out of {tool}. Its data stays on this computer.
      </>
    ),
    wasOut: (profile: string) => `${profile} was not signed in, so nothing changed. Its data stays on this computer.`,
    failed: "The account is still signed in.",
    tryAgain: "Try again",
    close: "Close",
    finish: "Done",
    signInAgain: "Sign in again",
    checking: (tool: string) => `Checking what ${tool} can remove…`,
    keepChoice: "Remove, keep its data (search still finds it)",
    keepChoiceNote: (what: string) =>
      `WireCat signs it out and forgets it here. The ${what} already copied stay, and you and your agent can still search them.`,
    deleteChoice: "Remove and delete its data",
    deleteChoiceNote: (what: string) => `WireCat signs it out, forgets it here and deletes the ${what} copied from it.`,
    planning: "Listing what this removes…",
    kinds: {
      signIn: () => "Sign-in",
      keyring: () => "Saved keys in the system keyring",
      config: () => "Settings",
      file: () => "Files",
      store: (what: string) => `Its ${what} in the shared store`,
      unit: () => "Background service",
      schedule: () => "Scheduled jobs",
    } satisfies Record<RemovalKind, (what: string) => string>,
    short: {
      signIn: () => "the sign-in",
      keyring: () => "saved keys",
      config: () => "settings",
      file: () => "files",
      store: (what: string) => `its ${what}`,
      unit: () => "the background service",
      schedule: () => "scheduled jobs",
    } satisfies Record<RemovalKind, (what: string) => string>,
    storeStays: "Kept as you chose: search still finds them",
    keptByChoice: "Kept as you chose",
    signInHere: "Sign-in on this computer",
    signInSession: (service: string) => `${service} also ends this session on its servers.`,
    signInRevokes: "The service is asked to take its access back.",
    signInRevoked: "The service took its access back.",
    signInLocal: "Signs out on this computer. The provider keeps its access.",
    signInAppPassword:
      "Signs out on this computer. If you signed in with an app password, delete it in your mail account's settings too.",
    signInGoogleRevoked: "Google access was revoked.",
    signInProviderKept: "Access at the provider was kept.",
    signInKept: "The service could not take its access back. Remove it in your account's security settings.",
    reasons: {
      sends: "The record of what was sent for this account",
      storeEmpty: "The shared store does not exist yet, so it holds nothing of this account",
      storeUnknown: "This account never recorded who it is, so nothing in the shared store can be told apart as its",
      movedRun: "A run with moved folders never removes your sign-in",
    },
    fromTool: (tool: string) => `from ${tool}`,
    busyUsing: (holder: string) => `${holder} is using this account.`,
    details: "Details",
    configIn: "in",
    confirmKeep: (profile: string) => `Remove ${profile}, keep its data`,
    confirmDelete: (profile: string) => `Remove ${profile} and delete its data`,
    removing: "Removing…",
    doneKeep: (profile: string, tool: string, what: string) =>
      `${profile} is removed from ${tool}. Its ${what} stay on this computer, and search still finds them.`,
    doneDelete: (profile: string, tool: string, what: string) =>
      `${profile} is removed from ${tool}, and its ${what} are deleted from this computer.`,
    doneList: (list: string) => `Removed: ${list}.`,
    revoked: (tool: string) => `${tool} also ended the sign-in on its side.`,
    busyHead: "Nothing was removed: something is using this account right now.",
    holders: {
      sync: (profile: string) =>
        `A sync of ${profile} is running. Stop it beside its Sync button, or wait for it to finish, then try again.`,
      install: (_: string, tool: string) =>
        `${tool} is being installed or updated. Wait until it finishes, then try again.`,
      signIn: (_: string, tool: string) => `A sign-in to ${tool} is open. Finish or close it, then try again.`,
    } satisfies Record<RemovalHolder, (profile: string, tool: string) => string>,
    busyTool: "Stop it, then try again.",
    refusedHead: (tool: string) => `${tool} removed nothing.`,
    unknownProfile: (tool: string, profile: string) =>
      `${tool} has no account named ${profile} on this computer. Close this to refresh the list.`,
    outside: (tool: string) =>
      `${tool} named a folder outside its own, so it stopped before removing anything. This is a bug in ${tool}: please report it.`,
    update: (tool: string) => `Update ${tool} to remove the account fully.`,
  },
}

export type AccountsText = typeof en

const ru: AccountsText = {
  row: {
    menu: (profile) => `Ещё для ${profile}`,
    more: "Ещё",
    check: "Проверить",
    checking: "Проверяем…",
    folders: "Выбрать папки",
    settings: "Настройки",
    signInAgain: "Переподключить",
    signIn: "Войти",
    remove: "Удалить аккаунт",
    region: (tool, profile) => `Аккаунт ${tool} ${profile}`,
    list: (tool) => `Аккаунты ${tool}`,
    closeCheck: "Закрыть проверку",
  },
  remove: {
    title: (profile) => `Удалить ${profile}?`,
    lead: (tool) => `Выберите, что станет с этим аккаунтом ${tool} на этом компьютере.`,
    keepTitle: "Выйти, данные оставить",
    deleteTitle: "Выйти и удалить данные",
    removesHead: "Удалится",
    keepsHead: "Останется",
    removes: {
      signIn: () => "Вход на этом компьютере",
      serverSession: (tool) => `Сеанс, который ${tool} хранит для этого компьютера: ${tool} тоже его завершит`,
      deviceKeys: () => "Ключи этого связанного устройства",
      linkedDevice: (tool) => `Этот компьютер в списке связанных устройств ${tool} на телефоне`,
    },
    keeps: {
      appKeys: () => "Ключи вашего приложения Telegram (API id и hash) в системном хранилище ключей",
      settings: () => "Настройки аккаунта",
      folders: () => "Папки, выбранные для импорта, и настройки аккаунта",
      data: (what) => `Уже скопированные сюда ${what}: вы и ваш агент сможете по ним искать`,
      mail: () => "Уже скопированная сюда почта: вы и ваш агент сможете по ней искать",
      listed: () => "Его имя в этом списке, с отметкой «вход не выполнен»: войдите заново, чтобы им пользоваться",
      googleAccess: () =>
        "Доступ WireCat в вашем аккаунте Google. Чтобы его отозвать, удалите WireCat на myaccount.google.com",
      providerAccess: () => "Доступ, выданный у почтового сервиса. Отзовите его в настройках безопасности почты",
    },
    what: {
      messages: "сообщения",
      files: "тексты файлов",
      meetings: "встречи и расшифровки",
      mail: "письма",
      events: "события календаря",
    },
    noDelete: (tool) =>
      `${tool} пока не умеет удалять данные одного аккаунта. «Очистить хранилище» на странице «Хранилище» удаляет данные всех аккаунтов.`,
    noSignOut: (tool) =>
      `${tool} пока не умеет выходить из аккаунта. Чтобы закрыть доступ, удалите созданное вами приложение в аккаунте ${tool}.`,
    runs: "Команда:",
    cancel: "Оставить аккаунт",
    confirm: "Выйти",
    running: "Выходим…",
    done: (profile, tool) => (
      <>
        Аккаунт {profile} вышел из {tool}. Его данные остались на этом компьютере.
      </>
    ),
    wasOut: (profile) =>
      `Аккаунт ${profile} и так не был в системе, ничего не изменилось. Данные остались на компьютере.`,
    failed: "Аккаунт всё ещё в системе.",
    tryAgain: "Попробовать ещё раз",
    close: "Закрыть",
    finish: "Готово",
    signInAgain: "Войти заново",
    checking: (tool) => `Проверяем, что ${tool} может удалить…`,
    keepChoice: "Удалить, данные оставить (поиск их найдёт)",
    keepChoiceNote: (what) =>
      `WireCat выйдет из аккаунта и забудет его здесь. Уже скопированные ${what} останутся, и вы с агентом сможете по ним искать.`,
    deleteChoice: "Удалить вместе с данными",
    deleteChoiceNote: (what) => `WireCat выйдет из аккаунта, забудет его здесь и удалит скопированные из него ${what}.`,
    planning: "Составляем список того, что удалится…",
    kinds: {
      signIn: () => "Вход",
      keyring: () => "Сохранённые ключи в системном хранилище",
      config: () => "Настройки",
      file: () => "Файлы",
      store: (what) => `Его ${what} в общем хранилище`,
      unit: () => "Фоновая служба",
      schedule: () => "Задания по расписанию",
    },
    short: {
      signIn: () => "вход",
      keyring: () => "сохранённые ключи",
      config: () => "настройки",
      file: () => "файлы",
      store: (what) => `${what} в хранилище`,
      unit: () => "фоновая служба",
      schedule: () => "задания по расписанию",
    },
    storeStays: "Останутся, как вы выбрали: поиск их найдёт",
    keptByChoice: "Останутся, как вы выбрали",
    signInHere: "Вход на этом компьютере",
    signInSession: (service) => `${service} также завершает этот сеанс на своих серверах.`,
    signInRevokes: "Сервис попросят забрать выданный доступ.",
    signInRevoked: "Сервис забрал выданный доступ.",
    signInLocal: "Выход на этом компьютере. Доступ у провайдера остаётся.",
    signInAppPassword:
      "Выход на этом компьютере. Если вы входили по паролю приложения, удалите его и в настройках почтового аккаунта.",
    signInGoogleRevoked: "Доступ Google отозван.",
    signInProviderKept: "Доступ у провайдера сохранён.",
    signInKept: "Сервис не смог забрать доступ. Уберите его в настройках безопасности аккаунта.",
    reasons: {
      sends: "Журнал того, что было отправлено с этого аккаунта",
      storeEmpty: "Общего хранилища ещё нет, так что от этого аккаунта там ничего нет",
      storeUnknown: "Аккаунт не запомнил, кто он, поэтому в общем хранилище нельзя отделить его данные",
      movedRun: "Запуск с перенесёнными папками никогда не удаляет ваш вход",
    },
    fromTool: (tool) => `от ${tool}`,
    busyUsing: (holder) => `${holder} использует этот аккаунт.`,
    details: "Подробности",
    configIn: "в",
    confirmKeep: (profile) => `Удалить ${profile}, данные оставить`,
    confirmDelete: (profile) => `Удалить ${profile} вместе с данными`,
    removing: "Удаляем…",
    doneKeep: (profile, tool, what) =>
      `Аккаунт ${profile} удалён из ${tool}. Его ${what} остались на этом компьютере, и поиск их найдёт.`,
    doneDelete: (profile, tool, what) =>
      `Аккаунт ${profile} удалён из ${tool}, его ${what} удалены с этого компьютера.`,
    doneList: (list) => `Удалено: ${list}.`,
    revoked: (tool) => `${tool} также отозвал вход на своей стороне.`,
    busyHead: "Ничего не удалено: этим аккаунтом сейчас что-то пользуется.",
    holders: {
      sync: (profile) =>
        `Идёт синхронизация ${profile}. Остановите её рядом с кнопкой синхронизации или дождитесь конца, затем попробуйте ещё раз.`,
      install: (_, tool) => `${tool} сейчас устанавливается или обновляется. Дождитесь окончания и попробуйте ещё раз.`,
      signIn: (_, tool) => `Открыт вход в ${tool}. Завершите или закройте его, затем попробуйте ещё раз.`,
    },
    busyTool: "Остановите его и попробуйте ещё раз.",
    refusedHead: (tool) => `${tool} ничего не удалил.`,
    unknownProfile: (tool, profile) =>
      `У ${tool} нет аккаунта ${profile} на этом компьютере. Закройте окно, чтобы обновить список.`,
    outside: (tool) =>
      `${tool} указал папку вне своих, поэтому остановился, ничего не удалив. Это ошибка в ${tool}: пожалуйста, сообщите о ней.`,
    update: (tool) => `Обновите ${tool}, чтобы удалять аккаунт полностью.`,
  },
}

const es: AccountsText = {
  row: {
    menu: (profile) => `Más para ${profile}`,
    more: "Más",
    check: "Comprobar",
    checking: "Comprobando…",
    folders: "Elegir carpetas",
    settings: "Ajustes",
    signInAgain: "Reconectar",
    signIn: "Iniciar sesión",
    remove: "Quitar cuenta",
    region: (tool, profile) => `Cuenta de ${tool} ${profile}`,
    list: (tool) => `Cuentas de ${tool}`,
    closeCheck: "Cerrar la comprobación",
  },
  remove: {
    title: (profile) => `¿Quitar ${profile}?`,
    lead: (tool) => `Elige qué pasa con esta cuenta de ${tool} en este ordenador.`,
    keepTitle: "Cerrar sesión y conservar sus datos",
    deleteTitle: "Cerrar sesión y borrar sus datos",
    removesHead: "Se quita",
    keepsHead: "Se queda",
    removes: {
      signIn: () => "El inicio de sesión en este ordenador",
      serverSession: (tool) => `La sesión que ${tool} guarda para este ordenador: ${tool} también la cierra`,
      deviceKeys: () => "Las claves de este dispositivo vinculado",
      linkedDevice: (tool) => `Este ordenador en los dispositivos vinculados de ${tool} en tu teléfono`,
    },
    keeps: {
      appKeys: () => "Las claves de tu app de Telegram (API id y hash) en el llavero del sistema",
      settings: () => "Los ajustes de la cuenta",
      folders: () => "Las carpetas que elegiste importar, y sus ajustes",
      data: (what) => `Los ${what} ya copiados aquí: tú y tu agente podéis seguir buscando en ellos`,
      mail: () => "El correo ya copiado aquí: tú y tu agente podéis seguir buscando en él",
      listed: () => "Su nombre en esta lista, sin sesión: vuelve a iniciar sesión para usarla",
      googleAccess: () =>
        "El acceso de WireCat en tu cuenta de Google. Para quitarlo, elimina WireCat en myaccount.google.com",
      providerAccess: () => "El acceso que diste en tu servicio de correo. Quítalo en sus ajustes de seguridad",
    },
    what: {
      messages: "mensajes",
      files: "textos de archivos",
      meetings: "reuniones y transcripciones",
      mail: "correos",
      events: "eventos del calendario",
    },
    noDelete: (tool) =>
      `${tool} aún no puede borrar los datos de una sola cuenta. Vaciar el almacenamiento en la página Almacenamiento borra los datos de todas las cuentas.`,
    noSignOut: (tool) =>
      `${tool} aún no puede cerrar la sesión de una cuenta. Para quitar su acceso, elimina la app que creaste en tu cuenta de ${tool}.`,
    runs: "Ejecuta:",
    cancel: "Conservar la cuenta",
    confirm: "Cerrar sesión",
    running: "Cerrando sesión…",
    done: (profile, tool) => (
      <>
        {profile} ya no tiene sesión en {tool}. Sus datos siguen en este ordenador.
      </>
    ),
    wasOut: (profile) =>
      `${profile} no tenía la sesión iniciada, así que nada cambió. Sus datos siguen en este ordenador.`,
    failed: "La cuenta sigue con la sesión iniciada.",
    tryAgain: "Reintentar",
    close: "Cerrar",
    finish: "Listo",
    signInAgain: "Volver a iniciar sesión",
    checking: (tool) => `Comprobando qué puede quitar ${tool}…`,
    keepChoice: "Quitar y conservar sus datos (la búsqueda los sigue encontrando)",
    keepChoiceNote: (what) =>
      `WireCat cierra su sesión y la olvida aquí. Lo ya copiado (${what}) se queda, y tú y tu agente podéis seguir buscando en ello.`,
    deleteChoice: "Quitar y borrar sus datos",
    deleteChoiceNote: (what) => `WireCat cierra su sesión, la olvida aquí y borra lo que se copió de ella (${what}).`,
    planning: "Preparando la lista de lo que se quita…",
    kinds: {
      signIn: () => "Inicio de sesión",
      keyring: () => "Claves guardadas en el llavero del sistema",
      config: () => "Ajustes",
      file: () => "Archivos",
      store: (what) => `Sus ${what} en el almacén compartido`,
      unit: () => "Servicio en segundo plano",
      schedule: () => "Tareas programadas",
    },
    short: {
      signIn: () => "el inicio de sesión",
      keyring: () => "las claves guardadas",
      config: () => "los ajustes",
      file: () => "los archivos",
      store: (what) => `sus ${what}`,
      unit: () => "el servicio en segundo plano",
      schedule: () => "las tareas programadas",
    },
    storeStays: "Se quedan, como elegiste: la búsqueda los sigue encontrando",
    keptByChoice: "Se quedan, como elegiste",
    signInHere: "Inicio de sesión en este equipo",
    signInSession: (service) => `${service} también cierra esta sesión en sus servidores.`,
    signInRevokes: "Se pide al servicio que retire su acceso.",
    signInRevoked: "El servicio retiró su acceso.",
    signInLocal: "Cierra la sesión en este equipo. El proveedor conserva su acceso.",
    signInAppPassword:
      "Cierra la sesión en este equipo. Si entraste con una contraseña de aplicación, bórrala también en los ajustes de tu cuenta de correo.",
    signInGoogleRevoked: "Se retiró el acceso de Google.",
    signInProviderKept: "Se conservó el acceso en el proveedor.",
    signInKept: "El servicio no pudo retirar su acceso. Quítalo en los ajustes de seguridad de tu cuenta.",
    reasons: {
      sends: "El registro de lo enviado desde esta cuenta",
      storeEmpty: "El almacén compartido aún no existe, así que no guarda nada de esta cuenta",
      storeUnknown:
        "Esta cuenta nunca registró quién es, así que nada del almacén compartido se puede distinguir como suyo",
      movedRun: "Una ejecución con carpetas movidas nunca quita tu inicio de sesión",
    },
    fromTool: (tool) => `de ${tool}`,
    busyUsing: (holder) => `${holder} está usando esta cuenta.`,
    details: "Detalles",
    configIn: "en",
    confirmKeep: (profile) => `Quitar ${profile} y conservar sus datos`,
    confirmDelete: (profile) => `Quitar ${profile} y borrar sus datos`,
    removing: "Quitando…",
    doneKeep: (profile, tool, what) =>
      `${profile} ya no está en ${tool}. Sus ${what} siguen en este ordenador y siguen apareciendo en la búsqueda.`,
    doneDelete: (profile, tool, what) =>
      `${profile} ya no está en ${tool}, y sus ${what} se han borrado de este ordenador.`,
    doneList: (list) => `Se quitó: ${list}.`,
    revoked: (tool) => `${tool} también retiró el inicio de sesión por su parte.`,
    busyHead: "No se quitó nada: algo está usando esta cuenta ahora.",
    holders: {
      sync: (profile) =>
        `Se está sincronizando ${profile}. Detén la sincronización junto a su botón o espera a que termine, y vuelve a intentarlo.`,
      install: (_, tool) => `${tool} se está instalando o actualizando. Espera a que termine y vuelve a intentarlo.`,
      signIn: (_, tool) => `Hay un inicio de sesión de ${tool} abierto. Termínalo o ciérralo, y vuelve a intentarlo.`,
    },
    busyTool: "Detenlo y vuelve a intentarlo.",
    refusedHead: (tool) => `${tool} no quitó nada.`,
    unknownProfile: (tool, profile) =>
      `${tool} no tiene ninguna cuenta llamada ${profile} en este ordenador. Cierra esto para actualizar la lista.`,
    outside: (tool) =>
      `${tool} indicó una carpeta fuera de las suyas, así que se detuvo sin quitar nada. Es un error de ${tool}: por favor, infórmalo.`,
    update: (tool) => `Actualiza ${tool} para quitar la cuenta por completo.`,
  },
}

export const accountsMessages: Messages<AccountsText> = { en, ru, es }
