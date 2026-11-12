import type { ReactNode } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import type { DoctorNote } from "@/domain/doctor"
import { formatNumber, type Messages, plural } from "@/i18n"
import { uiMessages } from "@/ui/messages"
import { ES_SUMMARY, ES_TAGLINE, RU_SUMMARY, RU_TAGLINE } from "./messages-tool-text"
import { syncNote } from "./tool-text"

type Em = (text: string) => ReactNode
type Step = Record<string, string>

const byId = (pick: (t: CatalogTool) => string | null | undefined) =>
  Object.fromEntries(tools.flatMap((t) => (pick(t) ? [[t.id, pick(t) as string]] : [])))

const en = {
  page: {
    title: "Tools",
    looking: "Looking for WireCat tools on this computer…",
    askingNpm: "Checking npm for newer versions…",
    checkAgain: "Check again",
    checking: "Checking…",
    inspectFailed: "Could not inspect this computer.",
    systemFailed: "Could not check Node.js and npm.",
    checkingStorage: "Checking storage",
    list: "WireCat tools",
    latestUnknown: "Could not ask npm for the latest versions, so updates are not shown.",
  },
  intro: {
    label: "About WireCat",
    text: "WireCat gives your AI agent your messengers, meetings, mail and documents. Each service has a small command-line tool that your agent runs; everything stays on this computer.",
    install: (em: Em): ReactNode => <>{em("Install")} the tools for the services you use.</>,
    signIn: (em: Em): ReactNode => <>{em("Sign in")} to an account under Manage.</>,
    connect: (link: Em): ReactNode => <>{link("Connect your agent")} on the Agents page.</>,
    choose: "Choose tools to install",
    hide: "Hide this introduction",
  },
  // tools.json is the English source; catalogs.test.ts fails until a new tool's text is translated.
  tool: {
    tagline: byId((t) => t.tagline),
    summary: byId((t) => t.summary),
    syncNote: byId(syncNote),
    group: Object.fromEntries(tools.flatMap((t) => t.permissions?.groups ?? []).map((g) => [g.key, g.label])),
  },
  row: {
    status: {
      checking: "Checking",
      missing: uiMessages.en.notInstalled,
      installing: "Installing",
      uninstalling: "Uninstalling",
      broken: "Installed, but it does not start",
      outdated: "Update available",
      readyChecking: "Installed, checking for updates",
      ready: "Installed and up to date",
    },
    withStorage: (status: string, storage: string) => `${status}. ${storage}`,
    partOf: (name: string) => `Part of ${name}`,
    community: "Community",
    trust: (maker: string) => `Made by ${maker}, not by WireCat. The app checks where npm built it, not what it does.`,
    copies: (n: number) => plural("en", n, { one: "# copy installed", other: "# copies installed" }),
    browserApp: "A browser app",
    nodeFirst: "Node.js is needed first",
    doesNotStart: "Does not start",
    notInstalled: uiMessages.en.notInstalled,
    cancel: "Cancel",
    updateTo: (version: string) => `Update to ${version}`,
    install: "Install",
    fix: "Fix",
    manage: "Manage",
  },
  install: {
    steps: {
      install: { check: "Checking requirements", install: "Installing", verify: "Verifying", done: "Done" } as Step,
      uninstall: { check: "Finding copies", remove: "Removing", verify: "Verifying", done: "Done" } as Step,
    },
    waiting: "Waiting for the operation in progress to finish.",
    installed: (names: string, version: string, shared: boolean) =>
      shared ? `${names} ${version} are installed and run.` : `${names} ${version} is installed and runs.`,
    removed: (names: string, shared: boolean) => (shared ? `${names} are uninstalled.` : `${names} is uninstalled.`),
    dataKept: "The data stays on this computer until you delete it in Storage.",
    dataDeleted: (size: string) => `Its data (${size}) is deleted.`,
    dataFailed: "Its data could not be deleted:",
    dataDeleting: "Deleting its data…",
    dataUntouched: "Its data was not touched.",
    cancelled: { install: "Installation cancelled.", uninstall: "Uninstalling cancelled." } as Step,
    timedOut: {
      install: "Installation took longer than 15 minutes and was stopped.",
      uninstall: "Uninstalling took longer than 15 minutes and was stopped.",
    } as Step,
    timedOutHint: "Check your connection and try again.",
    network: "Could not reach the npm registry.",
    networkHint: "Check your internet connection or proxy, then try again.",
    unconfirmed: "This release could not be confirmed as built by its own repository, so it was not installed.",
    unconfirmedHint:
      "Nothing on your computer changed. Try again later; if it keeps happening, tell us with Report a problem.",
    shadowed: (path: ReactNode): ReactNode => <>WireCat runs another copy of the same or a newer version, at {path}.</>,
    skillsRefreshed: (agents: string) => `Updated the instructions for ${agents} to this version.`,
    skillsFailed: "The update is installed, but the instructions for your AI agents are still the old ones:",
    otherAgents: "your other AI agents",
    openAgents: "Open Agents",
    showLog: "Show log",
    hideLog: "Hide log",
    tryAgain: "Try again",
    addAccount: "Add an account",
    close: "Close",
    done: "Done",
    log: "Output log",
    waitingOutput: "Waiting for output…",
  },
  details: {
    installFirst: (name: string) => `Install ${name} to connect an account and run health checks.`,
    about: (name: string) => `About ${name}`,
    docs: "Documentation",
    github: "GitHub",
    installFromTerminal: "Install from a terminal",
    copyInstall: "Copy the install command",
    installedAt: "Installed at",
    notInstalledHere: "Not installed on this computer.",
    doesNotStart: "does not start",
    runsFirst: "runs first",
    notUsed: "not used",
    uninstall: "Uninstall",
    extraLabel: (name: string) => `More than one copy of ${name}`,
    extra: (n: number, bin: ReactNode, path: ReactNode, version: string, manager: string): ReactNode =>
      n === 2 ? (
        <>
          2 copies of {bin} are installed. WireCat runs the newest, {path} ({version}, {manager}). A terminal or an
          agent may still run the other one, and it can confuse updates. Remove it here, or run the command of the
          program that installed it:
        </>
      ) : (
        <>
          {n} copies of {bin} are installed. WireCat runs the newest, {path} ({version}, {manager}). A terminal or an
          agent may still run another one, and they can confuse updates. Remove them here, or run the command of the
          program that installed each:
        </>
      ),
    removeCopy: (path: string) => `Copy the command that removes ${path}`,
    kind: { config: "config", state: "state", cache: "cache" } as Step,
  },
  uninstall: {
    title: (names: string) => `Uninstall ${names}?`,
    keep: "Keep it",
    uninstall: "Uninstall",
    andDelete: "Uninstall and delete data",
    together: (names: string) => `Uninstall removes ${names} together: they are one program.`,
    removes: (command: ReactNode, copies: number): ReactNode => (
      <>
        This removes the {command} command
        {copies === 2
          ? " (both copies, each with the program that installed it)"
          : copies > 2
            ? ` (all ${copies} copies, each with the program that installed it)`
            : ""}
        . Your profiles, storage and settings stay on this computer unless you delete them below.
      </>
    ),
    services:
      "If you set up background services with it (a server or a timer), remove them first with the tool itself.",
    alsoDelete: (name: string) => `Also delete ${name}'s data`,
    noData: "It has no data on this computer.",
    dataWhat: "Its settings, sign-in sessions and caches. Deleted only if the uninstall succeeds.",
    sharedStays: "Messages in the shared storage stay; other tools use it. Clear them on Storage.",
    foldersFailed: "Could not read its folders.",
    readingFolders: "Reading its folders",
    folders: (name: string) => `${name}'s data folders`,
    inAll: (size: string) => `${size} in all`,
  },
  health: {
    section: (name: string) => `${name} accounts and health`,
    accounts: "Accounts",
    health: "Health",
    checkHealth: "Check health",
    checking: "Checking…",
    check: "Check",
    profilesFailed: "Could not list profiles.",
    loadingProfiles: "Loading profiles",
    signedIn: "signed in",
    notSignedIn: "not signed in",
    signIn: "Sign in",
    setUp: "Set up",
    noAccountHere: (name: string) => `No account yet. Name it, then sign in to ${name} here or in a terminal window.`,
    noAccountTerminal: (name: string) => `No account yet. Name it, then sign in to ${name} in a terminal window.`,
    noAccount: "No account yet.",
    finishInTerminal: (command: ReactNode): ReactNode => (
      <>
        A terminal window opened and runs {command}. Answer its questions there: a code, a QR code or a page in your
        browser. When it says you are signed in, come back here and press Check sign-in.
      </>
    ),
    terminalPreview: (command: ReactNode): ReactNode => (
      <>
        This is the browser preview, so no terminal opens. In the app, this button opens a terminal window that runs{" "}
        {command}. You answer its questions there, then come back and press Check sign-in.
      </>
    ),
    terminalFailed: "The terminal window did not open:",
    signedInNow: (profile: string, tool: string) =>
      `${profile} is signed in to ${tool}. Your agents can use this account now; you can close the terminal window.`,
    checkSignIn: "Check sign-in",
    manual: "Add an account from a terminal; this has no sign-in window yet.",
    howToSetUp: "How to set it up",
    copyAddAccount: (name: string) => `Copy the command that adds a ${name} account`,
    checkAgain: "Check again",
    profileName: "Add new account",
    accountName: "Account name",
    signInHere: "Sign in here",
    openTerminal: "Open terminal",
    openTerminalToSignIn: "Open terminal to sign in",
    nameInvalid: "Use Latin letters, digits, dots, dashes or underscores.",
    nameEmpty: "Type a name for this account first, such as personal.",
    nameHintHere: (command: ReactNode): ReactNode => (
      <>
        Any short name, such as personal or work: one name per account. Sign in here shows the QR code in this window;
        the terminal runs {command}.
      </>
    ),
    nameHintTerminal: (command: ReactNode): ReactNode => (
      <>Any short name, such as personal or work: one name per account. The terminal window runs {command}.</>
    ),
    noTerminal:
      "WireCat found no terminal program to open, so nothing started. Open a terminal yourself, run this command, then press Check sign-in:",
    copySetup: "Copy the setup command",
    configProblems: "Configuration problems",
    openSettingsFolder: "Open settings folder",
    copyFix: "Copy the fix command",
    repair: "Repair the file",
    repairing: "Repairing…",
    repaired: (what: string) => `Repaired the settings file: ${what}.`,
    repairedNothingListed: "Repaired the settings file.",
    atLine: (n: number) => `line ${n}`,
    repairKind: {
      byte_order_mark: "removed an invisible mark at the start of the file",
      comment: "removed a comment",
      trailing_comma: "removed a comma after the last entry",
      missing_comma: "added a missing comma",
      unquoted_key: "put quotes around a setting name",
      single_quotes: "changed single quotes to double quotes",
      missing_closer: "added a missing closing bracket at the end",
    },
    repairNothing: "The file needed no repair: it reads correctly now.",
    repairNoFile: "There is no settings file to repair.",
    backupAt: "The file as it was is kept at",
    repairRefused: (tool: string) => `${tool} did not change the file:`,
    repairByHand: "It changes nothing it cannot fix safely. Fix this line by hand in a text editor, then check again.",
    showFile: "Show the file in its folder",
    repairFailed: "The repair did not run:",
    fix: "Fix:",
    technical: "Technical details",
    command: "Command",
    exitCode: "Exit code",
    none: "none",
    took: "Took",
    hidden: "Account names, numbers, addresses and tokens are hidden.",
    running: "Running the check",
    note: {
      unreadable_issue: "A configuration problem could not be read.",
      invalid_setting: "A setting is not valid.",
      unknown_problem: "Unknown problem",
      tool_error: "The tool reported an error.",
      no_config: "No configuration file yet.",
      no_data: "No local data yet. Nothing has been synced.",
      no_token: "Not signed in: no token for this profile.",
      expired: "Sign-in has expired. Connect again to renew it.",
      not_signed_in: "Not signed in yet.",
      no_problems: "No problems found.",
    } as Record<Exclude<DoctorNote, "unreadable" | "stopped">, string>,
    unreadable: (code: string) => `The tool's answer could not be read (exit code ${code}).`,
    stopped: (code: string) => `The check stopped with exit code ${code}.`,
    unknownCode: "unknown",
  },
  storage: {
    heading: "Storage",
    cannotRead: (schema: number | null) =>
      schema === null ? "Can't read storage." : `Can't read storage (schema ${schema}).`,
    updateName: (name: string) => `Update ${name}.`,
    noNewer: "No newer version is out yet.",
    moves: (to: number, names: string) => `Its next run moves storage to schema ${to}; ${names} will stop reading it.`,
    labelCannotRead: "Can't read storage",
    labelMoves: "Will move storage past what other tools read",
    labelUnknown: "Can't say whether it reads storage",
    reads: (schema: number) => `Reads storage (schema ${schema}).`,
    readsNoFile: "Reads storage. There is no storage file yet.",
    unknown: (name: string, canUpdate: boolean) =>
      `This version of ${name} can't say whether it reads storage. ${canUpdate ? `Updating ${name} adds the check.` : "A later version adds the check."}`,
    locksOut: (name: string, to: number, min: number | null, names: string) =>
      `The next time ${name} runs, it moves storage to schema ${to}; reading it will take schema ${min} or later. ${names} read only older schemas and will stop reading storage. Update them first.`,
    movesAlone: (to: number) => `Reads storage, and moves it to schema ${to} when it next runs.`,
    movesAll: (to: number) =>
      `Reads storage, and moves it to schema ${to} when it next runs. Every other installed tool can read that.`,
    behind: (schema: number | null, needs: number, speaks: number | null, name: string) => {
      const written =
        schema === null
          ? `Storage needs a tool that reads schema ${needs} or later`
          : `A newer WireCat tool moved storage to schema ${schema}; reading it takes schema ${needs} or later`
      return `${written}${speaks === null ? "" : `, and this ${name} reads up to ${speaks}`}.`
    },
    updateToRead: (name: string) => `Update ${name} to read it again.`,
    noNewerOf: (name: string) => `No newer ${name} is out yet.`,
    allRead: "All installed tools can read storage.",
    cantSayYet: (_n: number, names: string) => `${names} can't say yet; a newer version adds the check.`,
    needUpdate: (n: number, names: string) =>
      n === 1
        ? `1 tool needs an update to read storage: ${names}.`
        : `${formatNumber(n, "en")} tools need an update to read storage: ${names}.`,
    noNewerVersions: "No newer versions are out yet.",
    updateOne: (name: string) => `Update ${name}`,
    updateThem: "Update them",
  },
  upgrade: {
    title: (tool: string, to: number) => `${tool} will move storage to schema ${to}`,
    notNow: "Not now",
    updateToo: (names: string) => `Update ${names} too`,
    locksOut: (n: number, names: string, to: number, name: string) =>
      `${names} can't read schema ${to}. ${n === 1 ? "It stops" : "They stop"} working with storage the next time ${name} runs, which may be soon if it runs in the background.`,
    mayLockOut: (n: number, names: string) =>
      n === 1
        ? `${names} can't say which schema it reads, so it may stop too.`
        : `${names} can't say which schema they read, so they may stop too.`,
    stuck: (n: number, names: string) =>
      `No newer ${names} is out yet, so updating can't fix ${n === 1 ? "it" : "them"} today.`,
  },
  clear: {
    title: "No WireCat tools are installed. Delete their data too?",
    keep: "Keep data",
    delete: (size: string) => `Delete ${size}`,
    text: (size: string) =>
      `The tools left ${size} on this computer: shared storage, sessions, settings and caches. Keep it if you may install them again; delete it to remove everything. Sign-in tokens in your system keyring are not touched.`,
  },
}

