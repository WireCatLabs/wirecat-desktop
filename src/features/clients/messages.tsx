// cspell:words Clientes Сделки Лиды Negociaciones Prospectos
import type { Kind } from "@/domain/clients"
import { type Messages, plural } from "@/i18n"

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
  missing: string
  old: (version: string | null, need: string) => string
  goTools: string
  update: string
  readFailed: string
  tryAgain: string
  none: Record<Kind, string>
  noneBody: Record<Kind, string>
  noMatch: string
  clear: string
  more: (n: number) => string
  search: string
  searchHint: string
  owner: string
  nobody: string
  stage: string
  baseStage: string
  account: string
  column: (name: string, n: number) => string
  columnOf: (name: string, shown: number, all: number) => string
  of: (shown: number, all: number) => string
  emptyColumn: string
  readOnly: string
  draggable: string
  dragHint: string
  picked: (ref: string) => string
  place: (column: string, at: number, of: number) => string
  dropped: (ref: string, column: string) => string
  putBack: (ref: string, reason?: string) => string
  readOnlyShort: string
  otherPipeline: string
  notMoved: (reason: string) => string
  scope: string
  scopes: { mine: string; all: string }
  scopeHint: string
  applied: (mode: "mine" | "all") => string
  scopeSaving: string
  scopeFailed: (reason: string) => string
  amount: string
  organization: string
  people: string
  roles: Record<string, string>
  closeDate: string
  closedDate: string
  closedReason: string
  project: string
  statusOf: Record<string, string>
  close: string
  cancel: string
  readOnlyInstall: (tool: string) => string
  readOnlyUpdate: (tool: string) => string
  profileTitle: (tool: string, account: string) => string
  profileBody: (tool: string) => string
  profileNone: (tool: string) => string
  profileWhy: (why: string) => string
  profileMove: string
  profileUse: string
  chooseProfile: string
  scopeAs: (profile: string) => string
  scopeWhy: { crmCli: string; crmCliMissing: (tool: string) => string; crmCliOld: (tool: string) => string }
}

