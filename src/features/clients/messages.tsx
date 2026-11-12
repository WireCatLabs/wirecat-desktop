// cspell:words Clientes Сделки Лиды Negociaciones Prospectos
import type { Kind } from "@/domain/clients"
import { formatNumber, type Messages, plural } from "@/i18n"

type Words = {
  title: string
  intro: string
  readAgain: string
  reading: string
  kind: string
  kinds: Record<Kind, string>
  pipeline: string
  ownAccount: string
  allAccounts: string
  readFailed: string
  crmWhy: string
  notices: string
  crmChip: Record<"missing" | "old" | "signedOut", (tool: string) => string>
  readOnlyChip: string
  tryAgain: string
  none: Record<Kind, string>
  noneBody: Record<Kind, string>
  noMatch: string
  clear: string
  more: (n: number) => string
  notLoaded: (n: number) => string
  showMore: (n: number) => string
  search: string
  searchHint: string
  owner: string
  nobody: string
  stage: string
  stageOf: (title: string) => string
  baseStage: string
  baseStageHint: string
  account: string
  column: (name: string, n: number) => string
  emptyColumn: string
  readOnly: string
  draggable: string
  dragHint: string
  picked: (ref: string) => string
  place: (column: string, at: number, of: number) => string
  dropped: (ref: string, column: string) => string
  putBack: (ref: string, reason?: string) => string
  notMoved: (reason: string) => string
  /** Who the sync downloads: `also` are the CRM users chosen beside the owner, null when not known yet. */
  scopeWho: (also: readonly string[] | null) => string
  scopeAll: string
  scopeToMine: string
  scopeHint: string
  scopeAbout: string
  applied: (mode: "mine" | "all") => string
  scopeSaving: string
  scopeFailed: string
  amount: string
  organization: string
  people: string
  roles: Record<string, string>
  closeDate: string
  closedDate: string
  closedReason: string
  project: string
  updated: string
  statusOf: Record<string, string>
  close: string
  tasksTitle: string
  tasksNone: string
  tasksNoPeople: string
  tasksFailed: string
  tasksAll: (n: number) => string
  tasksOwn: Record<"deal" | "lead", string>
  tasksOwnNone: Record<"deal" | "lead", string>
  tasksCompany: (company: string) => string
  tasksCompanyNone: string
  cancel: string
  readOnlyInstall: (tool: string) => string
  readOnlyUpdate: (tool: string) => string
  profileTitle: (tool: string, account: string) => string
  profileBody: (tool: string) => string
  profileNone: (tool: string) => string
  profileWhy: (why: string) => string
  profileMove: string
  profileNeeded: string
  profileUse: string
  chooseProfile: string
  scopeAs: (profile: string) => string
  scopeWhy: { crmCli: string; crmCliMissing: (tool: string) => string; crmCliOld: (tool: string) => string }
}

