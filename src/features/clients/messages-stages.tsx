// cspell:words Воронка Etapas
import type { NameProblem, Refusal } from "@/domain/base-stages"
import type { Kind } from "@/domain/clients"
import { type Messages, plural } from "@/i18n"

type Outcome = "open" | "won" | "lost"

type Words = {
  view: string
  views: { board: string; stages: string }
  unsorted: string
  unsortedEmpty: string
  mapStages: string
  refusal: Record<Refusal | "toUnmapped", string>
  badge: (stage: string, pipeline: string) => string
  suggested: (base: string) => string
  suggestedShort: string
  pickTitle: (base: string) => string
  pickBody: (title: string) => string
  lastPicked: string
  move: string
  cancel: string
  mapIntro: string
  unmapped: string
  unmappedEmpty: string
  noStages: string
  confirm: string
  confirmPipeline: (pipeline: string, n: number) => string
  confirmAll: (n: number) => string
  allConfirmed: string
  backToBoard: string
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
  rename: (name: string) => string
  renameTo: (name: string) => string
  moveLeft: (name: string) => string
  moveRight: (name: string) => string
  remove: (name: string) => string
  keepOne: (outcome: string) => string
  nameProblem: Record<NameProblem, string>
}

const en: Words = {
  view: "View",
  views: { board: "Board", stages: "Stages" },
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
  badge: (stage, pipeline) => `${stage} · ${pipeline}`,
  suggested: (base) => `Suggested: ${base}`,
  suggestedShort: "Suggested",
  pickTitle: (base) => `Which stage of ${base}?`,
  pickBody: (title) => `Several stages of this pipeline belong to this column. Pick the one for ${title}.`,
  lastPicked: "Picked last time",
  move: "Move",
  cancel: "Cancel",
  mapIntro:
    "Your base stages are the columns. Each stage of your pipelines and CRMs is a card: drag it onto the base stage it means. Memo suggested a place for each; confirm the ones that are right.",
  unmapped: "Unmapped",
  unmappedEmpty: "Every stage has a place",
  noStages: "No stage here yet",
  confirm: "Confirm",
  confirmPipeline: (pipeline, n) => `Confirm ${pipeline} (${n})`,
  confirmAll: (n) => plural("en", n, { one: "Confirm all: # stage", other: "Confirm all: # stages" }),
  allConfirmed: "Every suggestion is confirmed.",
  backToBoard: "Back to the board",
  failed: (reason) => `Not saved: ${reason}`,
  stageColumn: (name, n) => plural("en", n, { one: `${name}, # stage`, other: `${name}, # stages` }),
  stageCard: (stage, pipeline) => `${stage}, ${pipeline}`,
  items: (kind, n) =>
    kind === "deal"
      ? plural("en", n, { one: "# deal", other: "# deals" })
      : plural("en", n, { one: "# lead", other: "# leads" }),
  addStage: "Add a stage",
  add: "Add",
  save: "Save",
  name: "Name of the new stage",
  outcome: "Kind of stage",
  outcomes: { open: "Open", won: "Won", lost: "Lost" },
  rename: (name) => `Rename ${name}`,
  renameTo: (name) => `New name for ${name}`,
  moveLeft: (name) => `Move ${name} left`,
  moveRight: (name) => `Move ${name} right`,
  remove: (name) => `Remove ${name}`,
  keepOne: (outcome) => `This is the last "${outcome}" stage; the set keeps one of each kind.`,
  nameProblem: {
    empty: "Give it a name.",
    long: "Use one short line that does not start with a dash.",
    taken: "Another stage has this name.",
  },
}

