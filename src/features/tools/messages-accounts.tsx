import type { ReactNode } from "react"
import type { ACCOUNT_KEEPS, ACCOUNT_REMOVES } from "@/domain/catalog"
import type { Messages } from "@/i18n"

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
    signInAgain: "Sign in again",
    signIn: "Sign in",
    remove: "Remove account…",
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
    signInAgain: "Войти заново",
    signIn: "Войти",
    remove: "Удалить аккаунт…",
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
    signInAgain: "Volver a iniciar sesión",
    signIn: "Iniciar sesión",
    remove: "Quitar cuenta…",
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
  },
}

export const accountsMessages: Messages<AccountsText> = { en, ru, es }