const en: Words = {
  title: "Clients",
  intro:
    "Deals and leads from your CRMs and your own pipelines, by stage. WireCat keeps a copy on this computer and shows every account in it.",
  readAgain: "Read again",
  reading: "Reading…",
  kind: "Show",
  kinds: { deal: "Deals", lead: "Leads" },
  pipeline: "Pipeline",
  ownAccount: "Your own",
  allAccounts: "Every account",
  readFailed: "Could not read the deals.",
  crmWhy: "Deals you add here work without one; a CRM brings in the deals and leads you keep there.",
  notices: "Notices",
  crmChip: {
    missing: (tool) => `${tool} not installed`,
    old: (tool) => `${tool} needs an update`,
    signedOut: (tool) => `${tool}: not signed in`,
  },
  readOnlyChip: "Read only",
  tryAgain: "Try again",
  none: { deal: "No deals yet", lead: "No leads yet" },
  noneBody: {
    deal: "Sync a CRM on the Tools page, or ask your agent to record a deal. Deals show here by stage.",
    lead: "Sync a CRM on the Tools page, or ask your agent to record a lead. Leads show here by stage.",
  },
  noMatch: "Nothing on this board matches.",
  clear: "Clear",
  more: (n) =>
    `More match than one read holds: the first ${formatNumber(n, "en")} are shown. Each column counts them all and says how many it does not show.`,
  notLoaded: (n) => `${formatNumber(n, "en")} more not loaded`,
  showMore: (n) => `Show ${formatNumber(n, "en")} more`,
  search: "Search the board",
  searchHint: "Words, owner:, stage:, amount:>=1000",
  owner: "Responsible",
  nobody: "Nobody",
  stage: "Stage",
  stageOf: (title) => `Stage of ${title}`,
  baseStage: "Base stage",
  baseStageHint: "Your own stage. Stages from every CRM are placed on it, so everything lines up on one board.",
  account: "Account",
  column: (name, n) => plural("en", n, { one: `${name}, # card`, other: `${name}, # cards` }),
  emptyColumn: "Nothing here",
  readOnly:
    "Read only: WireCat cannot run this CRM's own tool yet, so a change would stay on this computer. Change stages in the CRM, then sync.",
  draggable: "movable card",
  dragHint: "Press Space to pick it up, the arrow keys to carry it, Space to drop it, Escape to put it back.",
  picked: (ref) => `Picked up ${ref}.`,
  place: (column, at, of) => `${column}, place ${at} of ${of}.`,
  dropped: (ref, column) => `Dropped ${ref} in ${column}.`,
  putBack: (ref, reason) => (reason ? `${ref} is back where it was: ${reason}` : `${ref} is back where it was.`),
  notMoved: (reason) => `Not moved: ${reason}`,
  scopeWho: (also) =>
    also === null
      ? "downloads the deals of the users you chose"
      : also.length === 0
        ? "downloads your deals"
        : `downloads your deals and those of ${also.join(", ")}`,
  scopeAll: "This CRM is set to download everyone's deals, so its sync stops. Download only yours instead.",
  scopeToMine: "Only mine",
  scopeHint:
    "WireCat downloads only the deals of the CRM users you chose in the CLI, and the clients on them. Find any other client in the CRM itself.",
  scopeAbout: "About the sync scope",
  applied: (mode) => `Last sync downloaded: ${mode === "all" ? "everyone's" : "mine"}.`,
  scopeSaving: "Saving and syncing…",
  scopeFailed: "The sync scope did not change.",
  amount: "Amount",
  organization: "Company",
  people: "People",
  roles: { owner: "Responsible", contact: "Contact", "decision-maker": "Decides", influencer: "Influences" },
  closeDate: "Expected to close",
  closedDate: "Closed",
  closedReason: "Why",
  project: "Project",
  updated: "Last changed",
  statusOf: { open: "Open", won: "Won", lost: "Lost" },
  close: "Close",
  tasksTitle: "Tasks of the client's contacts",
  tasksNone: "The client's contacts have no tasks.",
  tasksNoPeople: "No contact person on this card, so there are no tasks to show.",
  tasksFailed: "Could not read the tasks.",
  tasksAll: (n) => `All ${n} on the Tasks page`,
  tasksOwn: { deal: "Tasks of this deal", lead: "Tasks of this lead" },
  tasksOwnNone: { deal: "This deal has no tasks.", lead: "This lead has no tasks." },
  tasksCompany: (company) => `Tasks of ${company}`,
  tasksCompanyNone: "The company has no tasks, in its projects or in its deals and leads.",
  cancel: "Cancel",
  readOnlyInstall: (tool) => `Read only: install ${tool} on the Tools page to move this CRM's cards from here.`,
  readOnlyUpdate: (tool) => `Read only: update ${tool} on the Tools page to move this CRM's cards from here.`,
  profileTitle: (tool, account) => `Which ${tool} profile changes ${account}?`,
  profileBody: (tool) =>
    `More than one ${tool} profile is signed in to this account. The one you choose moves its cards and saves its sync setting until WireCat closes.`,
  profileNone: (tool) =>
    `No ${tool} profile has synced this account yet, so its cards stay read only. Sign in on the Tools page and sync, then try again.`,
  profileWhy: (why) => `The reason: ${why}`,
  profileMove: "Use it and move",
  profileNeeded: "Choose a profile first.",
  profileUse: "Use this profile",
  chooseProfile: "Choose profile",
  scopeAs: (profile) => `Through profile ${profile}.`,
  scopeWhy: {
    crmCli: "WireCat cannot change this setting yet.",
    crmCliMissing: (tool) => `Install ${tool} on the Tools page to change this.`,
    crmCliOld: (tool) => `Update ${tool} on the Tools page to change this.`,
  },
}

