import type { ReactNode } from "react"
import { type CatalogTool, tools } from "@/domain/catalog"
import { type Messages, plural } from "@/i18n"
import type { StepId } from "@/shared/onboarding-store"

type Page = { title: string; lead: string }
type Stop = { title: string; text: string }
type ById = Record<string, string>

const byId = (pick: (t: CatalogTool) => string | null | undefined) =>
  Object.fromEntries(tools.flatMap((t) => (pick(t) ? [[t.id, pick(t) as string]] : [])))

const en = {
  steps: {
    welcome: "Welcome",
    computer: "Your computer",
    choose: "Choose tools",
    install: "Install",
    agents: "Agents",
    signin: "Sign in",
    done: "Done",
  } as Record<StepId, string>,
  pages: {
    welcome: {
      title: "Welcome to WireCat",
      lead: "Connect your AI agent (Claude Code, Codex and others) to your own messages, mail, meetings and files.",
    },
    computer: {
      title: "Your computer",
      lead: "WireCat tools run on Node.js and install with npm. WireCat Desktop itself runs without them.",
    },
    choose: {
      title: "Choose tools",
      lead: "Pick the services your agent should reach. You can add or remove tools later.",
    },
    install: {
      title: "Install",
      lead: "Each tool is installed from npm and checked that it starts. One runs at a time.",
    },
    agents: {
      title: "Connect agents",
      lead: "Your agent learns to use each tool from a skill: a short guide to the tool's commands and when to use them.",
    },
    signin: {
      title: "Sign in",
      lead: "Signing in connects a tool to your account, so your agent can reach it. Each sign-in runs here, in this window, step by step: QR codes, codes and passwords included. A tool too old for that still signs in in a terminal.",
    },
    done: {
      title: "You are set up",
      lead: "The tools below are installed on this computer. A short tour shows you the window and ends on your first guide.",
    },
  } as Record<StepId, Page>,
  flow: {
    stepsNav: "Setup steps",
    later: "Set up later",
    laterNote: "Finish later from the sidebar.",
    getStarted: "Get started",
    installTools: (n: number) => plural("en", n, { one: "Install # tool", other: "Install # tools" }),
    openTools: "Open Tools",
    continue: "Continue",
    blockedChecking: "Checking this computer first…",
    resuming: "Checking what is already set up…",
    blockedSettingUp: "Continue opens once Node.js is set up.",
    blockedNode: "Set up Node.js, or choose “I'll install it myself”, to continue.",
    back: "Back",
    skip: "Skip",
    tour: "Show me around",
  },
  welcome: {
    list: "What WireCat does",
    localTitle: "Everything stays on this computer",
    local:
      "The tools keep your messages, mail, meetings and files in storage on this computer, not in a WireCat cloud.",
    openTitle: "Open tools you could run yourself",
    open: "Each integration is a WireCat command-line tool from npm. This app installs them and runs their own commands.",
    agentTitle: "Your agent does the rest",
    agent: "Claude Code, Codex and other agents use the tools to search and act on your data when you ask them to.",
    time: "Setup takes a few minutes. You can skip any step.",
  },
  computer: {
    list: "Your computer",
    system: "System",
    notFound: "Not found",
    checkingComputer: "Checking this computer…",
    ready: "Ready to install WireCat tools.",
    checking: "Checking…",
    again: "Check again",
  },
  choose: {
    legend: "Tools to install",
    partOf: (name: string) => `Part of ${name}`,
    installed: "installed",
  },
  install: {
    list: "Installing",
    notInstalled: "Not installed",
    notInstalledFailed: "Did not install",
    checking: "Checking…",
    queued: "Waiting for its turn",
    asked: "Waiting for your answer",
    installing: "Installing",
    step: (label: string) => `${label}…`,
    installed: (version: ReactNode): ReactNode => <>Installed {version}</>,
    already: (version: ReactNode): ReactNode => <>Already installed {version}</>,
    tryAgain: "Try again",
    none: "No tools are chosen, so there is nothing to install.",
    choose: "Choose tools",
    rest: "Install the rest",
    note: "Installs keep going if you move on. Each one is also shown on the Tools page, with its full log.",
    allDone: "Everything is installed. Next, give your AI agents the skills to use it.",
    moreLater: "You can install other tools later on the Tools page.",
  },
  wait: {
    label: "Progress of all installs",
    of: (n: number, total: number) => `${n} of ${total}`,
    installing: (name: string) => `Installing ${name}`,
    waiting: "Starting",
    finished: (n: number) => plural("en", n, { one: "# tool installed", other: "# tools installed" }),
    failed: (n: number) => plural("en", n, { one: "# did not install", other: "# did not install" }),
    left: {
      almost: "Almost done",
      underMinute: "Less than a minute left",
      minutes: (n: number) => plural("en", n, { one: "About a minute left", other: "About # minutes left" }),
    },
    typical: "Usually a minute or two per tool. A slow connection makes it longer.",
    restart: "AI apps and terminals that were already open see the new tools only after you restart them.",
    manual: "Your shell is one WireCat does not edit. Add this line to its startup file, then open a new terminal:",
    hints: "While you wait",
    hintOf: (n: number, total: number) => `${n} / ${total}`,
    previous: "Previous tip",
    next: "Next tip",
    tips: {
      agents: {
        title: "Your agent runs the tools for you",
        text: "In the next step you give Claude Code, Codex or another agent a skill for each tool. Then you just ask it, for example: what did Anna send me yesterday?",
      },
      tg: {
        title: "Find any Telegram message",
        text: "After a sync, your agent searches your chats without opening Telegram, and quotes the message it found.",
      },
      wa: {
        title: "WhatsApp chats your agent can read",
        text: "Your agent reads and searches your WhatsApp chats, and can answer for you when you ask it to.",
      },
      zm: {
        title: "Ask what was agreed on a call",
        text: "Zoom keeps the transcripts and summaries of your recorded meetings, so your agent can tell you who promised what.",
      },
      drive: {
        title: "Your documents, as text",
        text: "Drive copies the folders you choose as plain text, so your agent can quote a Doc, a Sheet or a PDF.",
      },
      memo: {
        title: "Mail and notes in one search",
        text: "Memo keeps your notes and mail together, and your agent searches them along with your messages.",
      },
      guides: {
        title: "A brief before each call",
        text: "Guides show your agent how to give you a morning catch-up, a brief before a call, and tasks from what people asked you.",
      },
      memory: {
        title: "You approve what it remembers",
        text: "Memory shows what your agents noted about you and the people you talk to. Nothing counts until you approve it.",
      },
      local: {
        title: "It all stays on this computer",
        text: "Tools keep their data in folders on this computer. Storage shows each folder and how much space it takes.",
      },
    },
  },
  agents: {
    title: "How a tool adds its skill",
    text: "Some tools offer to add their skill while you sign in, in the next step: the terminal asks which agent should get it. Any tool can also add its own skill from a terminal, for Claude Code, Codex and Gemini CLI.",
    list: "Skill commands",
    why: {
      label: "How a skill helps",
      ask: "With a skill, you ask your agent in plain words, for example:",
      example: "What did Anna send me yesterday?",
      points: [
        "The agent knows which tool can answer and runs it for you.",
        "Without the skill, the agent does not know the tool is there.",
        "The skill takes almost no room. The agent reads it only when your question needs the tool.",
        "It is one small file on this computer. You can remove it later on the Agents page.",
      ],
      next: "Install the skill for your agents below.",
    },
  },
  signIn: {
    list: "Tools to sign in to",
    looking: "Looking for installed tools",
    accounts: (tool: string) => `${tool} accounts`,
    reading: (tool: string) => `Reading ${tool} accounts`,
    listFailed: (error: string) => `Could not list the accounts: ${error}`,
    noAccount: (tool: string) => `No account yet. Add one so your agent can use ${tool}.`,
    needs: "What it needs: ",
    willAsk: "It will ask for: ",
    guide: "How to make it",
    addAnother: "Add another account",
    add: "Add an account",
    noneNeeded: "No installed tool needs a sign-in yet.",
    noSignIn: (n: number, names: string) => (n === 1 ? `${names} needs no sign-in.` : `${names} need no sign-in.`),
    gives: byId((t) => t.signIn?.gives) as ById,
    asks: byId((t) => t.signIn?.asks) as ById,
  },
  done: {
    list: "Your tools",
    notInstalled: "Not installed",
    moreLater: "You can install other tools later on the Tools page.",
    next: "What next",
    agents: "See which agents use them",
  },
  help: {
    help: "Help",
    docs: "WireCat documentation",
    tour: "Take the tour",
    welcome: "Show the welcome again",
    privacy: "Privacy",
    about: "About WireCat",
    node: "WireCat's Node.js…",
    trouble: "Help. Node.js or npm needs attention",
  },
  tour: {
    tools: {
      title: "Tools",
      text: "Every WireCat tool in one list: install, update, sign in and check each one. When something does not work, start here.",
    },
    lamps: {
      title: "Status lamps",
      text: "Green: installed and current. Amber: an update is ready. Red: installed, but it does not start. A hollow ring: not installed.",
    },
    action: {
      title: "One action per tool",
      text: "Install or Update puts the latest version on this computer. Manage opens the tool's profiles, sign-in and health check.",
    },
    sync: {
      title: "Sync",
      text: "Brings new messages, mail or notes to this computer, so search and your agent see them. Manage shows each account's last sync.",
    },
    agents: {
      title: "Agents",
      text: "Which AI agents on this computer have each tool's skill, with a button to add the ones missing.",
    },
    how: {
      title: "How it works with your agent",
      text: "You ask your agent in your own words. Its skill tells it which WireCat command to run. WireCat keeps the tools installed, signed in and synced, so the answer comes from your own messages and files.",
    },
    search: {
      title: "Search",
      text: "Find a message, a mail or a meeting in what one tool keeps on this computer, for one profile. The results here are examples.",
    },
    searchAsk: {
      title: "Ask in your own words",
      text: "Describe what you want. Your agent writes it as the query in the box below; nothing is searched until you press Search.",
    },
    searchHit: {
      title: "Open a result",
      text: "Open a result to read the messages around it. Point at a sender or a chat for buttons that search again with only them, or without them.",
    },
    tasks: {
      title: "Tasks",
      text: "Tasks for your projects, from you and your agents. An agent can turn a request in your messages into a task once you approve it in Memory. The rows here are examples.",
    },
    tasksView: {
      title: "Table or board",
      text: "Sort the tasks in a table, or see a board with a column per status and drag a task to move it.",
    },
    tasksRow: {
      title: "Who, how urgent, by when",
      text: "Each row shows the status, who does it, the priority, the due date and what it waits for. Open a task to change them or add a comment.",
    },
    memory: {
      title: "Memory",
      text: "What your agents saved from your chats, mail and notes: facts, preferences, promises and decisions. Nothing counts until you approve it. The rows here are examples.",
    },
    memoryReview: {
      title: "Approve or correct",
      text: "Approve what is right, Reject what is wrong. More holds Edit, to correct the text, and Erase, to forget it for good.",
    },
    memorySources: {
      title: "Where it came from",
      text: "Each memory lists the messages and mail it rests on. Click one to read it among the messages around it.",
    },
    system: {
      title: "Storage, Logs and Settings",
      text: "How much space each tool's data takes, what each run did and what went wrong, and each tool's settings.",
    },
    help: {
      title: "Help is here",
      text: "Open the WireCat documentation, start this tour again, go back to the setup steps, or see whether Node.js and npm are ready, from this button. The version number at the bottom left opens it too.",
    },
    guide: {
      title: "Your first guide",
      text: "A guide is a request you copy into your agent, with the steps it will run. Try this one, or look at the next.",
    },
  } as Record<
    | "tools"
    | "lamps"
    | "action"
    | "sync"
    | "agents"
    | "how"
    | "search"
    | "searchAsk"
    | "searchHit"
    | "tasks"
    | "tasksView"
    | "tasksRow"
    | "memory"
    | "memoryReview"
    | "memorySources"
    | "system"
    | "help"
    | "guide",
    Stop
  >,
  tourEnd: {
    tryGuide: "Try this guide",
    nextGuide: "Next guide",
    openTools: "Open Tools",
  },
}

