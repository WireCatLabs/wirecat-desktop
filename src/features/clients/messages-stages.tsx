// cspell:words Воронка Etapas
import type { NameProblem, Refusal } from "@/domain/base-stages"
import type { Kind } from "@/domain/clients"
import { type Messages, plural } from "@/i18n"

type Outcome = "open" | "won" | "lost"

type Words = {
  unsorted: string
  unsortedEmpty: string
  mapStages: string
  refusal: Record<Refusal | "toUnmapped", string>
  /** A card whose stage memo only suggested for its column. */
  unconfirmed: string
  confirmCard: (base: string) => string
  pickTitle: (base: string) => string
  pickBody: (title: string) => string
  lastPicked: string
  move: string
  cancel: string
  mapTitle: Record<Kind, string>
  mapWaiting: (n: number) => string
  crm: string
  noCrm: string
  mapIntro: Record<Kind, string>
  unmappedHint: string
  acceptAll: (n: number) => string
  suggested: string
  chooseOther: (stage: string) => string
  confirmTo: (base: string) => string
  unmapped: string
  dropHere: string
  toConfirm: (n: number) => string
  toConfirmBody: string
  confirmStages: string
  allConfirmed: string
  failed: (reason: string) => string
  stageColumn: (name: string, n: number) => string
  stageCard: (stage: string, pipeline: string) => string
  items: (kind: Kind, n: number) => string
  addStage: string
  add: string
  save: string
  name: string
  outcome: string
  outcomes: Record<Outcome, string>
  columnMenu: (name: string) => string
  rename: string
  renameTo: (name: string) => string
  moveLeft: string
  moveRight: string
  remove: string
  keepOne: (outcome: string) => string
  nameProblem: Record<NameProblem, string>
  /** memo's default set, as cli-core names it in each language (`base-stages.ts`, `NAMES`). */
  defaults: { set: string } & Record<Kind, readonly string[]>
}

const en: Words = {
  unsorted: "Unsorted",
  unsortedEmpty: "Every card has a stage",
  mapStages: "Map stages",
  refusal: {
    readOnly: "this CRM's cards change in the CRM.",
    unsorted: "Unsorted is not a stage: drop the card on a stage.",
    unmapped: "no stage of this card's pipeline belongs to this column yet.",
    unconfirmed: "this column's stage for this pipeline is only suggested: confirm it first.",
    toUnmapped: "a stage goes onto a base stage; Unmapped is only for what has none yet.",
  },
  unconfirmed: "Not confirmed",
  confirmCard: (base) => `Suggested for this stage: ${base}. Confirm it in Map stages`,
  pickTitle: (base) => `Which stage of ${base}?`,
  pickBody: (title) => `Several stages of this pipeline belong to this column. Pick the one for ${title}.`,
  lastPicked: "Picked last time",
  move: "Move",
  cancel: "Cancel",
  mapTitle: { deal: "Deal stages of your CRMs", lead: "Lead stages of your CRMs" },
  mapWaiting: (n) => plural("en", n, { one: "Map stages: # stage to sort", other: "Map stages: # stages to sort" }),
  crm: "CRM",
  noCrm: "No CRM is connected yet. Its stages show here after its first sync.",
  mapIntro: {
    deal: "Put each CRM stage on one of your stages, and deals from every CRM line up on one board.",
    lead: "Put each CRM stage on one of your stages, and leads from every CRM line up on one board.",
  },
  unmappedHint: "Accept a suggestion or drag the stage to its column.",
  acceptAll: (n) => `Accept suggestions (${n})`,
  suggested: "Suggested",
  chooseOther: (stage) => `Another stage for ${stage}`,
  confirmTo: (base) => `Confirm: ${base}`,
  unmapped: "Unmapped",
  dropHere: "Drop a stage here",
  toConfirm: (n) =>
    plural("en", n, {
      one: "# CRM stage waits for you to confirm it",
      other: "# CRM stages wait for you to confirm them",
    }),
  toConfirmBody:
    "Each one already has a suggested stage of yours. Their cards already stand there, marked Not confirmed, until you confirm.",
  confirmStages: "Confirm stages",
  allConfirmed: "Every suggestion is confirmed.",
  failed: (reason) => `Not saved: ${reason}`,
  stageColumn: (name, n) => plural("en", n, { one: `${name}, # stage`, other: `${name}, # stages` }),
  stageCard: (stage, pipeline) => `${stage}, ${pipeline}`,
  items: (kind, n) =>
    kind === "deal"
      ? plural("en", n, { one: "# open deal", other: "# open deals" })
      : plural("en", n, { one: "# open lead", other: "# open leads" }),
  addStage: "Add a stage",
  add: "Add",
  save: "Save",
  name: "Name of the new stage",
  outcome: "Kind of stage",
  outcomes: { open: "Open", won: "Won", lost: "Lost" },
  columnMenu: (name) => `${name}: actions`,
  rename: "Rename",
  renameTo: (name) => `New name for ${name}`,
  moveLeft: "Move left",
  moveRight: "Move right",
  remove: "Remove",
  keepOne: (outcome) => `This is the last "${outcome}" stage; the set keeps one of each kind.`,
  nameProblem: {
    empty: "Give it a name.",
    long: "Use one short line that does not start with a dash.",
    taken: "Another stage has this name.",
  },
  defaults: {
    set: "Base stages",
    lead: ["New", "Contacted", "Qualified", "Converted", "Rejected"],
    deal: ["New", "Qualification", "Proposal", "Negotiation", "Won", "Lost"],
  },
}

