import type { Messages } from "@/i18n"

const en = {
  title: "Account groups",
  intro:
    "Memo reads one group at a time when an agent asks for it, such as memo work search. A card is an account with " +
    "its profiles in each tool. Drag a card to move it to another group; hold Alt or Ctrl while you drop to copy it. " +
    "An account may be in several groups.",
  all: "All",
  allNote: "Every account, always. Memo reads it when no group is named.",
  column: (name: string, n: number) => `${name}, ${n} accounts`,
  empty: "No accounts yet. Drop one here.",
  newEmpty: "Drop an account here: Memo saves the group with its first account.",
  alsoIn: (groups: string) => `Also in ${groups}`,
  inGroups: (groups: string) => `In ${groups}`,
  noProfile: "No profile name",
  actions: (account: string) => `Groups for ${account}`,
  actionsPlaceholder: "Change",
  moveTo: (group: string) => `Move to ${group}`,
  copyTo: (group: string) => `Copy to ${group}`,
  addTo: (group: string) => `Add to ${group}`,
  removeFrom: (group: string) => `Remove from ${group}`,
  copy: "Copy",
  dragHint: "Drag to move it to another group. Hold Alt or Ctrl while you drop to copy it, or use Change.",
  suggested: "Suggested",
  suggestedWhy: (profile: string) => `Its profile is called ${profile}`,
  add: "Add",
  newGroup: "New group",
  newName: "Group name",
  create: "Create",
  nameEmpty: "Type a name.",
  nameReserved: "All and bots already mean something to Memo.",
  nameChars: "Letters, digits, - and _ only, starting with a letter or a digit.",
  nameTaken: "There is a group with this name.",
  moved: (account: string, group: string) => `${account} moved to ${group}`,
  copied: (account: string, group: string) => `${account} copied to ${group}`,
  removed: (account: string, group: string) => `${account} removed from ${group}`,
  putBack: (account: string) => `${account} put back`,
  putBackWhy: (account: string, why: string) => `${account} put back: ${why}`,
  allHoldsEvery: "All always holds every account",
  refused: (message: string) => `Memo did not change the groups: ${message}`,
  unresolved: (entries: string) => `Saved entries that name no account any more: ${entries}`,
  missing: "Install Memo on the Tools page to group accounts.",
  old: (version: string | null) =>
    version
      ? `Memo ${version} has no account groups yet. They arrive with the next Memo update.`
      : "This Memo has no account groups yet. They arrive with the next Memo update.",
  readFailed: "Memo could not list the groups.",
  retry: "Try again",
  dismiss: "Dismiss",
  loading: "Loading account groups",
}

const ru: typeof en = {
  title: "Группы аккаунтов",
  intro:
    "Memo читает одну группу, когда агент её называет, например memo work search. Карточка — это аккаунт с его " +
    "профилями в каждом инструменте. Перетащите карточку, чтобы перенести её в другую группу; удерживайте Alt или " +
    "Ctrl, когда отпускаете, чтобы скопировать. Аккаунт может быть в нескольких группах.",
  all: "Все",
  allNote: "Всегда все аккаунты. Memo читает её, когда группа не названа.",
  column: (name: string, n: number) => `${name}, аккаунтов: ${n}`,
  empty: "Аккаунтов пока нет. Перетащите сюда.",
  newEmpty: "Перетащите сюда аккаунт: Memo сохранит группу с первым аккаунтом.",
  alsoIn: (groups: string) => `Также в ${groups}`,
  inGroups: (groups: string) => `В группах ${groups}`,
  noProfile: "Без имени профиля",
  actions: (account: string) => `Группы аккаунта ${account}`,
  actionsPlaceholder: "Изменить",
  moveTo: (group: string) => `Перенести в ${group}`,
  copyTo: (group: string) => `Скопировать в ${group}`,
  addTo: (group: string) => `Добавить в ${group}`,
  removeFrom: (group: string) => `Убрать из ${group}`,
  copy: "Копия",
  dragHint:
    "Перетащите, чтобы перенести в другую группу. Удерживайте Alt или Ctrl, когда отпускаете, чтобы скопировать, " +
    "или нажмите «Изменить».",
  suggested: "Предложено",
  suggestedWhy: (profile: string) => `Профиль называется ${profile}`,
  add: "Добавить",
  newGroup: "Новая группа",
  newName: "Название группы",
  create: "Создать",
  nameEmpty: "Введите название.",
  nameReserved: "all и bots уже значат другое для Memo.",
  nameChars: "Только латинские буквы, цифры, - и _, в начале буква или цифра.",
  nameTaken: "Группа с таким названием уже есть.",
  moved: (account: string, group: string) => `${account} перенесён в ${group}`,
  copied: (account: string, group: string) => `${account} скопирован в ${group}`,
  removed: (account: string, group: string) => `${account} убран из ${group}`,
  putBack: (account: string) => `${account} возвращён на место`,
  putBackWhy: (account: string, why: string) => `${account} возвращён на место: ${why}`,
  allHoldsEvery: "в «Все» всегда есть каждый аккаунт",
  refused: (message: string) => `Memo не изменил группы: ${message}`,
  unresolved: (entries: string) => `Сохранённые записи, которые больше не называют аккаунт: ${entries}`,
  missing: "Установите Memo на странице «Инструменты», чтобы группировать аккаунты.",
  old: (version: string | null) =>
    version
      ? `В Memo ${version} ещё нет групп аккаунтов. Они появятся со следующим обновлением Memo.`
      : "В этой версии Memo ещё нет групп аккаунтов. Они появятся со следующим обновлением Memo.",
  readFailed: "Memo не смог показать группы.",
  retry: "Повторить",
  dismiss: "Скрыть",
  loading: "Загрузка групп аккаунтов",
}