export type OnboardingText = typeof en
export type TourStop = keyof OnboardingText["tour"]

const ru: OnboardingText = {
  steps: {
    welcome: "Начало",
    computer: "Компьютер",
    choose: "Выбор",
    install: "Установка",
    agents: "Агенты",
    signin: "Вход",
    done: "Готово",
  },
  pages: {
    welcome: {
      title: "Добро пожаловать в WireCat",
      lead: "Подключите своего ИИ-агента (Claude Code, Codex и другие) к вашим сообщениям, почте, встречам и файлам.",
    },
    computer: {
      title: "Ваш компьютер",
      lead: "Инструменты WireCat работают на Node.js и устанавливаются через npm. Самому WireCat Desktop они не нужны.",
    },
    choose: {
      title: "Выберите инструменты",
      lead: "Отметьте сервисы, к которым агент должен получить доступ. Добавить или убрать инструменты можно и потом.",
    },
    install: {
      title: "Установка",
      lead: "Каждый инструмент ставится из npm, а затем мы проверяем, что он запускается. Установки идут по одной.",
    },
    agents: {
      title: "Подключите агентов",
      lead: "Агент учится работать с инструментом по навыку: это короткое руководство по его командам и по тому, когда их применять.",
    },
    signin: {
      title: "Вход",
      lead: "Вход связывает инструмент с вашим аккаунтом, и агент получает к нему доступ. Вход идёт здесь, в этом окне, шаг за шагом: QR-коды, коды и пароли тоже. Только слишком старая версия инструмента входит в терминале.",
    },
    done: {
      title: "Всё готово",
      lead: "Инструменты ниже установлены на этом компьютере. Короткая экскурсия покажет окно и закончится на первом рецепте.",
    },
  },
  flow: {
    stepsNav: "Шаги настройки",
    later: "Настроить позже",
    laterNote: "Закончить можно позже, из боковой панели.",
    getStarted: "Начать",
    installTools: (n) =>
      plural("ru", n, {
        one: "Установить # инструмент",
        few: "Установить # инструмента",
        many: "Установить # инструментов",
        other: "Установить # инструмента",
      }),
    openTools: "Открыть инструменты",
    continue: "Продолжить",
    blockedChecking: "Сначала проверяем компьютер…",
    resuming: "Проверяем, что уже настроено…",
    blockedSettingUp: "«Продолжить» откроется, когда Node.js будет установлен.",
    blockedNode: "Чтобы продолжить, установите Node.js или выберите «Установлю самостоятельно».",
    back: "Назад",
    skip: "Пропустить",
    tour: "Показать, что где",
  },
  welcome: {
    list: "Что делает WireCat",
    localTitle: "Всё остаётся на этом компьютере",
    local:
      "Инструменты хранят ваши сообщения, почту, встречи и файлы в хранилище на этом компьютере, а не в облаке WireCat.",
    openTitle: "Открытые инструменты, которые можно запускать самому",
    open: "Каждая интеграция — это консольный инструмент WireCat из npm. Приложение устанавливает их и запускает их собственные команды.",
    agentTitle: "Остальное сделает агент",
    agent:
      "Claude Code, Codex и другие агенты ищут в ваших данных и действуют с ними через эти инструменты, когда вы их об этом просите.",
    time: "Настройка займёт несколько минут. Любой шаг можно пропустить.",
  },
  computer: {
    list: "Ваш компьютер",
    system: "Система",
    notFound: "Не найден",
    checkingComputer: "Проверяем этот компьютер…",
    ready: "Всё готово для установки инструментов WireCat.",
    checking: "Проверяем…",
    again: "Проверить снова",
  },
  choose: {
    legend: "Инструменты для установки",
    partOf: (name) => `Входит в ${name}`,
    installed: "установлен",
  },
  install: {
    list: "Установка",
    notInstalled: "Не установлен",
    notInstalledFailed: "Не установился",
    checking: "Проверяем…",
    queued: "Ждёт своей очереди",
    asked: "Ждёт вашего ответа",
    installing: "Устанавливается",
    step: (label) => `${label}…`,
    installed: (version) => <>Установлен {version}</>,
    already: (version) => <>Уже установлен {version}</>,
    tryAgain: "Попробовать снова",
    none: "Инструменты не выбраны, поэтому устанавливать нечего.",
    choose: "Выбрать инструменты",
    rest: "Установить остальные",
    note: "Установка продолжится, если вы перейдёте дальше. Каждую из них также видно на странице «Инструменты» вместе с полным журналом.",
    allDone: "Всё установлено. Дальше — дать вашим ИИ-агентам навыки, чтобы они этим пользовались.",
    moreLater: "Другие инструменты можно установить позже на странице «Инструменты».",
  },
  wait: {
    label: "Ход всех установок",
    of: (n: number, total: number) => `${n} из ${total}`,
    installing: (name: string) => `Устанавливается ${name}`,
    waiting: "Начинаем",
    finished: (n: number) =>
      plural("ru", n, {
        one: "# инструмент установлен",
        few: "# инструмента установлено",
        other: "# инструментов установлено",
      }),
    failed: (n: number) =>
      plural("ru", n, { one: "# не установился", few: "# не установились", other: "# не установились" }),
    left: {
      almost: "Почти готово",
      underMinute: "Осталось меньше минуты",
      minutes: (n: number) =>
        plural("ru", n, {
          one: "Осталось около # минуты",
          few: "Осталось около # минут",
          other: "Осталось около # минут",
        }),
    },
    typical: "Обычно минута-две на инструмент. При медленном интернете дольше.",
    restart: "ИИ-приложения и терминалы, открытые до установки, увидят новые инструменты только после перезапуска.",
    manual:
      "WireCat не меняет настройки вашей оболочки. Добавьте эту строку в её файл запуска и откройте новый терминал:",
    hints: "Пока ждёте",
    hintOf: (n: number, total: number) => `${n} / ${total}`,
    previous: "Предыдущий совет",
    next: "Следующий совет",
    tips: {
      agents: {
        title: "Агент сам запускает инструменты",
        text: "На следующем шаге вы дадите Claude Code, Codex или другому агенту навык для каждого инструмента. Потом просто спросите, например: что Аня прислала мне вчера?",
      },
      tg: {
        title: "Любое сообщение в Telegram",
        text: "После синхронизации агент ищет в ваших чатах, не открывая Telegram, и цитирует найденное сообщение.",
      },
      wa: {
        title: "Чаты WhatsApp, которые читает агент",
        text: "Агент читает ваши чаты WhatsApp, ищет в них и может ответить за вас, когда вы попросите.",
      },
      zm: {
        title: "Спросите, о чём договорились на звонке",
        text: "Zoom хранит расшифровки и итоги записанных встреч, и агент расскажет, кто что обещал.",
      },
      drive: {
        title: "Ваши документы как текст",
        text: "Drive копирует выбранные папки простым текстом, и агент может процитировать документ, таблицу или PDF.",
      },
      memo: {
        title: "Почта и заметки в одном поиске",
        text: "Memo хранит заметки и почту вместе, и агент ищет в них вместе с вашими сообщениями.",
      },
      guides: {
        title: "Справка перед каждым звонком",
        text: "Рецепты учат агента утренней сводке, справке перед звонком и задачам из того, о чём вас просили.",
      },
      memory: {
        title: "Что запомнить, решаете вы",
        text: "В Памяти видно, что агенты отметили о вас и ваших собеседниках. Ничего не считается, пока вы не одобрите.",
      },
      local: {
        title: "Всё остаётся на этом компьютере",
        text: "Инструменты хранят данные в папках на этом компьютере. В Хранилище видно каждую папку и её размер.",
      },
    },
  },
  agents: {
    title: "Как инструмент добавляет свой навык",
    text: "Некоторые инструменты предлагают добавить навык во время входа, на следующем шаге: терминал спросит, какому агенту его отдать. Любой инструмент может добавить свой навык и из терминала — для Claude Code, Codex и Gemini CLI.",
    list: "Команды для навыков",
    why: {
      label: "Чем помогает навык",
      ask: "С навыком вы просите агента обычными словами, например:",
      example: "Что Аня прислала мне вчера?",
      points: [
        "Агент знает, какой инструмент может ответить, и сам его запускает.",
        "Без навыка агент не знает, что инструмент есть.",
        "Навык почти не занимает места. Агент читает его, только когда вопрос требует инструмента.",
        "Это один небольшой файл на этом компьютере. Удалить его можно потом на странице «Агенты».",
      ],
      next: "Установите навык для своих агентов ниже.",
    },
  },
  signIn: {
    list: "Инструменты для входа",
    looking: "Ищем установленные инструменты",
    accounts: (tool) => `Аккаунты ${tool}`,
    reading: (tool) => `Читаем аккаунты ${tool}`,
    listFailed: (error) => `Не удалось получить список аккаунтов: ${error}`,
    noAccount: (tool) => `Аккаунта пока нет. Добавьте его, чтобы агент мог работать с ${tool}.`,
    needs: "Что нужно: ",
    willAsk: "Он попросит: ",
    guide: "Как его создать",
    addAnother: "Добавить ещё аккаунт",
    add: "Добавить аккаунт",
    noneNeeded: "Пока ни одному установленному инструменту не нужен вход.",
    noSignIn: (_n, names) => `Для ${names} вход не нужен.`,
    gives: {
      tg: "Агент сможет читать ваши чаты в Telegram, искать в них и отправлять сообщения, когда вы попросите.",
      max: "Агент сможет читать ваши чаты в MAX, искать в них и отправлять сообщения, когда вы попросите.",
      wa: "Агент сможет читать ваши чаты в WhatsApp, искать в них и отправлять сообщения, когда вы попросите.",
      zm: "Агент сможет находить ваши встречи в Zoom и читать их расшифровки и итоги.",
      drive: "Агент сможет находить и читать ваши файлы на Google Drive. Изменять их он не сможет.",
      gcal: "Агент сможет находить и читать события вашего Google Календаря. Изменять календарь он не сможет.",
      email:
        "Агент сможет искать и читать вашу почту на этом компьютере. Синхронизация копирует почту сюда и никогда не меняет ваш ящик.",
    },
    asks: {
      tg: "В первый раз — номер телефона и код, который пришлёт Telegram: так регистрируется ваше собственное приложение Telegram. Затем QR-код, который нужно отсканировать в Telegram: «Настройки → Устройства → Подключить устройство».",
      max: "QR-код, который нужно отсканировать приложением MAX на телефоне.",
      wa: "QR-код, который нужно отсканировать в WhatsApp: «Настройки → Связанные устройства → Привязка устройства».",
      zm: "Браузер откроет Zoom, чтобы вы разрешили доступ. Сначала Zoom нужно ваше собственное приложение, которое один раз создаётся в Zoom App Marketplace.",
      drive: "Браузер откроет Google: выберите аккаунт и разрешите доступ к Drive только на чтение.",
      gcal: "Браузер откроет Google: выберите аккаунт и разрешите доступ к Календарю только на чтение.",
      email:
        "Ваш адрес почты, затем вход Microsoft в браузере или пароль приложения — отдельный пароль только для этой программы.",
    },
  },
  done: {
    list: "Ваши инструменты",
    notInstalled: "Не установлен",
    moreLater: "Другие инструменты можно установить позже на странице «Инструменты».",
    next: "Что дальше",
    agents: "Посмотреть, какие агенты их используют",
  },
  help: {
    help: "Помощь",
    docs: "Документация WireCat",
    tour: "Пройти экскурсию",
    welcome: "Снова показать приветствие",
    privacy: "Конфиденциальность",
    about: "О WireCat",
    node: "Node.js от WireCat…",
    trouble: "Помощь. Node.js или npm требует внимания",
  },
  tour: {
    tools: {
      title: "Инструменты",
      text: "Все инструменты WireCat в одном списке: установка, обновление, вход и проверка каждого. Если что-то не работает, начните отсюда.",
    },
    lamps: {
      title: "Лампы состояния",
      text: "Зелёная: установлен, последняя версия. Жёлтая: есть обновление. Красная: установлен, но не запускается. Пустое кольцо: не установлен.",
    },
    action: {
      title: "Одно действие на инструмент",
      text: "«Установить» или «Обновить» ставит на компьютер последнюю версию. «Управление» открывает профили инструмента, вход и проверку состояния.",
    },
    sync: {
      title: "Синхронизация",
      text: "Загружает новые сообщения, письма или заметки на этот компьютер, чтобы их видели поиск и агент. В «Управлении» видно, когда каждый аккаунт синхронизировался последний раз.",
    },
    agents: {
      title: "Агенты",
      text: "Какие ИИ-агенты на этом компьютере уже знают навык каждого инструмента, и кнопка, чтобы добавить недостающие.",
    },
    how: {
      title: "Как это работает с агентом",
      text: "Вы просите агента своими словами. Навык подсказывает ему, какую команду WireCat выполнить. WireCat следит, чтобы инструменты были установлены, вошли в аккаунт и синхронизировались, поэтому ответ приходит из ваших собственных сообщений и файлов.",
    },
    search: {
      title: "Поиск",
      text: "Найти сообщение, письмо или встречу в том, что один инструмент хранит на этом компьютере, для одного профиля. Здесь показаны примеры.",
    },
    searchAsk: {
      title: "Спросите своими словами",
      text: "Опишите, что ищете. Агент запишет это запросом в поле ниже; поиск начнётся, только когда вы нажмёте «Искать».",
    },
    searchHit: {
      title: "Откройте результат",
      text: "Откройте результат, чтобы прочитать сообщения вокруг него. Наведите на отправителя или чат: появятся кнопки, чтобы искать снова только по ним или без них.",
    },
    tasks: {
      title: "Задачи",
      text: "Задачи ваших проектов, от вас и ваших агентов. Просьбу из ваших сообщений агент может превратить в задачу, когда вы одобрите её в Памяти. Здесь показаны примеры.",
    },
    tasksView: {
      title: "Таблица или доска",
      text: "Сортируйте задачи в таблице или смотрите доску со столбцом на каждый статус и перетаскивайте задачу между ними.",
    },
    tasksRow: {
      title: "Кто, насколько срочно, к какому сроку",
      text: "В строке видно статус, исполнителя, приоритет, срок и чего задача ждёт. Откройте задачу, чтобы что-то изменить или оставить комментарий.",
    },
    memory: {
      title: "Память",
      text: "Что агенты сохранили из ваших чатов, почты и заметок: факты, предпочтения, обещания и решения. Ничего не считается, пока вы не одобрите. Здесь показаны примеры.",
    },
    memoryReview: {
      title: "Одобрить или исправить",
      text: "Одобрите верное, отклоните неверное. В «Ещё» есть «Изменить», чтобы исправить текст, и «Стереть», чтобы забыть запись навсегда.",
    },
    memorySources: {
      title: "Откуда это",
      text: "У каждой записи видны сообщения и письма, на которых она основана. Нажмите на одно, чтобы прочитать его среди соседних.",
    },
    system: {
      title: "Хранилище, журнал и настройки",
      text: "Сколько места занимают данные каждого инструмента, что делал каждый запуск и что пошло не так, и настройки инструментов.",
    },
    help: {
      title: "Помощь здесь",
      text: "Этой кнопкой можно открыть документацию WireCat, снова начать экскурсию, вернуться к шагам настройки или посмотреть, готовы ли Node.js и npm. Номер версии внизу слева открывает то же меню.",
    },
    guide: {
      title: "Ваш первый рецепт",
      text: "Рецепт: просьба, которую вы копируете агенту, и шаги, которые он выполнит. Попробуйте этот или посмотрите следующий.",
    },
  },
  tourEnd: {
    tryGuide: "Попробовать рецепт",
    nextGuide: "Следующий рецепт",
    openTools: "Открыть инструменты",
  },
}