export type ToolsText = typeof en

const RU_NOTE: Record<string, string> = {
  wa: "В WhatsApp нет синхронизации, которую можно запустить. Новые сообщения приходят, пока работает его фоновая служба: смотрите «Фоновая служба» ниже.",
}

const RU_GROUP: Record<string, string> = {
  messages: "Сообщения",
  reactions: "Реакции",
  polls: "Опросы",
  topics: "Темы",
  chats: "Чаты и группы",
  contacts: "Контакты",
  account: "Аккаунт",
  attachments: "Файлы",
  tasks: "Задачи",
}

const ru: typeof en = {
  page: {
    title: "Инструменты",
    looking: "Ищем инструменты WireCat на этом компьютере…",
    askingNpm: "Проверяем в npm, есть ли новые версии…",
    checkAgain: "Проверить снова",
    checking: "Проверяем…",
    inspectFailed: "Не удалось проверить этот компьютер.",
    systemFailed: "Не удалось проверить Node.js и npm.",
    checkingStorage: "Проверяем хранилище",
    list: "Инструменты WireCat",
    latestUnknown: "Не удалось узнать в npm последние версии, поэтому обновления не показаны.",
  },
  intro: {
    label: "О WireCat",
    text: "WireCat даёт вашему ИИ-агенту доступ к мессенджерам, встречам, почте и документам. У каждого сервиса есть небольшой инструмент командной строки, который запускает агент; всё остаётся на этом компьютере.",
    install: (em) => <>{em("Установите")} инструменты для сервисов, которыми пользуетесь.</>,
    signIn: (em) => <>{em("Войдите")} в аккаунт в разделе «Управление».</>,
    connect: (link) => <>{link("Подключите агента")} на странице «Агенты».</>,
    choose: "Выбрать инструменты",
    hide: "Скрыть это вступление",
  },
  tool: { tagline: RU_TAGLINE, summary: RU_SUMMARY, syncNote: RU_NOTE, group: RU_GROUP },
  row: {
    status: {
      checking: "Проверяем",
      missing: uiMessages.ru.notInstalled,
      installing: "Устанавливается",
      uninstalling: "Удаляется",
      broken: "Установлен, но не запускается",
      outdated: "Есть обновление",
      readyChecking: "Установлен, ищем обновления",
      ready: "Установлен, последняя версия",
    },
    withStorage: (status, storage) => `${status}. ${storage}`,
    partOf: (name) => `Входит в ${name}`,
    community: "Сообщество",
    trust: (maker) => `Сделано ${maker}, не WireCat. Приложение проверяет, где npm собрал пакет, но не что он делает.`,
    copies: (n) =>
      plural("ru", n, {
        one: "# копия установлена",
        few: "# копии установлены",
        many: "# копий установлено",
        other: "# копии установлены",
      }),
    browserApp: "Приложение в браузере",
    nodeFirst: "Сначала нужен Node.js",
    doesNotStart: "Не запускается",
    notInstalled: uiMessages.ru.notInstalled,
    cancel: "Отменить",
    updateTo: (version) => `Обновить до ${version}`,
    install: "Установить",
    fix: "Исправить",
    manage: "Управление",
  },
  install: {
    steps: {
      install: { check: "Проверка требований", install: "Установка", verify: "Проверка", done: "Готово" },
      uninstall: { check: "Поиск копий", remove: "Удаление", verify: "Проверка", done: "Готово" },
    },
    waiting: "Ждём, пока закончится текущая операция.",
    installed: (names, version, shared) =>
      shared ? `${names} ${version} установлены и запускаются.` : `${names} ${version} установлен и запускается.`,
    removed: (names, shared) => (shared ? `${names} удалены.` : `${names} удалён.`),
    dataKept: "Данные остаются на этом компьютере, пока вы не удалите их в разделе «Хранилище».",
    dataDeleted: (size) => `Его данные (${size}) удалены.`,
    dataFailed: "Не удалось удалить его данные:",
    dataDeleting: "Удаляем его данные…",
    dataUntouched: "Его данные не тронуты.",
    cancelled: { install: "Установка отменена.", uninstall: "Удаление отменено." },
    timedOut: {
      install: "Установка шла дольше 15 минут и была остановлена.",
      uninstall: "Удаление шло дольше 15 минут и было остановлено.",
    },
    timedOutHint: "Проверьте подключение и попробуйте снова.",
    network: "Не удалось связаться с реестром npm.",
    networkHint: "Проверьте подключение к интернету или прокси и попробуйте снова.",
    unconfirmed: "Не удалось подтвердить, что выпуск собран из его репозитория, поэтому он не установлен.",
    unconfirmedHint:
      "На компьютере ничего не изменилось. Попробуйте позже; если повторится, напишите нам через «Сообщить о проблеме».",
    shadowed: (path) => <>WireCat запускает другую копию той же или более новой версии: {path}.</>,
    skillsRefreshed: (agents) => `Инструкции для ${agents} обновлены до этой версии.`,
    skillsFailed: "Обновление установлено, но у ИИ-агентов остались старые инструкции:",
    otherAgents: "других ИИ-агентов",
    openAgents: "Открыть «Агенты»",
    showLog: "Показать журнал",
    hideLog: "Скрыть журнал",
    tryAgain: "Попробовать снова",
    addAccount: "Добавить аккаунт",
    close: "Закрыть",
    done: "Готово",
    log: "Журнал вывода",
    waitingOutput: "Ждём вывода…",
  },
  details: {
    installFirst: (name) => `Установите ${name}, чтобы подключить аккаунт и проверять его работу.`,
    about: (name) => `О ${name}`,
    docs: "Документация",
    github: "GitHub",
    installFromTerminal: "Установка из терминала",
    copyInstall: "Скопировать команду установки",
    installedAt: "Где установлен",
    notInstalledHere: "Не установлен на этом компьютере.",
    doesNotStart: "не запускается",
    runsFirst: "запускается первой",
    notUsed: "не используется",
    uninstall: "Удалить",
    extraLabel: (name) => `Несколько копий ${name}`,
    extra: (n, bin, path, version, manager) =>
      n === 2 ? (
        <>
          Установлены 2 копии {bin}. WireCat запускает самую новую: {path} ({version}, {manager}). Терминал или агент
          может запускать другую, и она может мешать обновлениям. Удалите её здесь или командой программы, которая её
          установила:
        </>
      ) : (
        <>
          Установлено копий {bin}: {n}. WireCat запускает самую новую: {path} ({version}, {manager}). Терминал или агент
          может запускать другую, и они могут мешать обновлениям. Удалите их здесь или командами программ, которые их
          установили:
        </>
      ),
    removeCopy: (path) => `Скопировать команду, которая удаляет ${path}`,
    kind: { config: "настройки", state: "состояние", cache: "кэш" },
  },
  uninstall: {
    title: (names) => `Удалить ${names}?`,
    keep: "Оставить",
    uninstall: "Удалить",
    andDelete: "Удалить вместе с данными",
    together: (names) => `${names} удаляются вместе: это одна программа.`,
    removes: (command, copies) => (
      <>
        Будет удалена команда {command}
        {copies === 2
          ? " (обе копии, каждая — той программой, которая её установила)"
          : copies > 2
            ? ` (${plural("ru", copies, { one: "все # копия", few: "все # копии", many: "все # копий", other: "все # копии" })}, каждая — той программой, которая её установила)`
            : ""}
        . Профили, хранилище и настройки останутся на этом компьютере, если не удалить их ниже.
      </>
    ),
    services:
      "Если вы настроили с ним фоновые службы (сервер или таймер), сначала удалите их средствами самого инструмента.",
    alsoDelete: (name) => `Удалить и данные ${name}`,
    noData: "На этом компьютере у него нет данных.",
    dataWhat: "Его настройки, сеансы входа и кэш. Удаляются, только если удаление программы прошло успешно.",
    sharedStays:
      "Сообщения в общем хранилище останутся: им пользуются другие инструменты. Очистить их можно в разделе «Хранилище».",
    foldersFailed: "Не удалось прочитать его папки.",
    readingFolders: "Читаем его папки",
    folders: (name) => `Папки с данными ${name}`,
    inAll: (size) => `Всего ${size}`,
  },
  health: {
    section: (name) => `Аккаунты и состояние ${name}`,
    accounts: "Аккаунты",
    health: "Состояние",
    checkHealth: "Проверить состояние",
    checking: "Проверяем…",
    check: "Проверить",
    profilesFailed: "Не удалось получить список профилей.",
    loadingProfiles: "Загружаем профили",
    signedIn: "вход выполнен",
    notSignedIn: "вход не выполнен",
    signIn: "Войти",
    setUp: "Настроить",
    noAccountHere: (name) => `Аккаунтов пока нет. Дайте аккаунту имя и войдите в ${name} здесь или в окне терминала.`,
    noAccountTerminal: (name) => `Аккаунтов пока нет. Дайте аккаунту имя и войдите в ${name} в окне терминала.`,
    noAccount: "Аккаунтов пока нет.",
    finishInTerminal: (command) => (
      <>
        Открылось окно терминала, в нём работает {command}. Ответьте там на его вопросы: код, QR-код или страница в
        браузере. Когда он скажет, что вход выполнен, вернитесь сюда и нажмите «Проверить вход».
      </>
    ),
    terminalPreview: (command) => (
      <>
        Это предпросмотр в браузере, терминал здесь не открывается. В приложении эта кнопка открывает окно терминала, в
        котором работает {command}. Вы отвечаете там на его вопросы, потом возвращаетесь и нажимаете «Проверить вход».
      </>
    ),
    terminalFailed: "Окно терминала не открылось:",
    signedInNow: (profile, tool) =>
      `Аккаунт ${profile} вошёл в ${tool}. Теперь агенты могут им пользоваться; окно терминала можно закрыть.`,
    checkSignIn: "Проверить вход",
    manual: "Добавьте аккаунт из терминала: окна входа для этого инструмента пока нет.",
    howToSetUp: "Как настроить",
    copyAddAccount: (name) => `Скопировать команду, которая добавляет аккаунт ${name}`,
    checkAgain: "Проверить снова",
    profileName: "Добавить аккаунт",
    accountName: "Имя аккаунта",
    signInHere: "Войти здесь",
    openTerminal: "Открыть терминал",
    openTerminalToSignIn: "Войти через терминал",
    nameInvalid: "Используйте латинские буквы, цифры, точки, дефисы или подчёркивания.",
    nameEmpty: "Сначала введите имя для этого аккаунта, например personal.",
    nameHintHere: (command) => (
      <>
        Любое короткое имя, например personal или work: одно имя на аккаунт. «Войти здесь» покажет QR-код в этом окне;
        терминал запускает {command}.
      </>
    ),
    nameHintTerminal: (command) => (
      <>Любое короткое имя, например personal или work: одно имя на аккаунт. Окно терминала запускает {command}.</>
    ),
    noTerminal:
      "WireCat не нашёл программу терминала, поэтому ничего не запустилось. Откройте терминал сами, выполните эту команду и нажмите «Проверить вход»:",
    copySetup: "Скопировать команду настройки",
    configProblems: "Проблемы с настройками",
    openSettingsFolder: "Открыть папку настроек",
    copyFix: "Скопировать команду исправления",
    repair: "Исправить файл",
    repairing: "Исправляю…",
    repaired: (what) => `Файл настроек исправлен: ${what}.`,
    repairedNothingListed: "Файл настроек исправлен.",
    atLine: (n) => `строка ${n}`,
    repairKind: {
      byte_order_mark: "убрана невидимая метка в начале файла",
      comment: "убран комментарий",
      trailing_comma: "убрана запятая после последней записи",
      missing_comma: "добавлена пропущенная запятая",
      unquoted_key: "имя настройки взято в кавычки",
      single_quotes: "одинарные кавычки заменены двойными",
      missing_closer: "добавлена пропущенная закрывающая скобка в конце",
    },
    repairNothing: "Файл не нужно исправлять: теперь он читается правильно.",
    repairNoFile: "Файла настроек нет, исправлять нечего.",
    backupAt: "Файл в прежнем виде сохранён здесь:",
    repairRefused: (tool) => `${tool} не стал менять файл:`,
    repairByHand:
      "Он не меняет то, что не может исправить надёжно. Исправьте эту строку вручную в текстовом редакторе и проверьте снова.",
    showFile: "Показать файл в папке",
    repairFailed: "Исправление не запустилось:",
    fix: "Исправить:",
    technical: "Технические подробности",
    command: "Команда",
    exitCode: "Код выхода",
    none: "нет",
    took: "Заняло",
    hidden: "Имена аккаунтов, номера, адреса и токены скрыты.",
    running: "Идёт проверка",
    note: {
      unreadable_issue: "Не удалось прочитать проблему с настройками.",
      invalid_setting: "Настройка задана неверно.",
      unknown_problem: "Неизвестная проблема",
      tool_error: "Инструмент сообщил об ошибке.",
      no_config: "Файла настроек пока нет.",
      no_data: "Локальных данных пока нет. Ничего не синхронизировано.",
      no_token: "Вход не выполнен: для этого профиля нет токена.",
      expired: "Срок входа истёк. Подключитесь снова, чтобы продлить его.",
      not_signed_in: "Вход ещё не выполнен.",
      no_problems: "Проблем не найдено.",
    },
    unreadable: (code) => `Не удалось прочитать ответ инструмента (код выхода ${code}).`,
    stopped: (code) => `Проверка завершилась с кодом выхода ${code}.`,
    unknownCode: "неизвестен",
  },
  storage: {
    heading: "Хранилище",
    cannotRead: (schema) =>
      schema === null ? "Не может прочитать хранилище." : `Не может прочитать хранилище (схема ${schema}).`,
    updateName: (name) => `Обновите ${name}.`,
    noNewer: "Новой версии пока нет.",
    moves: (to, names) => `При следующем запуске переведёт хранилище на схему ${to}; ${names} перестанут его читать.`,
    labelCannotRead: "Не может прочитать хранилище",
    labelMoves: "Переведёт хранилище на схему, которую другие инструменты не читают",
    labelUnknown: "Не сообщает, читает ли хранилище",
    reads: (schema) => `Читает хранилище (схема ${schema}).`,
    readsNoFile: "Читает хранилище. Файла хранилища пока нет.",
    unknown: (name, canUpdate) =>
      `Эта версия ${name} не сообщает, читает ли она хранилище. ${canUpdate ? `Обновление ${name} добавит эту проверку.` : "Проверка появится в одной из следующих версий."}`,
    locksOut: (name, to, min, names) =>
      `При следующем запуске ${name} переведёт хранилище на схему ${to}; для чтения понадобится схема ${min} или новее. ${names} читают только старые схемы и перестанут читать хранилище. Сначала обновите их.`,
    movesAlone: (to) => `Читает хранилище и при следующем запуске переведёт его на схему ${to}.`,
    movesAll: (to) =>
      `Читает хранилище и при следующем запуске переведёт его на схему ${to}. Все остальные установленные инструменты её читают.`,
    behind: (schema, needs, speaks, name) => {
      const written =
        schema === null
          ? `Хранилищу нужен инструмент, который читает схему ${needs} или новее`
          : `Более новый инструмент WireCat перевёл хранилище на схему ${schema}; для чтения нужна схема ${needs} или новее`
      return `${written}${speaks === null ? "" : `, а этот ${name} читает схемы до ${speaks}`}.`
    },
    updateToRead: (name) => `Обновите ${name}, чтобы он снова мог его читать.`,
    noNewerOf: (name) => `Новой версии ${name} пока нет.`,
    allRead: "Все установленные инструменты могут читать хранилище.",
    cantSayYet: (n, names) =>
      n === 1
        ? `${names} пока не сообщает об этом; проверка появится в новой версии.`
        : `${names} пока не сообщают об этом; проверка появится в новой версии.`,
    needUpdate: (n, names) =>
      plural("ru", n, {
        one: `# инструменту нужно обновление, чтобы читать хранилище: ${names}.`,
        few: `# инструментам нужно обновление, чтобы читать хранилище: ${names}.`,
        many: `# инструментам нужно обновление, чтобы читать хранилище: ${names}.`,
        other: `# инструментам нужно обновление, чтобы читать хранилище: ${names}.`,
      }),
    noNewerVersions: "Новых версий пока нет.",
    updateOne: (name) => `Обновить ${name}`,
    updateThem: "Обновить их",
  },
  upgrade: {
    title: (tool, to) => `${tool} переведёт хранилище на схему ${to}`,
    notNow: "Не сейчас",
    updateToo: (names) => `Обновить и ${names}`,
    locksOut: (n, names, to, name) =>
      n === 1
        ? `${names} не читает схему ${to}. Он перестанет работать с хранилищем при следующем запуске ${name}, а это может случиться скоро, если ${name} работает в фоне.`
        : `${names} не читают схему ${to}. Они перестанут работать с хранилищем при следующем запуске ${name}, а это может случиться скоро, если ${name} работает в фоне.`,
    mayLockOut: (n, names) =>
      n === 1
        ? `${names} не сообщает, какую схему читает, поэтому тоже может перестать работать.`
        : `${names} не сообщают, какую схему читают, поэтому тоже могут перестать работать.`,
    stuck: (n, names) =>
      n === 1
        ? `Новой версии ${names} пока нет, поэтому обновление сегодня не поможет.`
        : `Новых версий ${names} пока нет, поэтому обновление сегодня не поможет.`,
  },
  clear: {
    title: "Инструменты WireCat не установлены. Удалить и их данные?",
    keep: "Оставить данные",
    delete: (size) => `Удалить ${size}`,
    text: (size) =>
      `Инструменты оставили на этом компьютере ${size}: общее хранилище, сеансы, настройки и кэш. Оставьте их, если, возможно, установите инструменты снова; удалите, чтобы убрать всё. Токены входа в системном хранилище ключей не затрагиваются.`,
  },
}

