import type { InstallOutcome, InstallSession } from "@/domain/status"
import { type Messages, useMessages } from "@/i18n"
import { type ToolsText, toolsMessages } from "./messages"

type Failed = Extract<InstallOutcome, { event: "failed" }>

const en = {
  disk: "There is not enough free space on this computer.",
  diskHint: "A tool needs about 400 MB while it installs. Free some space, then try again.",
  proxy: "A proxy or security program blocked the connection to npm.",
  proxyHint:
    "At work, a proxy often checks every connection. Ask your IT team for its address and certificate, then run npm config set proxy <address> and npm config set cafile <certificate file>, and try again.",
  longPath: "A file path got longer than Windows allows.",
  longPathHint:
    "Turn on long paths in Windows: Settings, System, For developers, Enable long paths. Then restart WireCat and try again.",
  ownToolBun: "bun installed this tool, and bun cannot be told which registry your own tools come from.",
  ownToolBunHint: "Uninstall it, then add it again with Check package and Add: WireCat installs it with npm.",
  listExpired: "The list of community tools is out of date, so this tool cannot be installed or updated.",
  listExpiredHint:
    "WireCat refreshes the list every day while it runs and is online. Installed community tools keep working.",
  syncing: "This tool is syncing right now, so it can't be updated or removed until the sync ends.",
  syncingHint:
    "The update would replace the program the sync is running. Wait for the sync to finish, or stop it here, then try again.",
  signingIn: "A sign-in to this tool is open, so it can't be updated or removed right now.",
  signingInHint: "Finish or cancel the sign-in, then try again.",
  busy: "This tool is already being installed, updated or removed.",
  busyHint: "Wait for that to finish; its progress shows on the tool's row.",
}

const ru: typeof en = {
  disk: "На компьютере не хватает свободного места.",
  diskHint: "Во время установки инструменту нужно около 400 МБ. Освободите место и попробуйте снова.",
  proxy: "Прокси или антивирус заблокировал подключение к npm.",
  proxyHint:
    "На работе прокси часто проверяет каждое подключение. Узнайте у IT его адрес и сертификат, выполните npm config set proxy <адрес> и npm config set cafile <файл сертификата> и попробуйте снова.",
  longPath: "Путь к файлу вышел длиннее, чем разрешает Windows.",
  longPathHint:
    "Включите длинные пути в Windows: Параметры, Система, Для разработчиков, «Включить длинные пути». Затем перезапустите WireCat и попробуйте снова.",
  ownToolBun: "Этот инструмент установлен через bun, а bun нельзя указать, из какого реестра брать ваши инструменты.",
  ownToolBunHint: "Удалите его и добавьте снова через «Проверить пакет» и «Добавить»: WireCat установит его через npm.",
  listExpired: "Список инструментов сообщества устарел, поэтому этот инструмент нельзя установить или обновить.",
  listExpiredHint:
    "WireCat обновляет список каждый день, пока он запущен и есть интернет. Установленные инструменты сообщества продолжают работать.",
  syncing:
    "Этот инструмент сейчас синхронизируется, поэтому его нельзя обновить или удалить, пока синхронизация не закончится.",
  syncingHint:
    "Обновление заменило бы программу, которую выполняет синхронизация. Дождитесь её окончания или остановите её здесь, затем попробуйте снова.",
  signingIn: "Открыт вход в этот инструмент, поэтому сейчас его нельзя обновить или удалить.",
  signingInHint: "Завершите или отмените вход, затем попробуйте снова.",
  busy: "Этот инструмент уже устанавливается, обновляется или удаляется.",
  busyHint: "Дождитесь окончания: ход видно в строке инструмента.",
}

const es: typeof en = {
  disk: "No hay suficiente espacio libre en este equipo.",
  diskHint: "Una herramienta necesita unos 400 MB mientras se instala. Libera espacio y vuelve a intentarlo.",
  proxy: "Un proxy o un programa de seguridad bloqueó la conexión con npm.",
  proxyHint:
    "En el trabajo, un proxy suele revisar cada conexión. Pide a tu equipo de TI su dirección y su certificado, ejecuta npm config set proxy <dirección> y npm config set cafile <archivo del certificado>, y vuelve a intentarlo.",
  longPath: "Una ruta de archivo superó la longitud que permite Windows.",
  longPathHint:
    "Activa las rutas largas en Windows: Configuración, Sistema, Para programadores, Habilitar rutas largas. Luego reinicia WireCat y vuelve a intentarlo.",
  ownToolBun:
    "Esta herramienta se instaló con bun, y a bun no se le puede indicar de qué registro vienen tus herramientas.",
  ownToolBunHint: "Desinstálala y vuelve a añadirla con «Comprobar paquete» y «Añadir»: WireCat la instala con npm.",
  listExpired:
    "La lista de herramientas de la comunidad está desactualizada, así que esta herramienta no se puede instalar ni actualizar.",
  listExpiredHint:
    "WireCat renueva la lista cada día mientras está abierto y con conexión. Las herramientas de la comunidad instaladas siguen funcionando.",
  syncing:
    "Esta herramienta se está sincronizando, así que no se puede actualizar ni quitar hasta que termine la sincronización.",
  syncingHint:
    "La actualización reemplazaría el programa que ejecuta la sincronización. Espera a que termine o detenla aquí, y vuelve a intentarlo.",
  signingIn: "Hay un inicio de sesión abierto en esta herramienta, así que ahora no se puede actualizar ni quitar.",
  signingInHint: "Termina o cancela el inicio de sesión y vuelve a intentarlo.",
  busy: "Esta herramienta ya se está instalando, actualizando o quitando.",
  busyHint: "Espera a que termine; su progreso se ve en la fila de la herramienta.",
}

const failureMessages: Messages<typeof en> = { en, ru, es }
type Words = ToolsText["install"] & typeof en

/** The words `failureWords` needs, in the interface's language. */
export function useFailureMessages(): Words {
  return { ...useMessages(toolsMessages).install, ...useMessages(failureMessages) }
}

/** What went wrong and what to do about it, in the interface's language where the reason has its own words. */
export function failureWords(
  outcome: Failed,
  operation: InstallSession["operation"],
  m: Words,
): [string, string | null] {
  switch (outcome.reason) {
    case "cancelled":
      return [m.cancelled[operation] ?? outcome.message, null]
    case "timeout":
      return [m.timedOut[operation] ?? outcome.message, m.timedOutHint]
    case "network":
      return [m.network, m.networkHint]
    case "unconfirmed":
      return [m.unconfirmed, m.unconfirmedHint]
    case "disk":
      return [m.disk, m.diskHint]
    case "proxy":
      return [m.proxy, m.proxyHint]
    case "longPath":
      return [m.longPath, m.longPathHint]
    case "ownToolBun":
      return [m.ownToolBun, m.ownToolBunHint]
    case "listExpired":
      return [m.listExpired, m.listExpiredHint]
    case "syncing":
      return [m.syncing, m.syncingHint]
    case "signingIn":
      return [m.signingIn, m.signingInHint]
    case "busy":
      return [m.busy, m.busyHint]
    default:
      return [outcome.message, outcome.hint]
  }
}

/** The same words in English, for a prompt or a report: what the owner saw, in the language agents follow best. */
export function failureWordsEn(outcome: Failed, operation: InstallSession["operation"]): [string, string | null] {
  return failureWords(outcome, operation, { ...toolsMessages.en.install, ...failureMessages.en })
}