const es: typeof en = {
  title: "Grupos de cuentas",
  intro:
    "Memo lee un grupo cada vez que un agente lo nombra, como memo work search. Una tarjeta es una cuenta con sus " +
    "perfiles en cada herramienta. Arrastra una tarjeta para moverla a otro grupo; mantén Alt o Ctrl al soltarla " +
    "para copiarla. Una cuenta puede estar en varios grupos.",
  all: "Todas",
  allNote: "Siempre todas las cuentas. Memo lo lee cuando no se nombra ningún grupo.",
  column: (name: string, n: number) => `${name}, ${n} cuentas`,
  empty: "Aún no hay cuentas. Suelta una aquí.",
  newEmpty: "Suelta aquí una cuenta: Memo guarda el grupo con su primera cuenta.",
  alsoIn: (groups: string) => `También en ${groups}`,
  inGroups: (groups: string) => `En ${groups}`,
  noProfile: "Sin nombre de perfil",
  actions: (account: string) => `Grupos de ${account}`,
  actionsPlaceholder: "Cambiar",
  moveTo: (group: string) => `Mover a ${group}`,
  copyTo: (group: string) => `Copiar a ${group}`,
  addTo: (group: string) => `Añadir a ${group}`,
  removeFrom: (group: string) => `Quitar de ${group}`,
  copy: "Copia",
  dragHint: "Arrastra para moverla a otro grupo. Mantén Alt o Ctrl al soltar para copiarla, o usa Cambiar.",
  suggested: "Sugerida",
  suggestedWhy: (profile: string) => `Su perfil se llama ${profile}`,
  add: "Añadir",
  newGroup: "Grupo nuevo",
  newName: "Nombre del grupo",
  create: "Crear",
  nameEmpty: "Escribe un nombre.",
  nameReserved: "all y bots ya significan otra cosa para Memo.",
  nameChars: "Solo letras, dígitos, - y _, empezando por una letra o un dígito.",
  nameTaken: "Ya hay un grupo con este nombre.",
  moved: (account: string, group: string) => `${account} movida a ${group}`,
  copied: (account: string, group: string) => `${account} copiada a ${group}`,
  removed: (account: string, group: string) => `${account} quitada de ${group}`,
  putBack: (account: string) => `${account} vuelve a su sitio`,
  putBackWhy: (account: string, why: string) => `${account} vuelve a su sitio: ${why}`,
  allHoldsEvery: "Todas siempre tiene cada cuenta",
  refused: (message: string) => `Memo no cambió los grupos: ${message}`,
  unresolved: (entries: string) => `Entradas guardadas que ya no nombran ninguna cuenta: ${entries}`,
  missing: "Instala Memo en la página Herramientas para agrupar cuentas.",
  old: (version: string | null) =>
    version
      ? `Memo ${version} aún no tiene grupos de cuentas. Llegan con la próxima actualización de Memo.`
      : "Este Memo aún no tiene grupos de cuentas. Llegan con la próxima actualización de Memo.",
  readFailed: "Memo no pudo listar los grupos.",
  retry: "Reintentar",
  dismiss: "Cerrar",
  loading: "Cargando grupos de cuentas",
}

export const groupsMessages: Messages<typeof en> = { en, ru, es }