const es: OnboardingText = {
  steps: {
    welcome: "Bienvenida",
    computer: "Tu ordenador",
    choose: "Herramientas",
    install: "Instalación",
    agents: "Agentes",
    signin: "Inicio de sesión",
    done: "Listo",
  },
  pages: {
    welcome: {
      title: "Te damos la bienvenida a WireCat",
      lead: "Conecta tu agente de IA (Claude Code, Codex y otros) a tus propios mensajes, correo, reuniones y archivos.",
    },
    computer: {
      title: "Tu ordenador",
      lead: "Las herramientas de WireCat funcionan con Node.js y se instalan con npm. WireCat Desktop funciona sin ellos.",
    },
    choose: {
      title: "Elige herramientas",
      lead: "Marca los servicios a los que debe llegar tu agente. Puedes añadir o quitar herramientas más tarde.",
    },
    install: {
      title: "Instalación",
      lead: "Cada herramienta se instala desde npm y se comprueba que arranca. Se instalan de una en una.",
    },
    agents: {
      title: "Conecta agentes",
      lead: "Tu agente aprende a usar cada herramienta con una skill: una guía breve de sus comandos y de cuándo usarlos.",
    },
    signin: {
      title: "Inicia sesión",
      lead: "Al iniciar sesión, la herramienta se conecta a tu cuenta y tu agente puede llegar a ella. El inicio de sesión se hace aquí, en esta ventana, paso a paso: códigos QR, códigos y contraseñas incluidos. Solo una versión demasiado antigua de una herramienta lo hace en una terminal.",
    },
    done: {
      title: "Todo listo",
      lead: "Las herramientas de abajo están instaladas en este ordenador. Un breve recorrido te enseña la ventana y termina en tu primera guía.",
    },
  },
  flow: {
    stepsNav: "Pasos de configuración",
    later: "Configurar más tarde",
    laterNote: "Termina más tarde desde la barra lateral.",
    getStarted: "Empezar",
    installTools: (n) => plural("es", n, { one: "Instalar # herramienta", other: "Instalar # herramientas" }),
    openTools: "Abrir Herramientas",
    continue: "Continuar",
    blockedChecking: "Primero comprobamos este equipo…",
    resuming: "Comprobando qué está ya configurado…",
    blockedSettingUp: "Continuar se activa cuando Node.js esté listo.",
    blockedNode: "Para continuar, prepara Node.js o elige «Lo instalo yo».",
    back: "Atrás",
    skip: "Omitir",
    tour: "Enséñame la ventana",
  },
  welcome: {
    list: "Qué hace WireCat",
    localTitle: "Todo se queda en este ordenador",
    local:
      "Las herramientas guardan tus mensajes, correo, reuniones y archivos en el almacenamiento de este ordenador, no en una nube de WireCat.",
    openTitle: "Herramientas abiertas que podrías ejecutar tú",
    open: "Cada integración es una herramienta de línea de comandos de WireCat publicada en npm. Esta app las instala y ejecuta sus propios comandos.",
    agentTitle: "Tu agente hace el resto",
    agent:
      "Claude Code, Codex y otros agentes usan las herramientas para buscar en tus datos y actuar sobre ellos cuando se lo pides.",
    time: "La configuración lleva unos minutos. Puedes saltarte cualquier paso.",
  },
  computer: {
    list: "Tu ordenador",
    system: "Sistema",
    notFound: "No encontrado",
    checkingComputer: "Comprobando este ordenador…",
    ready: "Listo para instalar las herramientas de WireCat.",
    checking: "Comprobando…",
    again: "Volver a comprobar",
  },
  choose: {
    legend: "Herramientas para instalar",
    partOf: (name) => `Parte de ${name}`,
    installed: "instalada",
  },
  install: {
    list: "Instalando",
    notInstalled: "Sin instalar",
    notInstalledFailed: "No se instaló",
    checking: "Comprobando…",
    queued: "Esperando su turno",
    asked: "Esperando tu respuesta",
    installing: "Instalando",
    step: (label) => `${label}…`,
    installed: (version) => <>Instalada {version}</>,
    already: (version) => <>Ya instalada {version}</>,
    tryAgain: "Reintentar",
    none: "No has elegido ninguna herramienta, así que no hay nada que instalar.",
    choose: "Elegir herramientas",
    rest: "Instalar el resto",
    note: "Las instalaciones siguen aunque pases al siguiente paso. Cada una aparece también en la página Herramientas, con su registro completo.",
    allDone: "Todo está instalado. Ahora, da a tus agentes de IA las habilidades para usarlo.",
    moreLater: "Puedes instalar otras herramientas más tarde en la página Herramientas.",
  },
  wait: {
    label: "Progreso de todas las instalaciones",
    of: (n: number, total: number) => `${n} de ${total}`,
    installing: (name: string) => `Instalando ${name}`,
    waiting: "Empezando",
    finished: (n: number) => plural("es", n, { one: "# herramienta instalada", other: "# herramientas instaladas" }),
    failed: (n: number) => plural("es", n, { one: "# no se instaló", other: "# no se instalaron" }),
    left: {
      almost: "Casi listo",
      underMinute: "Queda menos de un minuto",
      minutes: (n: number) => plural("es", n, { one: "Queda un minuto", other: "Quedan unos # minutos" }),
    },
    typical: "Suele tardar uno o dos minutos por herramienta. Con una conexión lenta, más.",
    restart:
      "Las apps de IA y los terminales que ya estaban abiertos solo ven las herramientas nuevas tras reiniciarlos.",
    manual:
      "WireCat no edita la configuración de tu shell. Añade esta línea a su archivo de inicio y abre un terminal nuevo:",
    hints: "Mientras esperas",
    hintOf: (n: number, total: number) => `${n} / ${total}`,
    previous: "Consejo anterior",
    next: "Consejo siguiente",
    tips: {
      agents: {
        title: "Tu agente usa las herramientas por ti",
        text: "En el siguiente paso das a Claude Code, Codex u otro agente una habilidad para cada herramienta. Luego solo pregúntale, por ejemplo: ¿qué me mandó Ana ayer?",
      },
      tg: {
        title: "Cualquier mensaje de Telegram",
        text: "Tras una sincronización, tu agente busca en tus chats sin abrir Telegram y cita el mensaje que encontró.",
      },
      wa: {
        title: "Chats de WhatsApp que tu agente puede leer",
        text: "Tu agente lee y busca en tus chats de WhatsApp, y puede responder por ti cuando se lo pidas.",
      },
      zm: {
        title: "Pregunta qué se acordó en una llamada",
        text: "Zoom guarda las transcripciones y resúmenes de tus reuniones grabadas, así tu agente te dice quién prometió qué.",
      },
      drive: {
        title: "Tus documentos, como texto",
        text: "Drive copia las carpetas que eliges como texto, así tu agente puede citar un Doc, una hoja o un PDF.",
      },
      memo: {
        title: "Correo y notas en una búsqueda",
        text: "Memo guarda tus notas y tu correo juntos, y tu agente busca en ellos junto con tus mensajes.",
      },
      guides: {
        title: "Un resumen antes de cada llamada",
        text: "Las guías enseñan a tu agente a darte un resumen cada mañana, un repaso antes de una llamada y tareas de lo que te pidieron.",
      },
      memory: {
        title: "Tú apruebas lo que recuerda",
        text: "Memoria muestra lo que tus agentes anotaron sobre ti y las personas con las que hablas. Nada cuenta hasta que lo apruebas.",
      },
      local: {
        title: "Todo se queda en este ordenador",
        text: "Las herramientas guardan sus datos en carpetas de este ordenador. Almacenamiento muestra cada carpeta y cuánto ocupa.",
      },
    },
  },
  agents: {
    title: "Cómo añade una herramienta su skill",
    text: "Algunas herramientas ofrecen añadir su skill al iniciar sesión, en el siguiente paso: la terminal pregunta qué agente debe recibirla. Cualquier herramienta también puede añadir su skill desde una terminal, para Claude Code, Codex y Gemini CLI.",
    list: "Comandos de skills",
    why: {
      label: "Para qué sirve una skill",
      ask: "Con una skill, le pides a tu agente las cosas con tus palabras, por ejemplo:",
      example: "¿Qué me envió Anna ayer?",
      points: [
        "El agente sabe qué herramienta puede responder y la ejecuta por ti.",
        "Sin la skill, el agente no sabe que la herramienta existe.",
        "La skill casi no ocupa espacio. El agente la lee solo cuando tu pregunta necesita la herramienta.",
        "Es un archivo pequeño en este equipo. Puedes quitarla más tarde en la página Agentes.",
      ],
      next: "Instala la skill para tus agentes aquí abajo.",
    },
  },
  signIn: {
    list: "Herramientas en las que iniciar sesión",
    looking: "Buscando herramientas instaladas",
    accounts: (tool) => `Cuentas de ${tool}`,
    reading: (tool) => `Leyendo las cuentas de ${tool}`,
    listFailed: (error) => `No se pudieron listar las cuentas: ${error}`,
    noAccount: (tool) => `Aún no hay ninguna cuenta. Añade una para que tu agente pueda usar ${tool}.`,
    needs: "Qué necesita: ",
    willAsk: "Te pedirá: ",
    guide: "Cómo crearla",
    addAnother: "Añadir otra cuenta",
    add: "Añadir una cuenta",
    noneNeeded: "Ninguna herramienta instalada necesita iniciar sesión por ahora.",
    noSignIn: (n, names) =>
      n === 1 ? `${names} no necesita iniciar sesión.` : `${names} no necesitan iniciar sesión.`,
    gives: {
      tg: "Tu agente podrá leer y buscar en tus chats de Telegram, y enviar mensajes cuando se lo pidas.",
      max: "Tu agente podrá leer y buscar en tus chats de MAX, y enviar mensajes cuando se lo pidas.",
      wa: "Tu agente podrá leer y buscar en tus chats de WhatsApp, y enviar mensajes cuando se lo pidas.",
      zm: "Tu agente podrá encontrar tus reuniones de Zoom y leer sus transcripciones y resúmenes.",
      drive: "Tu agente podrá encontrar y leer tus archivos de Google Drive. No puede cambiarlos.",
      gcal: "Tu agente podrá encontrar y leer los eventos de tu Google Calendar. No puede cambiar tu calendario.",
      email:
        "Tu agente podrá buscar y leer tu correo en este equipo. La sincronización copia el correo aquí y nunca cambia tu buzón.",
    },
    asks: {
      tg: "La primera vez, tu número de teléfono y el código que envía Telegram, para registrar tu propia app de Telegram. Después, un código QR que escaneas en Telegram: Ajustes → Dispositivos → Vincular dispositivo.",
      max: "Un código QR que escaneas con la app de MAX en tu móvil.",
      wa: "Un código QR que escaneas en WhatsApp: Ajustes → Dispositivos vinculados → Vincular un dispositivo.",
      zm: "Tu navegador abre Zoom para que apruebes el acceso. Antes, Zoom necesita una app tuya, que se crea una sola vez en el Zoom App Marketplace.",
      drive: "Tu navegador abre Google: elige la cuenta y permite el acceso de solo lectura a Drive.",
      gcal: "Tu navegador abre Google: elige la cuenta y permite el acceso de solo lectura a Calendar.",
      email:
        "Tu dirección de correo, y después el inicio de sesión de Microsoft en el navegador o una contraseña de aplicación: una contraseña solo para este programa.",
    },
  },
  done: {
    list: "Tus herramientas",
    notInstalled: "Sin instalar",
    moreLater: "Puedes instalar otras herramientas más tarde en la página Herramientas.",
    next: "Qué sigue",
    agents: "Ver qué agentes las usan",
  },
  help: {
    help: "Ayuda",
    docs: "Documentación de WireCat",
    tour: "Hacer el recorrido",
    welcome: "Ver de nuevo la bienvenida",
    privacy: "Privacidad",
    about: "Acerca de WireCat",
    node: "El Node.js de WireCat…",
    trouble: "Ayuda. Node.js o npm necesita atención",
  },
  tour: {
    tools: {
      title: "Herramientas",
      text: "Todas las herramientas de WireCat en una lista: instala, actualiza, inicia sesión y revisa cada una. Si algo no funciona, empieza aquí.",
    },
    lamps: {
      title: "Luces de estado",
      text: "Verde: instalada y al día. Ámbar: hay una actualización. Roja: instalada, pero no arranca. Un anillo vacío: sin instalar.",
    },
    action: {
      title: "Una acción por herramienta",
      text: "Instalar o Actualizar pone la última versión en este ordenador. Gestionar abre los perfiles de la herramienta, el inicio de sesión y la revisión de estado.",
    },
    sync: {
      title: "Sincronizar",
      text: "Trae mensajes, correos o notas nuevos a este ordenador, para que los vean la búsqueda y tu agente. Gestionar muestra la última sincronización de cada cuenta.",
    },
    agents: {
      title: "Agentes",
      text: "Qué agentes de IA de este ordenador tienen la skill de cada herramienta, con un botón para añadir las que faltan.",
    },
    how: {
      title: "Cómo funciona con tu agente",
      text: "Le pides algo a tu agente con tus palabras. Su skill le dice qué comando de WireCat ejecutar. WireCat mantiene las herramientas instaladas, con la sesión iniciada y sincronizadas, así que la respuesta sale de tus propios mensajes y archivos.",
    },
    search: {
      title: "Buscar",
      text: "Encuentra un mensaje, un correo o una reunión en lo que una herramienta guarda en este ordenador, para un perfil. Los resultados de aquí son ejemplos.",
    },
    searchAsk: {
      title: "Pregunta con tus palabras",
      text: "Describe lo que buscas. Tu agente lo escribe como consulta en el cuadro de abajo; no se busca nada hasta que pulsas Buscar.",
    },
    searchHit: {
      title: "Abre un resultado",
      text: "Abre un resultado para leer los mensajes de alrededor. Señala un remitente o un chat para ver botones que buscan de nuevo solo con ellos, o sin ellos.",
    },
    tasks: {
      title: "Tareas",
      text: "Las tareas de tus proyectos, tuyas y de tus agentes. Un agente puede convertir una petición de tus mensajes en tarea cuando la apruebas en Memoria. Las filas de aquí son ejemplos.",
    },
    tasksView: {
      title: "Tabla o tablero",
      text: "Ordena las tareas en una tabla, o mira un tablero con una columna por estado y arrastra una tarea para moverla.",
    },
    tasksRow: {
      title: "Quién, qué urgencia, para cuándo",
      text: "Cada fila muestra el estado, quién la hace, la prioridad, la fecha límite y lo que espera. Abre una tarea para cambiarlos o comentar.",
    },
    memory: {
      title: "Memoria",
      text: "Lo que tus agentes guardaron de tus chats, correo y notas: datos, preferencias, promesas y decisiones. Nada cuenta hasta que lo apruebas. Las filas de aquí son ejemplos.",
    },
    memoryReview: {
      title: "Aprueba o corrige",
      text: "Aprueba lo correcto, rechaza lo que no lo es. En Más están Editar, para corregir el texto, y Borrar, para olvidarlo del todo.",
    },
    memorySources: {
      title: "De dónde viene",
      text: "Cada recuerdo muestra los mensajes y correos en los que se basa. Pulsa uno para leerlo entre los mensajes de alrededor.",
    },
    system: {
      title: "Almacenamiento, Registros y Ajustes",
      text: "Cuánto ocupan los datos de cada herramienta, qué hizo cada ejecución y qué falló, y los ajustes de cada herramienta.",
    },
    help: {
      title: "La ayuda está aquí",
      text: "Desde este botón puedes abrir la documentación de WireCat, empezar de nuevo este recorrido, volver a los pasos de configuración o ver si Node.js y npm están listos. El número de versión abajo a la izquierda también lo abre.",
    },
    guide: {
      title: "Tu primera guía",
      text: "Una guía es una petición que copias en tu agente, con los pasos que ejecutará. Prueba esta o mira la siguiente.",
    },
  },
  tourEnd: {
    tryGuide: "Probar esta guía",
    nextGuide: "Siguiente guía",
    openTools: "Abrir Herramientas",
  },
}

export const onboardingMessages: Messages<OnboardingText> = { en, ru, es }