const ES_NOTE: Record<string, string> = {
  wa: "WhatsApp no tiene una sincronización que iniciar. Los mensajes nuevos llegan mientras funciona su servicio en segundo plano: mira «Servicio en segundo plano» más abajo.",
}

const ES_GROUP: Record<string, string> = {
  messages: "Mensajes",
  reactions: "Reacciones",
  polls: "Encuestas",
  topics: "Temas",
  chats: "Chats y grupos",
  contacts: "Contactos",
  account: "Cuenta",
  attachments: "Archivos",
  tasks: "Tareas",
}

const es: typeof en = {
  page: {
    title: "Herramientas",
    looking: "Buscando herramientas de WireCat en este ordenador…",
    askingNpm: "Comprobando en npm si hay versiones nuevas…",
    checkAgain: "Comprobar de nuevo",
    checking: "Comprobando…",
    inspectFailed: "No se pudo revisar este ordenador.",
    systemFailed: "No se pudo comprobar Node.js y npm.",
    checkingStorage: "Comprobando el almacenamiento",
    list: "Herramientas de WireCat",
    latestUnknown: "No se pudo consultar en npm las últimas versiones, así que no se muestran actualizaciones.",
  },
  intro: {
    label: "Acerca de WireCat",
    text: "WireCat da a tu agente de IA acceso a tus mensajerías, reuniones, correo y documentos. Cada servicio tiene una pequeña herramienta de línea de comandos que ejecuta tu agente; todo se queda en este ordenador.",
    install: (em) => <>{em("Instala")} las herramientas de los servicios que usas.</>,
    signIn: (em) => <>{em("Inicia sesión")} en una cuenta desde Gestionar.</>,
    connect: (link) => <>{link("Conecta tu agente")} en la página Agentes.</>,
    choose: "Elegir herramientas",
    hide: "Ocultar esta introducción",
  },
  tool: { tagline: ES_TAGLINE, summary: ES_SUMMARY, syncNote: ES_NOTE, group: ES_GROUP },
  row: {
    status: {
      checking: "Comprobando",
      missing: uiMessages.es.notInstalled,
      installing: "Instalando",
      uninstalling: "Desinstalando",
      broken: "Instalada, pero no se inicia",
      outdated: "Hay una actualización",
      readyChecking: "Instalada, buscando actualizaciones",
      ready: "Instalada y al día",
    },
    withStorage: (status, storage) => `${status}. ${storage}`,
    partOf: (name) => `Parte de ${name}`,
    community: "Comunidad",
    trust: (maker) => `Hecho por ${maker}, no por WireCat. La app comprueba dónde npm lo compiló, no lo que hace.`,
    copies: (n) => plural("es", n, { one: "# copia instalada", other: "# copias instaladas" }),
    browserApp: "Una app del navegador",
    nodeFirst: "Primero hace falta Node.js",
    doesNotStart: "No se inicia",
    notInstalled: uiMessages.es.notInstalled,
    cancel: "Cancelar",
    updateTo: (version) => `Actualizar a ${version}`,
    install: "Instalar",
    fix: "Arreglar",
    manage: "Gestionar",
  },
  install: {
    steps: {
      install: { check: "Comprobando requisitos", install: "Instalando", verify: "Verificando", done: "Listo" },
      uninstall: { check: "Buscando copias", remove: "Eliminando", verify: "Verificando", done: "Listo" },
    },
    waiting: "Esperando a que termine la operación en curso.",
    installed: (names, version, shared) =>
      shared ? `${names} ${version} están instaladas y funcionan.` : `${names} ${version} está instalada y funciona.`,
    removed: (names, shared) => (shared ? `${names} se han desinstalado.` : `${names} se ha desinstalado.`),
    dataKept: "Los datos se quedan en este ordenador hasta que los borres en Almacenamiento.",
    dataDeleted: (size) => `Sus datos (${size}) se han borrado.`,
    dataFailed: "No se pudieron borrar sus datos:",
    dataDeleting: "Borrando sus datos…",
    dataUntouched: "Sus datos no se han tocado.",
    cancelled: { install: "Instalación cancelada.", uninstall: "Desinstalación cancelada." },
    timedOut: {
      install: "La instalación tardó más de 15 minutos y se detuvo.",
      uninstall: "La desinstalación tardó más de 15 minutos y se detuvo.",
    },
    timedOutHint: "Comprueba tu conexión y vuelve a intentarlo.",
    network: "No se pudo conectar con el registro de npm.",
    networkHint: "Comprueba tu conexión a internet o el proxy y vuelve a intentarlo.",
    unconfirmed: "No se pudo confirmar que esta versión se compiló desde su propio repositorio, así que no se instaló.",
    unconfirmedHint:
      "Tu equipo no ha cambiado. Vuelve a intentarlo más tarde; si sigue pasando, avísanos con Informar de un problema.",
    shadowed: (path) => <>WireCat ejecuta otra copia de la misma versión o una más reciente, en {path}.</>,
    skillsRefreshed: (agents) => `Se actualizaron las instrucciones de ${agents} a esta versión.`,
    skillsFailed: "La actualización está instalada, pero tus agentes de IA siguen con las instrucciones antiguas:",
    otherAgents: "tus otros agentes de IA",
    openAgents: "Abrir Agentes",
    showLog: "Ver registro",
    hideLog: "Ocultar registro",
    tryAgain: "Reintentar",
    addAccount: "Añadir una cuenta",
    close: "Cerrar",
    done: "Listo",
    log: "Registro de salida",
    waitingOutput: "Esperando la salida…",
  },
  details: {
    installFirst: (name) => `Instala ${name} para conectar una cuenta y comprobar su estado.`,
    about: (name) => `Acerca de ${name}`,
    docs: "Documentación",
    github: "GitHub",
    installFromTerminal: "Instalar desde un terminal",
    copyInstall: "Copiar el comando de instalación",
    installedAt: "Instalada en",
    notInstalledHere: "No está instalada en este ordenador.",
    doesNotStart: "no se inicia",
    runsFirst: "se ejecuta primero",
    notUsed: "sin uso",
    uninstall: "Desinstalar",
    extraLabel: (name) => `Más de una copia de ${name}`,
    extra: (n, bin, path, version, manager) =>
      n === 2 ? (
        <>
          Hay 2 copias de {bin} instaladas. WireCat ejecuta la más reciente, {path} ({version}, {manager}). Un terminal
          o un agente puede ejecutar la otra, y puede confundir las actualizaciones. Elimínala aquí o con el comando del
          programa que la instaló:
        </>
      ) : (
        <>
          Hay {n} copias de {bin} instaladas. WireCat ejecuta la más reciente, {path} ({version}, {manager}). Un
          terminal o un agente puede ejecutar otra, y pueden confundir las actualizaciones. Elimínalas aquí o con el
          comando del programa que instaló cada una:
        </>
      ),
    removeCopy: (path) => `Copiar el comando que elimina ${path}`,
    kind: { config: "ajustes", state: "estado", cache: "caché" },
  },
  uninstall: {
    title: (names) => `¿Desinstalar ${names}?`,
    keep: "Conservar",
    uninstall: "Desinstalar",
    andDelete: "Desinstalar y borrar datos",
    together: (names) => `Desinstalar elimina ${names} a la vez: son un solo programa.`,
    removes: (command, copies) => (
      <>
        Esto elimina el comando {command}
        {copies === 2
          ? " (las dos copias, cada una con el programa que la instaló)"
          : copies > 2
            ? ` (las ${copies} copias, cada una con el programa que la instaló)`
            : ""}
        . Tus perfiles, almacenamiento y ajustes se quedan en este ordenador salvo que los borres abajo.
      </>
    ),
    services:
      "Si configuraste servicios en segundo plano con ella (un servidor o un temporizador), elimínalos antes con la propia herramienta.",
    alsoDelete: (name) => `Borrar también los datos de ${name}`,
    noData: "No tiene datos en este ordenador.",
    dataWhat: "Sus ajustes, sesiones iniciadas y cachés. Solo se borran si la desinstalación sale bien.",
    sharedStays:
      "Los mensajes del almacenamiento compartido se quedan; otras herramientas lo usan. Puedes vaciarlo en Almacenamiento.",
    foldersFailed: "No se pudieron leer sus carpetas.",
    readingFolders: "Leyendo sus carpetas",
    folders: (name) => `Carpetas de datos de ${name}`,
    inAll: (size) => `${size} en total`,
  },
  health: {
    section: (name) => `Cuentas y estado de ${name}`,
    accounts: "Cuentas",
    health: "Estado",
    checkHealth: "Comprobar estado",
    checking: "Comprobando…",
    check: "Comprobar",
    profilesFailed: "No se pudieron listar los perfiles.",
    loadingProfiles: "Cargando perfiles",
    signedIn: "sesión iniciada",
    notSignedIn: "sin sesión",
    signIn: "Iniciar sesión",
    setUp: "Configurar",
    noAccountHere: (name) =>
      `Aún no hay ninguna cuenta. Ponle un nombre e inicia sesión en ${name} aquí o en una ventana de terminal.`,
    noAccountTerminal: (name) =>
      `Aún no hay ninguna cuenta. Ponle un nombre e inicia sesión en ${name} en una ventana de terminal.`,
    noAccount: "Aún no hay ninguna cuenta.",
    finishInTerminal: (command) => (
      <>
        Se abrió una ventana de terminal que ejecuta {command}. Responde allí a sus preguntas: un código, un código QR o
        una página en el navegador. Cuando diga que has iniciado sesión, vuelve aquí y pulsa Comprobar sesión.
      </>
    ),
    terminalPreview: (command) => (
      <>
        Esto es la vista previa en el navegador, así que no se abre ningún terminal. En la app, este botón abre una
        ventana de terminal que ejecuta {command}. Respondes allí a sus preguntas, vuelves y pulsas Comprobar sesión.
      </>
    ),
    terminalFailed: "La ventana del terminal no se abrió:",
    signedInNow: (profile, tool) =>
      `${profile} ha iniciado sesión en ${tool}. Tus agentes ya pueden usar esta cuenta; puedes cerrar la ventana del terminal.`,
    checkSignIn: "Comprobar sesión",
    manual: "Añade una cuenta desde un terminal; esta herramienta aún no tiene ventana de inicio de sesión.",
    howToSetUp: "Cómo configurarla",
    copyAddAccount: (name) => `Copiar el comando que añade una cuenta de ${name}`,
    checkAgain: "Comprobar de nuevo",
    profileName: "Añadir una cuenta",
    accountName: "Nombre de la cuenta",
    signInHere: "Iniciar sesión aquí",
    openTerminal: "Abrir terminal",
    openTerminalToSignIn: "Iniciar sesión en el terminal",
    nameInvalid: "Usa letras latinas, cifras, puntos, guiones o guiones bajos.",
    nameEmpty: "Primero escribe un nombre para esta cuenta, por ejemplo personal.",
    nameHintHere: (command) => (
      <>
        Cualquier nombre corto, como personal o work: un nombre por cuenta. Iniciar sesión aquí muestra el código QR en
        esta ventana; el terminal ejecuta {command}.
      </>
    ),
    nameHintTerminal: (command) => (
      <>
        Cualquier nombre corto, como personal o work: un nombre por cuenta. La ventana del terminal ejecuta {command}.
      </>
    ),
    noTerminal:
      "WireCat no encontró ningún programa de terminal, así que no se inició nada. Abre un terminal, ejecuta este comando y pulsa Comprobar sesión:",
    copySetup: "Copiar el comando de configuración",
    configProblems: "Problemas de configuración",
    openSettingsFolder: "Abrir la carpeta de ajustes",
    copyFix: "Copiar el comando que lo arregla",
    repair: "Reparar el archivo",
    repairing: "Reparando…",
    repaired: (what) => `Archivo de ajustes reparado: ${what}.`,
    repairedNothingListed: "Archivo de ajustes reparado.",
    atLine: (n) => `línea ${n}`,
    repairKind: {
      byte_order_mark: "se quitó una marca invisible al inicio del archivo",
      comment: "se quitó un comentario",
      trailing_comma: "se quitó una coma tras la última entrada",
      missing_comma: "se añadió una coma que faltaba",
      unquoted_key: "se puso entre comillas el nombre de un ajuste",
      single_quotes: "se cambiaron comillas simples por dobles",
      missing_closer: "se añadió un corchete de cierre que faltaba al final",
    },
    repairNothing: "El archivo no necesitaba reparación: ahora se lee bien.",
    repairNoFile: "No hay archivo de ajustes que reparar.",
    backupAt: "El archivo tal como estaba se guarda en",
    repairRefused: (tool) => `${tool} no cambió el archivo:`,
    repairByHand:
      "No cambia nada que no pueda arreglar con seguridad. Corrige esta línea a mano en un editor de texto y vuelve a comprobar.",
    showFile: "Mostrar el archivo en su carpeta",
    repairFailed: "La reparación no se ejecutó:",
    fix: "Arreglo:",
    technical: "Detalles técnicos",
    command: "Comando",
    exitCode: "Código de salida",
    none: "ninguno",
    took: "Duró",
    hidden: "Los nombres de cuenta, números, direcciones y tokens están ocultos.",
    running: "Ejecutando la comprobación",
    note: {
      unreadable_issue: "No se pudo leer un problema de configuración.",
      invalid_setting: "Un ajuste no es válido.",
      unknown_problem: "Problema desconocido",
      tool_error: "La herramienta informó de un error.",
      no_config: "Aún no hay archivo de configuración.",
      no_data: "Aún no hay datos locales. No se ha sincronizado nada.",
      no_token: "Sin sesión: no hay token para este perfil.",
      expired: "La sesión ha caducado. Vuelve a conectar para renovarla.",
      not_signed_in: "Aún no has iniciado sesión.",
      no_problems: "No se encontraron problemas.",
    },
    unreadable: (code) => `No se pudo leer la respuesta de la herramienta (código de salida ${code}).`,
    stopped: (code) => `La comprobación terminó con el código de salida ${code}.`,
    unknownCode: "desconocido",
  },
  storage: {
    heading: "Almacenamiento",
    cannotRead: (schema) =>
      schema === null ? "No puede leer el almacenamiento." : `No puede leer el almacenamiento (esquema ${schema}).`,
    updateName: (name) => `Actualiza ${name}.`,
    noNewer: "Aún no hay una versión más nueva.",
    moves: (to, names) => `Su próxima ejecución pasa el almacenamiento al esquema ${to}; ${names} dejarán de leerlo.`,
    labelCannotRead: "No puede leer el almacenamiento",
    labelMoves: "Pasará el almacenamiento a un esquema que otras herramientas no leen",
    labelUnknown: "No dice si lee el almacenamiento",
    reads: (schema) => `Lee el almacenamiento (esquema ${schema}).`,
    readsNoFile: "Lee el almacenamiento. Aún no hay archivo de almacenamiento.",
    unknown: (name, canUpdate) =>
      `Esta versión de ${name} no dice si lee el almacenamiento. ${canUpdate ? `Actualizar ${name} añade la comprobación.` : "Una versión posterior añade la comprobación."}`,
    locksOut: (name, to, min, names) =>
      `La próxima vez que se ejecute ${name}, pasará el almacenamiento al esquema ${to}; para leerlo hará falta el esquema ${min} o posterior. ${names} solo leen esquemas anteriores y dejarán de leer el almacenamiento. Actualízalas primero.`,
    movesAlone: (to) => `Lee el almacenamiento y lo pasa al esquema ${to} en su próxima ejecución.`,
    movesAll: (to) =>
      `Lee el almacenamiento y lo pasa al esquema ${to} en su próxima ejecución. Todas las demás herramientas instaladas pueden leerlo.`,
    behind: (schema, needs, speaks, name) => {
      const written =
        schema === null
          ? `El almacenamiento necesita una herramienta que lea el esquema ${needs} o posterior`
          : `Una herramienta de WireCat más nueva pasó el almacenamiento al esquema ${schema}; para leerlo hace falta el esquema ${needs} o posterior`
      return `${written}${speaks === null ? "" : `, y este ${name} lee hasta el ${speaks}`}.`
    },
    updateToRead: (name) => `Actualiza ${name} para volver a leerlo.`,
    noNewerOf: (name) => `Aún no hay un ${name} más nuevo.`,
    allRead: "Todas las herramientas instaladas pueden leer el almacenamiento.",
    cantSayYet: (n, names) =>
      n === 1
        ? `${names} aún no lo dice; una versión más nueva añade la comprobación.`
        : `${names} aún no lo dicen; una versión más nueva añade la comprobación.`,
    needUpdate: (n, names) =>
      plural("es", n, {
        one: `# herramienta necesita una actualización para leer el almacenamiento: ${names}.`,
        other: `# herramientas necesitan una actualización para leer el almacenamiento: ${names}.`,
      }),
    noNewerVersions: "Aún no hay versiones más nuevas.",
    updateOne: (name) => `Actualizar ${name}`,
    updateThem: "Actualizarlas",
  },
  upgrade: {
    title: (tool, to) => `${tool} pasará el almacenamiento al esquema ${to}`,
    notNow: "Ahora no",
    updateToo: (names) => `Actualizar también ${names}`,
    locksOut: (n, names, to, name) =>
      n === 1
        ? `${names} no puede leer el esquema ${to}. Dejará de funcionar con el almacenamiento la próxima vez que se ejecute ${name}, y eso puede ser pronto si ${name} funciona en segundo plano.`
        : `${names} no pueden leer el esquema ${to}. Dejarán de funcionar con el almacenamiento la próxima vez que se ejecute ${name}, y eso puede ser pronto si ${name} funciona en segundo plano.`,
    mayLockOut: (n, names) =>
      n === 1
        ? `${names} no dice qué esquema lee, así que también puede dejar de funcionar.`
        : `${names} no dicen qué esquema leen, así que también pueden dejar de funcionar.`,
    stuck: (n, names) =>
      n === 1
        ? `Aún no hay una versión más nueva de ${names}, así que actualizar no lo arregla hoy.`
        : `Aún no hay versiones más nuevas de ${names}, así que actualizar no las arregla hoy.`,
  },
  clear: {
    title: "No hay herramientas de WireCat instaladas. ¿Borrar también sus datos?",
    keep: "Conservar datos",
    delete: (size) => `Borrar ${size}`,
    text: (size) =>
      `Las herramientas dejaron ${size} en este ordenador: almacenamiento compartido, sesiones, ajustes y cachés. Consérvalo si puedes volver a instalarlas; bórralo para quitarlo todo. Los tokens de inicio de sesión del llavero del sistema no se tocan.`,
  },
}

export const toolsMessages: Messages<ToolsText> = { en, ru, es }