const ru: Words = {
  unsorted: "Без этапа",
  unsortedEmpty: "У каждой карточки есть этап",
  mapStages: "Этапы CRM",
  refusal: {
    readOnly: "карточки этой CRM меняются в самой CRM.",
    unsorted: "«Без этапа» — не этап: перенесите карточку на этап.",
    unmapped: "ни один этап воронки этой карточки пока не относится к этой колонке.",
    unconfirmed: "этап этой воронки для колонки пока только предложен: сначала подтвердите его.",
    toUnmapped: "этап переносится на один из ваших этапов, а в «Не размечено» лежат только те, у которых его пока нет.",
  },
  unconfirmed: "Не подтверждено",
  confirmCard: (base) => `Для этого этапа предложен «${base}». Подтвердите в «Этапы CRM»`,
  pickTitle: (base) => `Какой этап из «${base}»?`,
  pickBody: (title) => `К этой колонке относятся несколько этапов этой воронки. Выберите этап для «${title}».`,
  lastPicked: "Выбран в прошлый раз",
  move: "Перенести",
  cancel: "Отмена",
  mapTitle: { deal: "Этапы сделок в ваших CRM", lead: "Этапы лидов в ваших CRM" },
  mapWaiting: (n) =>
    plural("ru", n, {
      one: "Этапы CRM: # не размечен",
      few: "Этапы CRM: # не размечены",
      many: "Этапы CRM: # не размечено",
      other: "Этапы CRM: # не размечено",
    }),
  crm: "CRM",
  noCrm: "CRM пока не подключена. Этапы этой CRM появятся здесь после первой синхронизации.",
  mapIntro: {
    deal: "Разложите этапы CRM по своим этапам, и сделки из всех CRM встанут на одну доску.",
    lead: "Разложите этапы CRM по своим этапам, и лиды из всех CRM встанут на одну доску.",
  },
  unmappedHint: "Примите предложение или перетащите этап в нужную колонку.",
  acceptAll: (n) => `Принять предложения (${n})`,
  suggested: "Предложение",
  chooseOther: (stage) => `Другой этап для «${stage}»`,
  confirmTo: (base) => `Подтвердить: ${base}`,
  unmapped: "Не размечено",
  dropHere: "Перетащите сюда этап",
  toConfirm: (n) =>
    plural("ru", n, {
      one: "# этап CRM ждёт вашего подтверждения",
      few: "# этапа CRM ждут вашего подтверждения",
      many: "# этапов CRM ждут вашего подтверждения",
      other: "# этапа CRM ждут вашего подтверждения",
    }),
  toConfirmBody:
    "Для каждого уже предложен один из ваших этапов. Карточки уже стоят там с пометкой «Не подтверждено», пока вы не подтвердите.",
  confirmStages: "Подтвердить этапы",
  allConfirmed: "Все предложения подтверждены.",
  failed: (reason) => `Не сохранено: ${reason}`,
  stageColumn: (name, n) =>
    plural("ru", n, { one: `${name}, # этап`, few: `${name}, # этапа`, other: `${name}, # этапов` }),
  stageCard: (stage, pipeline) => `${stage}, ${pipeline}`,
  items: (kind, n) =>
    kind === "deal"
      ? plural("ru", n, { one: "# открытая сделка", few: "# открытые сделки", other: "# открытых сделок" })
      : plural("ru", n, { one: "# открытый лид", few: "# открытых лида", other: "# открытых лидов" }),
  addStage: "Добавить этап",
  add: "Добавить",
  save: "Сохранить",
  name: "Название нового этапа",
  outcome: "Тип этапа",
  outcomes: { open: "Открыт", won: "Выигран", lost: "Проигран" },
  columnMenu: (name) => `Действия с этапом «${name}»`,
  rename: "Переименовать",
  renameTo: (name) => `Новое название для «${name}»`,
  moveLeft: "Сдвинуть влево",
  moveRight: "Сдвинуть вправо",
  remove: "Удалить",
  keepOne: (outcome) => `Это последний этап типа «${outcome}». В наборе должен быть хотя бы один этап каждого типа.`,
  nameProblem: {
    empty: "Дайте ему название.",
    long: "Одна короткая строка, не с дефиса.",
    taken: "Такое название уже есть у другого этапа.",
  },
  defaults: {
    set: "Базовые стадии",
    lead: ["Новый", "Связались", "Квалифицирован", "Конвертирован", "Отклонён"],
    deal: ["Новая", "Квалификация", "Предложение", "Переговоры", "Выиграна", "Проиграна"],
  },
}