const ru: Words = {
  title: "Клиенты",
  intro:
    "Сделки и лиды из ваших CRM и ваших собственных воронок, по этапам. WireCat хранит копию на этом компьютере и показывает все аккаунты в ней.",
  readAgain: "Прочитать заново",
  reading: "Читаю…",
  kind: "Показать",
  kinds: { deal: "Сделки", lead: "Лиды" },
  pipeline: "Воронка",
  ownAccount: "Ваша собственная",
  allAccounts: "Все аккаунты",
  readFailed: "Не удалось прочитать сделки.",
  crmWhy: "Сделки, добавленные здесь, работают и без неё; CRM приносит сделки и лиды, которые вы ведёте там.",
  notices: "Уведомления",
  crmChip: {
    missing: (tool) => `${tool} не установлен`,
    old: (tool) => `${tool} нужно обновить`,
    signedOut: (tool) => `${tool}: вход не выполнен`,
  },
  readOnlyChip: "Только чтение",
  tryAgain: "Ещё раз",
  none: { deal: "Сделок пока нет", lead: "Лидов пока нет" },
  noneBody: {
    deal: "Синхронизируйте CRM на странице «Инструменты» или попросите агента записать сделку. Сделки появятся здесь по этапам.",
    lead: "Синхронизируйте CRM на странице «Инструменты» или попросите агента записать лид. Лиды появятся здесь по этапам.",
  },
  noMatch: "На доске ничего не подходит.",
  clear: "Сбросить",
  more: (n) =>
    `Подходит больше, чем помещается в одно чтение: показаны первые ${formatNumber(n, "ru")}. Колонки считают все и пишут, сколько не загружено.`,
  notLoaded: (n) => `Ещё ${formatNumber(n, "ru")} не загружено`,
  showMore: (n) => `Показать ещё ${formatNumber(n, "ru")}`,
  search: "Поиск по доске",
  searchHint: "Слова, owner:, stage:, amount:>=1000",
  owner: "Ответственный",
  nobody: "Никто",
  stage: "Этап",
  stageOf: (title) => `Этап: ${title}`,
  baseStage: "Базовый этап",
  baseStageHint: "Ваш собственный этап. На него ставятся этапы из всех CRM, чтобы всё стояло на одной доске.",
  account: "Аккаунт",
  column: (name, n) =>
    plural("ru", n, { one: `${name}, # карточка`, few: `${name}, # карточки`, other: `${name}, # карточек` }),
  emptyColumn: "Пусто",
  readOnly:
    "Только чтение: WireCat пока не умеет запускать инструмент этой CRM, и изменение осталось бы только на этом компьютере. Меняйте этапы в CRM, затем синхронизируйте.",
  draggable: "перемещаемая карточка",
  dragHint: "Пробел — взять, стрелки — перенести, пробел — положить, Escape — вернуть на место.",
  picked: (ref) => `${ref} взята.`,
  place: (column, at, of) => `${column}, место ${at} из ${of}.`,
  dropped: (ref, column) => `${ref} перенесена в «${column}».`,
  putBack: (ref, reason) => (reason ? `${ref} вернулась на место: ${reason}` : `${ref} вернулась на место.`),
  notMoved: (reason) => `Не перенесено: ${reason}`,
  scopeWho: (also) =>
    also === null
      ? "скачиваются сделки выбранных сотрудников"
      : also.length === 0
        ? "скачиваются ваши сделки"
        : `скачиваются ваши сделки и сделки: ${also.join(", ")}`,
  scopeAll: "Эта CRM настроена скачивать сделки всех, поэтому синхронизация остановлена. Скачивайте только свои.",
  scopeToMine: "Только мои",
  scopeHint:
    "WireCat скачивает только сделки пользователей CRM, которых вы выбрали в CLI, и клиентов из них. Других клиентов ищите в самой CRM.",
  scopeAbout: "Об охвате синхронизации",
  applied: (mode) => `Последняя синхронизация скачала: ${mode === "all" ? "все" : "мои"}.`,
  scopeSaving: "Сохраняю и синхронизирую…",
  scopeFailed: "Охват синхронизации не изменился.",
  amount: "Сумма",
  organization: "Компания",
  people: "Люди",
  roles: { owner: "Ответственный", contact: "Контакт", "decision-maker": "Принимает решение", influencer: "Влияет" },
  closeDate: "Ожидаемое закрытие",
  closedDate: "Закрыта",
  closedReason: "Почему",
  project: "Проект",
  updated: "Последнее изменение",
  statusOf: { open: "Открыта", won: "Выиграна", lost: "Проиграна" },
  close: "Закрыть",
  tasksTitle: "Задачи контактов клиента",
  tasksNone: "У контактов клиента задач нет.",
  tasksNoPeople: "На карточке нет контактного лица, поэтому задач не показать.",
  tasksFailed: "Не удалось прочитать задачи.",
  tasksAll: (n) => `Все ${n} на странице «Задачи»`,
  tasksOwn: { deal: "Задачи этой сделки", lead: "Задачи этого лида" },
  tasksOwnNone: { deal: "У этой сделки задач нет.", lead: "У этого лида задач нет." },
  tasksCompany: (company) => `Задачи компании ${company}`,
  tasksCompanyNone: "У компании нет задач ни в ее проектах, ни в ее сделках и лидах.",
  cancel: "Отмена",
  readOnlyInstall: (tool) =>
    `Только чтение: установите ${tool} на странице «Инструменты», чтобы переносить карточки этой CRM отсюда.`,
  readOnlyUpdate: (tool) =>
    `Только чтение: обновите ${tool} на странице «Инструменты», чтобы переносить карточки этой CRM отсюда.`,
  profileTitle: (tool, account) => `Какой профиль ${tool} меняет ${account}?`,
  profileBody: (tool) =>
    `В этот аккаунт вошли несколько профилей ${tool}. Выбранный переносит его карточки и сохраняет настройку синхронизации, пока WireCat открыт.`,
  profileNone: (tool) =>
    `Ни один профиль ${tool} ещё не синхронизировал этот аккаунт, поэтому его карточки только для чтения. Войдите на странице «Инструменты», синхронизируйте и попробуйте снова.`,
  profileWhy: (why) => `Причина: ${why}`,
  profileMove: "Выбрать и перенести",
  profileNeeded: "Сначала выберите профиль.",
  profileUse: "Выбрать профиль",
  chooseProfile: "Выбрать профиль",
  scopeAs: (profile) => `Через профиль ${profile}.`,
  scopeWhy: {
    crmCli: "WireCat пока не может менять эту настройку.",
    crmCliMissing: (tool) => `Установите ${tool} на странице «Инструменты», чтобы это менять.`,
    crmCliOld: (tool) => `Обновите ${tool} на странице «Инструменты», чтобы это менять.`,
  },
}

