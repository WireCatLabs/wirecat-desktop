import type { Messages } from "@/i18n"

const en = {
  ended: (service: string, account: string) => `Your ${service} sign-in for ${account} has ended.`,
  why: "Services end a sign-in after a while, when the password changes, or when it is closed on another device. What was already copied stays on this computer.",
  next: "Reconnect to keep it working.",
  keyring: (service: string) =>
    `WireCat could not read your ${service} sign-in from this computer's password store. It is often still closed right after the computer starts.`,
  keyringNext: "Sync again in a minute. Reconnect only if that does not help.",
  reconnect: "Reconnect",
  details: "Details",
}

const ru: typeof en = {
  ended: (service, account) => `Вход в ${service} (${account}) больше не действует.`,
  why: "Сервисы завершают вход спустя какое-то время, после смены пароля или если сеанс закрыли на другом устройстве. Уже скачанное осталось на этом компьютере.",
  next: "Переподключите аккаунт, чтобы он снова работал.",
  keyring: (service) =>
    `WireCat не смог прочитать вход в ${service} из хранилища паролей этого компьютера. Сразу после включения компьютера оно часто ещё закрыто.`,
  keyringNext: "Синхронизируйте снова через минуту. Переподключайте, только если это не поможет.",
  reconnect: "Переподключить",
  details: "Подробнее",
}

const es: typeof en = {
  ended: (service, account) => `Tu sesión de ${service} (${account}) ya no es válida.`,
  why: "Los servicios cierran la sesión pasado un tiempo, al cambiar la contraseña o si se cierra desde otro dispositivo. Lo ya copiado sigue en este ordenador.",
  next: "Vuelve a conectar la cuenta para que siga funcionando.",
  keyring: (service) =>
    `WireCat no pudo leer tu sesión de ${service} del almacén de contraseñas de este ordenador. Justo después de encenderlo suele seguir cerrado.`,
  keyringNext: "Sincroniza de nuevo dentro de un minuto. Vuelve a conectar solo si eso no ayuda.",
  reconnect: "Reconectar",
  details: "Detalles",
}

export const signInLostMessages: Messages<typeof en> = { en, ru, es }
