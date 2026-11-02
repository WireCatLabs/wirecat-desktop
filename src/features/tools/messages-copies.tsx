import type { ReactNode } from "react"
import type { Messages } from "@/i18n"

const en = {
  button: "Remove this copy",
  title: "Remove this copy?",
  removes: (path: ReactNode, version: string, manager: string): ReactNode => (
    <>
      WireCat removes {path} ({version}) with {manager}. The copy WireCat runs stays, and so do your data and sign-ins.
    </>
  ),
  runs: "It runs:",
  keep: "Keep it",
  remove: "Remove",
  removing: "Removing the copy…",
  removed: (path: ReactNode): ReactNode => <>Removed {path}.</>,
  onlyOne: (kept: ReactNode): ReactNode => <>One copy is left, the one WireCat runs: {kept}.</>,
  failed: "The copy was not removed.",
  byHand: "Run the command yourself instead:",
  tryAgain: "Try again",
  done: "Done",
  close: "Close",
  showLog: "Show log",
  hideLog: "Hide log",
  log: "Output log",
}

const ru: typeof en = {
  button: "Удалить эту копию",
  title: "Удалить эту копию?",
  removes: (path, version, manager) => (
    <>
      WireCat удалит {path} ({version}) программой {manager}. Копия, которую запускает WireCat, останется, как и ваши
      данные и входы в аккаунты.
    </>
  ),
  runs: "Команда:",
  keep: "Оставить",
  remove: "Удалить",
  removing: "Удаляем копию…",
  removed: (path) => <>{path} удалена.</>,
  onlyOne: (kept) => <>Осталась одна копия, та, что запускает WireCat: {kept}.</>,
  failed: "Копия не удалена.",
  byHand: "Выполните команду сами:",
  tryAgain: "Попробовать ещё раз",
  done: "Готово",
  close: "Закрыть",
  showLog: "Показать журнал",
  hideLog: "Скрыть журнал",
  log: "Журнал вывода",
}

const es: typeof en = {
  button: "Eliminar esta copia",
  title: "¿Eliminar esta copia?",
  removes: (path, version, manager) => (
    <>
      WireCat elimina {path} ({version}) con {manager}. La copia que ejecuta WireCat se queda, igual que tus datos y tus
      sesiones.
    </>
  ),
  runs: "Ejecuta:",
  keep: "Conservarla",
  remove: "Eliminar",
  removing: "Eliminando la copia…",
  removed: (path) => <>{path} eliminada.</>,
  onlyOne: (kept) => <>Queda una sola copia, la que ejecuta WireCat: {kept}.</>,
  failed: "La copia no se eliminó.",
  byHand: "Ejecuta el comando tú mismo:",
  tryAgain: "Intentar de nuevo",
  done: "Listo",
  close: "Cerrar",
  showLog: "Ver registro",
  hideLog: "Ocultar registro",
  log: "Registro de salida",
}

export const copiesMessages: Messages<typeof en> = { en, ru, es }