const es: Words = {
  title: "Clientes",
  intro:
    "Negociaciones y prospectos de tus CRM y de tus propios embudos, por etapa. WireCat guarda una copia en este ordenador y muestra cada cuenta que contiene.",
  readAgain: "Leer de nuevo",
  reading: "Leyendo…",
  kind: "Mostrar",
  kinds: { deal: "Negociaciones", lead: "Prospectos" },
  pipeline: "Embudo",
  ownAccount: "El tuyo",
  allAccounts: "Todas las cuentas",
  readFailed: "No se pudieron leer las negociaciones.",
  crmWhy:
    "Las negociaciones que añades aquí funcionan sin él; un CRM trae las negociaciones y los leads que llevas allí.",
  notices: "Avisos",
  crmChip: {
    missing: (tool) => `${tool} no está instalado`,
    old: (tool) => `${tool} necesita actualizarse`,
    signedOut: (tool) => `${tool}: sin sesión`,
  },
  readOnlyChip: "Solo lectura",
  tryAgain: "Reintentar",
  none: { deal: "Aún no hay negociaciones", lead: "Aún no hay prospectos" },
  noneBody: {
    deal: "Sincroniza un CRM en la página Herramientas o pide a tu agente que registre una negociación. Aparecen aquí por etapa.",
    lead: "Sincroniza un CRM en la página Herramientas o pide a tu agente que registre un prospecto. Aparecen aquí por etapa.",
  },
  noMatch: "Nada del tablero coincide.",
  clear: "Borrar",
  more: (n) =>
    `Coinciden más de los que caben en una lectura: se muestran los primeros ${formatNumber(n, "es")}. Cada columna los cuenta todos y dice cuántos no muestra.`,
  notLoaded: (n) => `${formatNumber(n, "es")} más sin cargar`,
  showMore: (n) => `Mostrar ${formatNumber(n, "es")} más`,
  search: "Buscar en el tablero",
  searchHint: "Palabras, owner:, stage:, amount:>=1000",
  owner: "Responsable",
  nobody: "Nadie",
  stage: "Etapa",
  stageOf: (title) => `Etapa de ${title}`,
  baseStage: "Etapa base",
  baseStageHint: "Tu propia etapa. En ella se colocan las etapas de cada CRM, así todo queda en un tablero.",
  account: "Cuenta",
  column: (name, n) => plural("es", n, { one: `${name}, # tarjeta`, other: `${name}, # tarjetas` }),
  emptyColumn: "Nada aquí",
  readOnly:
    "Solo lectura: WireCat aún no puede ejecutar la herramienta de este CRM, así que un cambio se quedaría en este ordenador. Cambia las etapas en el CRM y sincroniza.",
  draggable: "tarjeta movible",
  dragHint: "Espacio para cogerla, las flechas para llevarla, Espacio para soltarla, Escape para devolverla.",
  picked: (ref) => `${ref} cogida.`,
  place: (column, at, of) => `${column}, puesto ${at} de ${of}.`,
  dropped: (ref, column) => `${ref} soltada en ${column}.`,
  putBack: (ref, reason) => (reason ? `${ref} ha vuelto a su sitio: ${reason}` : `${ref} ha vuelto a su sitio.`),
  notMoved: (reason) => `No se movió: ${reason}`,
  scopeWho: (also) =>
    also === null
      ? "se descargan los tratos de los usuarios elegidos"
      : also.length === 0
        ? "se descargan tus tratos"
        : `se descargan tus tratos y los de ${also.join(", ")}`,
  scopeAll:
    "Este CRM está configurado para descargar los tratos de todos, así que su sincronización se detiene. Descarga solo los tuyos.",
  scopeToMine: "Solo las mías",
  scopeHint:
    "WireCat descarga solo los tratos de los usuarios del CRM que elegiste en la CLI y sus clientes. Busca cualquier otro cliente en el propio CRM.",
  scopeAbout: "Sobre el alcance de la sincronización",
  applied: (mode) => `La última sincronización descargó: ${mode === "all" ? "de todos" : "mías"}.`,
  scopeSaving: "Guardando y sincronizando…",
  scopeFailed: "El alcance de la sincronización no cambió.",
  amount: "Importe",
  organization: "Empresa",
  people: "Personas",
  roles: { owner: "Responsable", contact: "Contacto", "decision-maker": "Decide", influencer: "Influye" },
  closeDate: "Cierre previsto",
  closedDate: "Cerrada",
  closedReason: "Por qué",
  project: "Proyecto",
  updated: "Último cambio",
  statusOf: { open: "Abierta", won: "Ganada", lost: "Perdida" },
  close: "Cerrar",
  tasksTitle: "Tareas de los contactos del cliente",
  tasksNone: "Los contactos del cliente no tienen tareas.",
  tasksNoPeople: "Esta tarjeta no tiene persona de contacto, así que no hay tareas que mostrar.",
  tasksFailed: "No se pudieron leer las tareas.",
  tasksAll: (n) => `Las ${n} en la página Tareas`,
  tasksOwn: { deal: "Tareas de esta negociación", lead: "Tareas de este prospecto" },
  tasksOwnNone: { deal: "Esta negociación no tiene tareas.", lead: "Este prospecto no tiene tareas." },
  tasksCompany: (company) => `Tareas de ${company}`,
  tasksCompanyNone: "La empresa no tiene tareas, ni en sus proyectos ni en sus negociaciones y prospectos.",
  cancel: "Cancelar",
  readOnlyInstall: (tool) =>
    `Solo lectura: instala ${tool} en la página Herramientas para mover desde aquí las tarjetas de este CRM.`,
  readOnlyUpdate: (tool) =>
    `Solo lectura: actualiza ${tool} en la página Herramientas para mover desde aquí las tarjetas de este CRM.`,
  profileTitle: (tool, account) => `¿Qué perfil de ${tool} cambia ${account}?`,
  profileBody: (tool) =>
    `Hay más de un perfil de ${tool} conectado a esta cuenta. El que elijas mueve sus tarjetas y guarda su ajuste de sincronización hasta que cierres WireCat.`,
  profileNone: (tool) =>
    `Ningún perfil de ${tool} ha sincronizado aún esta cuenta, así que sus tarjetas son de solo lectura. Inicia sesión en la página Herramientas, sincroniza y vuelve a intentarlo.`,
  profileWhy: (why) => `El motivo: ${why}`,
  profileMove: "Usarlo y mover",
  profileNeeded: "Elige primero un perfil.",
  profileUse: "Usar este perfil",
  chooseProfile: "Elegir perfil",
  scopeAs: (profile) => `Con el perfil ${profile}.`,
  scopeWhy: {
    crmCli: "WireCat aún no puede cambiar este ajuste.",
    crmCliMissing: (tool) => `Instala ${tool} en la página Herramientas para cambiarlo.`,
    crmCliOld: (tool) => `Actualiza ${tool} en la página Herramientas para cambiarlo.`,
  },
}

export const clientMessages: Messages<Words> = { en, ru, es }