const ru: Words = {
  view: "Вид",
  views: { board: "Доска", stages: "Стадии" },
  unsorted: "Без стадии",
  unsortedEmpty: "У каждой карточки есть стадия",
  mapStages: "Сопоставить стадии",
  refusal: {
    readOnly: "карточки этой CRM меняются в самой CRM.",
    unsorted: "«Без стадии» — не стадия: перенесите карточку на стадию.",
    unmapped: "ни одна стадия воронки этой карточки пока не относится к этой колонке.",
    unconfirmed: "стадия этой воронки для колонки пока только предложена: сначала подтвердите её.",
    toUnmapped: "стадия переносится на базовую стадию; «Не сопоставлены» — только для тех, у кого её ещё нет.",
  },
  badge: (stage, pipeline) => `${stage} · ${pipeline}`,
  suggested: (base) => `Предложено: ${base}`,
  suggestedShort: "Предложено",
  pickTitle: (base) => `Какая стадия из «${base}»?`,
  pickBody: (title) => `К этой колонке относятся несколько стадий этой воронки. Выберите стадию для «${title}».`,
  lastPicked: "Выбрана в прошлый раз",
  move: "Перенести",
  cancel: "Отмена",
  mapIntro:
    "Колонки — ваши базовые стадии. Каждая стадия ваших воронок и CRM — карточка: перетащите её на базовую стадию, которой она соответствует. Memo предложил место для каждой; подтвердите верные.",
  unmapped: "Не сопоставлены",
  unmappedEmpty: "У каждой стадии есть место",
  noStages: "Здесь пока нет стадий",
  confirm: "Подтвердить",
  confirmPipeline: (pipeline, n) => `Подтвердить «${pipeline}» (${n})`,
  confirmAll: (n) =>
    plural("ru", n, {
      one: "Подтвердить все: # стадию",
      few: "Подтвердить все: # стадии",
      many: "Подтвердить все: # стадий",
      other: "Подтвердить все: # стадии",
    }),
  allConfirmed: "Все предложения подтверждены.",
  backToBoard: "Назад к доске",
  failed: (reason) => `Не сохранено: ${reason}`,
  stageColumn: (name, n) =>
    plural("ru", n, { one: `${name}, # стадия`, few: `${name}, # стадии`, other: `${name}, # стадий` }),
  stageCard: (stage, pipeline) => `${stage}, ${pipeline}`,
  items: (kind, n) =>
    kind === "deal"
      ? plural("ru", n, { one: "# сделка", few: "# сделки", other: "# сделок" })
      : plural("ru", n, { one: "# лид", few: "# лида", other: "# лидов" }),
  addStage: "Добавить стадию",
  add: "Добавить",
  save: "Сохранить",
  name: "Название новой стадии",
  outcome: "Тип стадии",
  outcomes: { open: "Открыта", won: "Выиграна", lost: "Проиграна" },
  rename: (name) => `Переименовать «${name}»`,
  renameTo: (name) => `Новое название для «${name}»`,
  moveLeft: (name) => `Сдвинуть «${name}» влево`,
  moveRight: (name) => `Сдвинуть «${name}» вправо`,
  remove: (name) => `Удалить «${name}»`,
  keepOne: (outcome) => `Это последняя стадия типа «${outcome}»; в наборе остаётся по одной каждого типа.`,
  nameProblem: {
    empty: "Дайте ей название.",
    long: "Одна короткая строка, не с дефиса.",
    taken: "Такое название уже есть у другой стадии.",
  },
}

const es: Words = {
  view: "Vista",
  views: { board: "Tablero", stages: "Etapas" },
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
  badge: (stage, pipeline) => `${stage} · ${pipeline}`,
  suggested: (base) => `Sugerida: ${base}`,
  suggestedShort: "Sugerida",
  pickTitle: (base) => `¿Qué etapa de ${base}?`,
  pickBody: (title) => `Varias etapas de este embudo pertenecen a esta columna. Elige la de ${title}.`,
  lastPicked: "Elegida la última vez",
  move: "Mover",
  cancel: "Cancelar",
  mapIntro:
    "Tus etapas base son las columnas. Cada etapa de tus embudos y CRM es una tarjeta: arrástrala a la etapa base que significa. Memo sugirió un lugar para cada una; confirma las correctas.",
  unmapped: "Sin asignar",
  unmappedEmpty: "Cada etapa tiene su lugar",
  noStages: "Aún no hay etapas aquí",
  confirm: "Confirmar",
  confirmPipeline: (pipeline, n) => `Confirmar ${pipeline} (${n})`,
  confirmAll: (n) => plural("es", n, { one: "Confirmar todo: # etapa", other: "Confirmar todo: # etapas" }),
  allConfirmed: "Todas las sugerencias están confirmadas.",
  backToBoard: "Volver al tablero",
  failed: (reason) => `No se guardó: ${reason}`,
  stageColumn: (name, n) => plural("es", n, { one: `${name}, # etapa`, other: `${name}, # etapas` }),
  stageCard: (stage, pipeline) => `${stage}, ${pipeline}`,
  items: (kind, n) =>
    kind === "deal"
      ? plural("es", n, { one: "# negociación", other: "# negociaciones" })
      : plural("es", n, { one: "# prospecto", other: "# prospectos" }),
  addStage: "Añadir una etapa",
  add: "Añadir",
  save: "Guardar",
  name: "Nombre de la etapa nueva",
  outcome: "Tipo de etapa",
  outcomes: { open: "Abierta", won: "Ganada", lost: "Perdida" },
  rename: (name) => `Renombrar ${name}`,
  renameTo: (name) => `Nuevo nombre para ${name}`,
  moveLeft: (name) => `Mover ${name} a la izquierda`,
  moveRight: (name) => `Mover ${name} a la derecha`,
  remove: (name) => `Quitar ${name}`,
  keepOne: (outcome) => `Es la última etapa «${outcome}»; el conjunto conserva una de cada tipo.`,
  nameProblem: {
    empty: "Ponle un nombre.",
    long: "Una línea corta que no empiece con guion.",
    taken: "Otra etapa ya tiene este nombre.",
  },
}

export const stageMessages: Messages<Words> = { en, ru, es }
