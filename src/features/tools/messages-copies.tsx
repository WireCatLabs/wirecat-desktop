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
  refused: {
    gone: "It is no longer installed there. Check again on the Tools page.",
    runs: "It is the copy WireCat runs, so it stays.",
    manager: "WireCat removes only copies npm or pnpm installed in their own folders.",
    busy: "A sync, sign-in or update of this tool is running, so the copy cannot be removed now. Wait for it to finish, or stop the sync on the tool's row, then try again.",
  },
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
  refused: {
    gone: "Там её уже нет. Проверьте снова на странице «Инструменты».",
    runs: "Это копия, которую запускает WireCat, поэтому она остаётся.",
    manager: "WireCat удаляет только копии, которые npm или pnpm установили в свои папки.",
    busy: "Сейчас идёт синхронизация, вход или обновление этого инструмента, поэтому копию пока нельзя удалить. Дождитесь окончания или остановите синхронизацию в строке инструмента, затем попробуйте снова.",
  },
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
  refused: {
    gone: "Ya no está instalada ahí. Vuelve a comprobarlo en la página Herramientas.",
    runs: "Es la copia que ejecuta WireCat, así que se queda.",
    manager: "WireCat solo elimina copias que npm o pnpm instalaron en sus propias carpetas.",
    busy: "Hay una sincronización, un inicio de sesión o una actualización de esta herramienta en curso, así que la copia no se puede quitar ahora. Espera a que termine o detén la sincronización en la fila de la herramienta, y vuelve a intentarlo.",
  },
  byHand: "Ejecuta el comando tú mismo:",
  tryAgain: "Intentar de nuevo",
  done: "Listo",
  close: "Cerrar",
  showLog: "Ver registro",
  hideLog: "Ocultar registro",
  log: "Registro de salida",
}

export const copiesMessages: Messages<typeof en> = { en, ru, es }