const en: Words = {
  title: "Clients",
  intro:
    "Deals and leads from your CRMs and your own pipelines, by stage. Memo keeps the copy; every account it holds is shown.",
  readAgain: "Read again",
  reading: "Reading…",
  kind: "Show",
  kinds: { deal: "Deals", lead: "Leads" },
  pipeline: "Pipeline",
  ownAccount: "Your own",
  allAccounts: "Every account",
  missing: "The Clients page reads Memo, which is not installed yet.",
  old: (version, need) =>
    `The Clients page needs Memo ${need} or newer${version ? `; this computer has ${version}` : ""}.`,
  goTools: "Open Tools",
  update: "Update Memo",
  readFailed: "Memo could not read the deals.",
  tryAgain: "Try again",
  none: { deal: "No deals yet", lead: "No leads yet" },
  noneBody: {
    deal: "Sync a CRM, or ask an agent to record a deal with memo deals add. They show here by stage.",
    lead: "Sync a CRM, or ask an agent to record a lead with memo leads add. They show here by stage.",
  },
  noMatch: "Nothing on this board matches.",
  clear: "Clear",
  more: (n) => `More match than one read holds: the first ${n} are shown. The counts above each column hold them all.`,
  search: "Search the board",
  searchHint: "Words, owner:, stage:, amount:>=1000",
  owner: "Responsible",
  nobody: "Nobody",
  stage: "Stage",
  baseStage: "Base stage",
  account: "Account",
  column: (name, n) => plural("en", n, { one: `${name}, # card`, other: `${name}, # cards` }),
  columnOf: (name, shown, all) => `${name}, ${shown} of ${all} shown`,
  of: (shown, all) => `${shown} of ${all}`,
  emptyColumn: "Nothing here",
  readOnly:
    "Read only: WireCat cannot run this CRM's own tool yet, so a change would stay on this computer. Change stages in the CRM, then sync.",
  draggable: "movable card",
  dragHint: "Press Space to pick it up, the arrow keys to carry it, Space to drop it, Escape to put it back.",
  picked: (ref) => `Picked up ${ref}.`,
  place: (column, at, of) => `${column}, place ${at} of ${of}.`,
  dropped: (ref, column) => `Dropped ${ref} in ${column}.`,
  putBack: (ref, reason) => (reason ? `${ref} is back where it was: ${reason}` : `${ref} is back where it was.`),
  readOnlyShort: "this CRM's cards change in the CRM.",
  otherPipeline: "a card moves only between the stages of its own pipeline.",
  notMoved: (reason) => `Not moved: ${reason}`,
  scope: "Sync",
  scopes: { mine: "Mine", all: "Everyone's" },
  scopeHint:
    "Changes what WireCat downloads from this CRM. Mine keeps only what is assigned to you or to nobody, and removes the rest from this computer.",
  applied: (mode) => `Last sync downloaded: ${mode === "all" ? "everyone's" : "mine"}.`,
  scopeSaving: "Saving and syncing…",
  scopeFailed: (reason) => `The sync scope did not change: ${reason}`,
  amount: "Amount",
  organization: "Company",
  people: "People",
  roles: { owner: "Responsible", contact: "Contact", "decision-maker": "Decides", influencer: "Influences" },
  closeDate: "Expected to close",
  closedDate: "Closed",
  closedReason: "Why",
  project: "Project",
  statusOf: { open: "Open", won: "Won", lost: "Lost" },
  close: "Close",
  cancel: "Cancel",
  readOnlyInstall: (tool) => `Read only: install ${tool} on the Tools page to move this CRM's cards from here.`,
  readOnlyUpdate: (tool) => `Read only: update ${tool} on the Tools page to move this CRM's cards from here.`,
  profileTitle: (tool, account) => `Which ${tool} profile changes ${account}?`,
  profileBody: (tool) =>
    `More than one ${tool} profile is signed in to this account. The one you choose moves its cards and saves its sync setting until WireCat closes.`,
  profileNone: (tool) =>
    `No ${tool} profile has synced this account yet, so its cards stay read only. Sign in on the Tools page and sync, then try again.`,
  profileWhy: (why) => `Memo says: ${why}`,
  profileMove: "Use it and move",
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
    "Сделки и лиды из ваших CRM и ваших собственных воронок, по стадиям. Копию хранит Memo; показаны все аккаунты, что в ней есть.",
  readAgain: "Прочитать заново",
  reading: "Читаю…",
  kind: "Показать",
  kinds: { deal: "Сделки", lead: "Лиды" },
  pipeline: "Воронка",
  ownAccount: "Ваша собственная",
  allAccounts: "Все аккаунты",
  missing: "Страница «Клиенты» читает Memo, а он ещё не установлен.",
  old: (version, need) =>
    `Странице «Клиенты» нужен Memo ${need} или новее${version ? `; на этом компьютере ${version}` : ""}.`,
  goTools: "Открыть «Инструменты»",
  update: "Обновить Memo",
  readFailed: "Memo не смог прочитать сделки.",
  tryAgain: "Ещё раз",
  none: { deal: "Сделок пока нет", lead: "Лидов пока нет" },
  noneBody: {
    deal: "Синхронизируйте CRM или попросите агента записать сделку командой memo deals add. Они появятся здесь по стадиям.",
    lead: "Синхронизируйте CRM или попросите агента записать лид командой memo leads add. Они появятся здесь по стадиям.",
  },
  noMatch: "На доске ничего не подходит.",
  clear: "Сбросить",
  more: (n) =>
    `Подходит больше, чем помещается в одно чтение: показаны первые ${n}. Числа над колонками учитывают все.`,
  search: "Поиск по доске",
  searchHint: "Слова, owner:, stage:, amount:>=1000",
  owner: "Ответственный",
  nobody: "Никто",
  stage: "Стадия",
  baseStage: "Базовая стадия",
  account: "Аккаунт",
  column: (name, n) =>
    plural("ru", n, { one: `${name}, # карточка`, few: `${name}, # карточки`, other: `${name}, # карточек` }),
  columnOf: (name, shown, all) => `${name}, показано ${shown} из ${all}`,
  of: (shown, all) => `${shown} из ${all}`,
  emptyColumn: "Пусто",
  readOnly:
    "Только чтение: WireCat пока не умеет запускать инструмент этой CRM, и изменение осталось бы только на этом компьютере. Меняйте стадии в CRM, затем синхронизируйте.",
  draggable: "перемещаемая карточка",
  dragHint: "Пробел — взять, стрелки — перенести, пробел — положить, Escape — вернуть на место.",
  picked: (ref) => `${ref} взята.`,
  place: (column, at, of) => `${column}, место ${at} из ${of}.`,
  dropped: (ref, column) => `${ref} перенесена в «${column}».`,
  putBack: (ref, reason) => (reason ? `${ref} вернулась на место: ${reason}` : `${ref} вернулась на место.`),
  readOnlyShort: "карточки этой CRM меняются в самой CRM.",
  otherPipeline: "карточка переходит только между стадиями своей воронки.",
  notMoved: (reason) => `Не перенесено: ${reason}`,
  scope: "Синхронизировать",
  scopes: { mine: "Мои", all: "Все" },
  scopeHint:
    "Меняет, что WireCat скачивает из этой CRM. «Мои» оставляет только назначенное на вас или ни на кого, остальное удаляется с этого компьютера.",
  applied: (mode) => `Последняя синхронизация скачала: ${mode === "all" ? "все" : "мои"}.`,
  scopeSaving: "Сохраняю и синхронизирую…",
  scopeFailed: (reason) => `Охват синхронизации не изменился: ${reason}`,
  amount: "Сумма",
  organization: "Компания",
  people: "Люди",
  roles: { owner: "Ответственный", contact: "Контакт", "decision-maker": "Принимает решение", influencer: "Влияет" },
  closeDate: "Ожидаемое закрытие",
  closedDate: "Закрыта",
  closedReason: "Почему",
  project: "Проект",
  statusOf: { open: "Открыта", won: "Выиграна", lost: "Проиграна" },
  close: "Закрыть",
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
  profileWhy: (why) => `Memo сообщает: ${why}`,
  profileMove: "Выбрать и перенести",
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
    "Negociaciones y prospectos de tus CRM y de tus propios embudos, por etapa. Memo guarda la copia; se muestra cada cuenta que tiene.",
  readAgain: "Leer de nuevo",
  reading: "Leyendo…",
  kind: "Mostrar",
  kinds: { deal: "Negociaciones", lead: "Prospectos" },
  pipeline: "Embudo",
  ownAccount: "El tuyo",
  allAccounts: "Todas las cuentas",
  missing: "La página Clientes lee Memo, que aún no está instalado.",
  old: (version, need) =>
    `La página Clientes necesita Memo ${need} o posterior${version ? `; este ordenador tiene ${version}` : ""}.`,
  goTools: "Abrir Herramientas",
  update: "Actualizar Memo",
  readFailed: "Memo no pudo leer las negociaciones.",
  tryAgain: "Reintentar",
  none: { deal: "Aún no hay negociaciones", lead: "Aún no hay prospectos" },
  noneBody: {
    deal: "Sincroniza un CRM o pide a un agente que registre una negociación con memo deals add. Aparecen aquí por etapa.",
    lead: "Sincroniza un CRM o pide a un agente que registre un prospecto con memo leads add. Aparecen aquí por etapa.",
  },
  noMatch: "Nada del tablero coincide.",
  clear: "Borrar",
  more: (n) =>
    `Coinciden más de los que caben en una lectura: se muestran los primeros ${n}. Los números de cada columna los cuentan todos.`,
  search: "Buscar en el tablero",
  searchHint: "Palabras, owner:, stage:, amount:>=1000",
  owner: "Responsable",
  nobody: "Nadie",
  stage: "Etapa",
  baseStage: "Etapa base",
  account: "Cuenta",
  column: (name, n) => plural("es", n, { one: `${name}, # tarjeta`, other: `${name}, # tarjetas` }),
  columnOf: (name, shown, all) => `${name}, se muestran ${shown} de ${all}`,
  of: (shown, all) => `${shown} de ${all}`,
  emptyColumn: "Nada aquí",
  readOnly:
    "Solo lectura: WireCat aún no puede ejecutar la herramienta de este CRM, así que un cambio se quedaría en este ordenador. Cambia las etapas en el CRM y sincroniza.",
  draggable: "tarjeta movible",
  dragHint: "Espacio para cogerla, las flechas para llevarla, Espacio para soltarla, Escape para devolverla.",
  picked: (ref) => `${ref} cogida.`,
  place: (column, at, of) => `${column}, puesto ${at} de ${of}.`,
  dropped: (ref, column) => `${ref} soltada en ${column}.`,
  putBack: (ref, reason) => (reason ? `${ref} ha vuelto a su sitio: ${reason}` : `${ref} ha vuelto a su sitio.`),
  readOnlyShort: "las tarjetas de este CRM se cambian en el CRM.",
  otherPipeline: "una tarjeta solo pasa entre las etapas de su propio embudo.",
  notMoved: (reason) => `No se movió: ${reason}`,
  scope: "Sincronizar",
  scopes: { mine: "Mías", all: "De todos" },
  scopeHint:
    "Cambia lo que WireCat descarga de este CRM. Mías guarda solo lo asignado a ti o a nadie y borra el resto de este ordenador.",
  applied: (mode) => `La última sincronización descargó: ${mode === "all" ? "de todos" : "mías"}.`,
  scopeSaving: "Guardando y sincronizando…",
  scopeFailed: (reason) => `El alcance de la sincronización no cambió: ${reason}`,
  amount: "Importe",
  organization: "Empresa",
  people: "Personas",
  roles: { owner: "Responsable", contact: "Contacto", "decision-maker": "Decide", influencer: "Influye" },
  closeDate: "Cierre previsto",
  closedDate: "Cerrada",
  closedReason: "Por qué",
  project: "Proyecto",
  statusOf: { open: "Abierta", won: "Ganada", lost: "Perdida" },
  close: "Cerrar",
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
  profileWhy: (why) => `Memo dice: ${why}`,
  profileMove: "Usarlo y mover",
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
