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
  badge: (stage: string, pipeline: string) => string
  suggested: (base: string) => string
  pickTitle: (base: string) => string
  pickBody: (title: string) => string
  lastPicked: string
  move: string
  cancel: string
  mapTitle: Record<Kind, string>
  mapWaiting: (n: number) => string
  crm: string
  noCrm: string
  mapIntro: string
  unmappedHint: string
  suggestion: (base: string) => string
  confirmTo: (base: string) => string
  unmapped: string
  noStages: string
  confirmAll: (n: number) => string
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
  rename: (name: string) => string
  renameTo: (name: string) => string
  moveLeft: (name: string) => string
  moveRight: (name: string) => string
  remove: (name: string) => string
  keepOne: (outcome: string) => string
  nameProblem: Record<NameProblem, string>
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
  badge: (stage, pipeline) => `${stage} · ${pipeline}`,
  suggested: (base) => `Suggested: ${base}`,
  pickTitle: (base) => `Which stage of ${base}?`,
  pickBody: (title) => `Several stages of this pipeline belong to this column. Pick the one for ${title}.`,
  lastPicked: "Picked last time",
  move: "Move",
  cancel: "Cancel",
  mapTitle: { deal: "Deal stages of your CRMs", lead: "Lead stages of your CRMs" },
  mapWaiting: (n) => plural("en", n, { one: "Map stages: # stage to sort", other: "Map stages: # stages to sort" }),
  crm: "CRM",
  noCrm: "No CRM is connected yet. Its stages show here after its first sync.",
  mapIntro:
    "The columns are your base stages. Each stage of this CRM is a badge: drag it onto the base stage it means, or move it with Space and the arrow keys.",
  unmappedHint: "Not placed yet. Confirm memo's suggestion or drag the stage onto its column.",
  suggestion: (base) => `→ ${base}?`,
  confirmTo: (base) => `Confirm: ${base}`,
  unmapped: "Unmapped",
  noStages: "No stage here yet",
  confirmAll: (n) => `Confirm stages (${n})`,
  toConfirm: (n) =>
    plural("en", n, {
      one: "# CRM stage waits for you to confirm it",
      other: "# CRM stages wait for you to confirm them",
    }),
  toConfirmBody: "Memo suggested which of your stages each one is. Until you confirm, their cards stay in Unsorted.",
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
  unsorted: "Без стадии",
  unsortedEmpty: "У каждой карточки есть стадия",
  mapStages: "Стадии CRM",
  refusal: {
    readOnly: "карточки этой CRM меняются в самой CRM.",
    unsorted: "«Без стадии» — не стадия: перенесите карточку на стадию.",
    unmapped: "ни одна стадия воронки этой карточки пока не относится к этой колонке.",
    unconfirmed: "стадия этой воронки для колонки пока только предложена: сначала подтвердите её.",
    toUnmapped: "стадия переносится на базовую стадию; «Не размечено» — только для тех, что ещё не размечены.",
  },
  badge: (stage, pipeline) => `${stage} · ${pipeline}`,
  suggested: (base) => `Предложено: ${base}`,
  pickTitle: (base) => `Какая стадия из «${base}»?`,
  pickBody: (title) => `К этой колонке относятся несколько стадий этой воронки. Выберите стадию для «${title}».`,
  lastPicked: "Выбрана в прошлый раз",
  move: "Перенести",
  cancel: "Отмена",
  mapTitle: { deal: "Стадии сделок в ваших CRM", lead: "Стадии лидов в ваших CRM" },
  mapWaiting: (n) =>
    plural("ru", n, {
      one: "Стадии CRM: # не размечена",
      few: "Стадии CRM: # не размечены",
      many: "Стадии CRM: # не размечено",
      other: "Стадии CRM: # не размечено",
    }),
  crm: "CRM",
  noCrm: "CRM пока не подключена. Её стадии появятся здесь после первой синхронизации.",
  mapIntro:
    "Колонки — ваши базовые стадии. Каждая стадия этой CRM — бейдж: перетащите его на базовую стадию, которой он соответствует, или перенесите пробелом и стрелками.",
  unmappedHint: "Ещё не размечены. Подтвердите предложение Memo или перетащите стадию в её колонку.",
  suggestion: (base) => `→ ${base}?`,
  confirmTo: (base) => `Подтвердить: ${base}`,
  unmapped: "Не размечено",
  noStages: "Здесь пока нет стадий",
  confirmAll: (n) => `Подтвердить стадии (${n})`,
  toConfirm: (n) =>
    plural("ru", n, {
      one: "# стадия CRM ждёт вашего подтверждения",
      few: "# стадии CRM ждут вашего подтверждения",
      many: "# стадий CRM ждут вашего подтверждения",
      other: "# стадии CRM ждут вашего подтверждения",
    }),
  toConfirmBody:
    "Memo предложил, какой из ваших стадий соответствует каждая. Пока вы не подтвердите, их карточки лежат в «Без стадии».",
  confirmStages: "Подтвердить стадии",
  allConfirmed: "Все предложения подтверждены.",
  failed: (reason) => `Не сохранено: ${reason}`,
  stageColumn: (name, n) =>
    plural("ru", n, { one: `${name}, # стадия`, few: `${name}, # стадии`, other: `${name}, # стадий` }),
  stageCard: (stage, pipeline) => `${stage}, ${pipeline}`,
  items: (kind, n) =>
    kind === "deal"
      ? plural("ru", n, { one: "# открытая сделка", few: "# открытые сделки", other: "# открытых сделок" })
      : plural("ru", n, { one: "# открытый лид", few: "# открытых лида", other: "# открытых лидов" }),
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
  pickTitle: (base) => `¿Qué etapa de ${base}?`,
  pickBody: (title) => `Varias etapas de este embudo pertenecen a esta columna. Elige la de ${title}.`,
  lastPicked: "Elegida la última vez",
  move: "Mover",
  cancel: "Cancelar",
  mapTitle: { deal: "Etapas de negociaciones de tus CRM", lead: "Etapas de prospectos de tus CRM" },
  mapWaiting: (n) => plural("es", n, { one: "Etapas del CRM: # sin asignar", other: "Etapas del CRM: # sin asignar" }),
  crm: "CRM",
  noCrm: "Aún no hay ningún CRM conectado. Sus etapas aparecen aquí tras su primera sincronización.",
  mapIntro:
    "Las columnas son tus etapas base. Cada etapa de este CRM es una insignia: arrástrala a la etapa base que significa, o muévela con Espacio y las flechas.",
  unmappedHint: "Aún sin asignar. Confirma la sugerencia de Memo o arrastra la etapa a su columna.",
  suggestion: (base) => `→ ${base}?`,
  confirmTo: (base) => `Confirmar: ${base}`,
  unmapped: "Sin asignar",
  noStages: "Aún no hay etapas aquí",
  confirmAll: (n) => `Confirmar etapas (${n})`,
  toConfirm: (n) =>
    plural("es", n, {
      one: "# etapa del CRM espera tu confirmación",
      other: "# etapas del CRM esperan tu confirmación",
    }),
  toConfirmBody:
    "Memo sugirió a cuál de tus etapas corresponde cada una. Hasta que confirmes, sus tarjetas quedan en «Sin etapa».",
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