const es: Words = {
  unsorted: "Sin etapa",
  unsortedEmpty: "Cada tarjeta tiene su etapa",
  mapStages: "Asignar etapas",
  refusal: {
    readOnly: "las tarjetas de este CRM se cambian en el CRM.",
    unsorted: "«Sin etapa» no es una etapa: suelta la tarjeta en una etapa.",
    unmapped: "ninguna etapa del embudo de esta tarjeta pertenece aún a esta columna.",
    unconfirmed: "la etapa de este embudo para esta columna solo está sugerida: confírmala primero.",
    toUnmapped: "una etapa va sobre una etapa base; «Sin asignar» es solo para las que aún no tienen.",
  },
  unconfirmed: "Sin confirmar",
  confirmCard: (base) => `Sugerida para esta etapa: ${base}. Confírmala en Asignar etapas`,
  pickTitle: (base) => `¿Qué etapa de ${base}?`,
  pickBody: (title) => `Varias etapas de este embudo pertenecen a esta columna. Elige la de ${title}.`,
  lastPicked: "Elegida la última vez",
  move: "Mover",
  cancel: "Cancelar",
  mapTitle: { deal: "Etapas de negociaciones de tus CRM", lead: "Etapas de prospectos de tus CRM" },
  mapWaiting: (n) => plural("es", n, { one: "Etapas del CRM: # sin asignar", other: "Etapas del CRM: # sin asignar" }),
  crm: "CRM",
  noCrm: "Aún no hay ningún CRM conectado. Sus etapas aparecen aquí tras su primera sincronización.",
  mapIntro: {
    deal: "Coloca cada etapa del CRM en una de tus etapas y las negociaciones de todos tus CRM quedan en un mismo tablero.",
    lead: "Coloca cada etapa del CRM en una de tus etapas y los prospectos de todos tus CRM quedan en un mismo tablero.",
  },
  unmappedHint: "Acepta una sugerencia o arrastra la etapa a su columna.",
  acceptAll: (n) => `Aceptar sugerencias (${n})`,
  suggested: "Sugerencia",
  chooseOther: (stage) => `Otra etapa para ${stage}`,
  confirmTo: (base) => `Confirmar: ${base}`,
  unmapped: "Sin asignar",
  dropHere: "Suelta una etapa aquí",
  toConfirm: (n) =>
    plural("es", n, {
      one: "# etapa del CRM espera tu confirmación",
      other: "# etapas del CRM esperan tu confirmación",
    }),
  toConfirmBody:
    "Cada una ya tiene una de tus etapas sugerida. Sus tarjetas ya están ahí, marcadas Sin confirmar, hasta que confirmes.",
  confirmStages: "Confirmar etapas",
  allConfirmed: "Todas las sugerencias están confirmadas.",
  failed: (reason) => `No se guardó: ${reason}`,
  stageColumn: (name, n) => plural("es", n, { one: `${name}, # etapa`, other: `${name}, # etapas` }),
  stageCard: (stage, pipeline) => `${stage}, ${pipeline}`,
  items: (kind, n) =>
    kind === "deal"
      ? plural("es", n, { one: "# negociación abierta", other: "# negociaciones abiertas" })
      : plural("es", n, { one: "# prospecto abierto", other: "# prospectos abiertos" }),
  addStage: "Añadir una etapa",
  add: "Añadir",
  save: "Guardar",
  name: "Nombre de la etapa nueva",
  outcome: "Tipo de etapa",
  outcomes: { open: "Abierta", won: "Ganada", lost: "Perdida" },
  columnMenu: (name) => `${name}: acciones`,
  rename: "Renombrar",
  renameTo: (name) => `Nuevo nombre para ${name}`,
  moveLeft: "Mover a la izquierda",
  moveRight: "Mover a la derecha",
  remove: "Quitar",
  keepOne: (outcome) => `Es la última etapa «${outcome}»; el conjunto conserva una de cada tipo.`,
  nameProblem: {
    empty: "Ponle un nombre.",
    long: "Una línea corta que no empiece con guion.",
    taken: "Otra etapa ya tiene este nombre.",
  },
  defaults: {
    set: "Etapas base",
    lead: ["Nuevo", "Contactado", "Calificado", "Convertido", "Rechazado"],
    deal: ["Nuevo", "Calificación", "Propuesta", "Negociación", "Ganado", "Perdido"],
  },
}

export const stageMessages: Messages<Words> = { en, ru, es }
