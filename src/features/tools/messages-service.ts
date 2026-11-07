import type { Messages } from "@/i18n"
import type { BackgroundFaultKind } from "@/platform/bindings"

const en = {
  title: "Background service",
  region: (tool: string) => `${tool} background service`,
  why: (tool: string) => `${tool} gets new messages only while its service runs on this computer.`,
  whyPhone: "Keep your phone online: WhatsApp sends messages to this computer through it.",
  loading: "Reading the service",
  noProfile: "Add an account above to run its service.",
  signInFirst: "Sign in first. The service needs a signed-in account.",
  signIn: "Sign in",
  state: {
    running: "Running",
    connecting: "Running, not connected yet",
    stopped: "Stopped",
    unknown: "Cannot tell right now",
  },
  login: {
    yes: "Starts when you log in",
    no: "Does not start when you log in",
    none: "Not set up to start when you log in",
  },
  phoneOffline:
    "It cannot reach WhatsApp. Open WhatsApp on your phone and check that it is online. This clears by itself once it connects.",
  gaveUpSignedOut: "It stopped because the sign in is no longer valid, and it will not restart by itself.",
  gaveUp: "It stopped because of an error that a restart would not fix. Start it again after checking the logs.",
  start: "Start",
  startKeep: "Start and keep running",
  startLogin: "Start at login",
  stop: "Stop",
  remove: "Stop starting at login",
  checkAgain: "Check again",
  working: {
    keep: "Starting…",
    start: "Starting…",
    stop: "Stopping…",
    uninstall: "Removing…",
  },
  done: {
    keep: (tool: string) => `${tool} now runs in the background and starts when you log in.`,
    start: (tool: string) => `${tool} runs in the background.`,
    stop: "Stopped. It stays stopped until you start it.",
    uninstall: "Removed. It no longer starts when you log in.",
  },
  stopMac: "On macOS a stopped service starts again at the next login. Use “Stop starting at login” to prevent that.",
  fault: {
    managerMissing: {
      text: "This computer's service manager did not answer (systemd on Linux, launchd on macOS). WireCat does not use administrator rights, so it cannot fix that for you.",
      hint: "Log out and back in, then try again. Or run it only for now: it will not start by itself after a restart.",
      action: "Run it for now",
    },
    loginInUse: {
      text: "Another program is already using this account, for example the same tool running in a terminal.",
      hint: "Close that program, then try again.",
      action: "Try again",
    },
    notSignedIn: {
      text: "This account is not signed in, so the service cannot connect.",
      hint: "Sign in, then start the service.",
      action: "Sign in",
    },
    tooOld: {
      text: (tool: string) => `This version of ${tool} has no background service.`,
      hint: "Update it, then come back here.",
      action: (tool: string) => `Update ${tool}`,
    },
    permission: {
      text: "The service file could not be written: this computer did not allow it. WireCat never asks for administrator rights.",
      hint: "Check that your home folder is writable by your account, then try again.",
      action: "Try again",
    },
    other: {
      text: (message: string) => `It did not work: ${message}`,
      hint: "Try again. If it keeps failing, the tool's own message above says why.",
      action: "Try again",
    },
  } satisfies Record<BackgroundFaultKind, { text: unknown; hint: string; action: unknown }>,
}

const ru: typeof en = {
  title: "Фоновая служба",
  region: (tool) => `Фоновая служба ${tool}`,
  why: (tool) => `${tool} получает новые сообщения, только пока на этом компьютере работает его служба.`,
  whyPhone: "Держите телефон в сети: WhatsApp присылает сообщения на этот компьютер через него.",
  loading: "Читаем состояние службы",
  noProfile: "Добавьте аккаунт выше, чтобы запустить его службу.",
  signInFirst: "Сначала войдите. Службе нужен аккаунт со входом.",
  signIn: "Войти",
  state: {
    running: "Работает",
    connecting: "Работает, пока не подключилась",
    stopped: "Остановлена",
    unknown: "Сейчас не удаётся узнать",
  },
  login: {
    yes: "Запускается при входе в систему",
    no: "Не запускается при входе в систему",
    none: "Не настроена на запуск при входе в систему",
  },
  phoneOffline:
    "Не удаётся связаться с WhatsApp. Откройте WhatsApp на телефоне и проверьте, что он в сети. Пройдёт само, когда служба подключится.",
  gaveUpSignedOut: "Она остановилась, потому что вход больше не действует, и сама не перезапустится.",
  gaveUp: "Она остановилась из-за ошибки, которую перезапуск не исправит. Посмотрите логи и запустите снова.",
  start: "Запустить",
  startKeep: "Запустить и оставить работать",
  startLogin: "Запускать при входе",
  stop: "Остановить",
  remove: "Не запускать при входе",
  checkAgain: "Проверить снова",
  working: {
    keep: "Запуск…",
    start: "Запуск…",
    stop: "Остановка…",
    uninstall: "Удаление…",
  },
  done: {
    keep: (tool) => `${tool} теперь работает в фоне и запускается при входе в систему.`,
    start: (tool) => `${tool} работает в фоне.`,
    stop: "Остановлена. Не запустится, пока вы её не запустите.",
    uninstall: "Удалено. Служба больше не запускается при входе.",
  },
  stopMac:
    "В macOS остановленная служба запустится снова при следующем входе. Чтобы этого не было, выберите «Не запускать при входе».",
  fault: {
    managerMissing: {
      text: "Менеджер служб этого компьютера не отвечает (systemd в Linux, launchd в macOS). WireCat не использует права администратора и не может это исправить.",
      hint: "Выйдите из системы и войдите снова, затем повторите. Или запустите службу только сейчас: после перезагрузки она сама не запустится.",
      action: "Запустить сейчас",
    },
    loginInUse: {
      text: "Этот аккаунт уже использует другая программа, например тот же инструмент в терминале.",
      hint: "Закройте её и повторите.",
      action: "Повторить",
    },
    notSignedIn: {
      text: "В этом аккаунте нет входа, поэтому служба не может подключиться.",
      hint: "Войдите, затем запустите службу.",
      action: "Войти",
    },
    tooOld: {
      text: (tool) => `В этой версии ${tool} нет фоновой службы.`,
      hint: "Обновите её и вернитесь сюда.",
      action: (tool) => `Обновить ${tool}`,
    },
    permission: {
      text: "Не удалось записать файл службы: компьютер не разрешил. WireCat никогда не просит прав администратора.",
      hint: "Проверьте, что ваша учётная запись может писать в домашнюю папку, и повторите.",
      action: "Повторить",
    },
    other: {
      text: (message) => `Не получилось: ${message}`,
      hint: "Повторите. Если снова не выйдет, причина в сообщении инструмента выше.",
      action: "Повторить",
    },
  },
}

const es: typeof en = {
  title: "Servicio en segundo plano",
  region: (tool) => `Servicio en segundo plano de ${tool}`,
  why: (tool) => `${tool} recibe mensajes nuevos solo mientras su servicio funciona en este ordenador.`,
  whyPhone: "Mantén el teléfono conectado: WhatsApp envía los mensajes a este ordenador a través de él.",
  loading: "Leyendo el servicio",
  noProfile: "Añade una cuenta arriba para ejecutar su servicio.",
  signInFirst: "Inicia sesión primero. El servicio necesita una cuenta con sesión iniciada.",
  signIn: "Iniciar sesión",
  state: {
    running: "En marcha",
    connecting: "En marcha, aún sin conexión",
    stopped: "Detenido",
    unknown: "Ahora no se puede saber",
  },
  login: {
    yes: "Se inicia al entrar en tu sesión",
    no: "No se inicia al entrar en tu sesión",
    none: "No está configurado para iniciarse al entrar en tu sesión",
  },
  phoneOffline:
    "No llega a WhatsApp. Abre WhatsApp en el teléfono y comprueba que tiene conexión. Se arregla solo cuando conecte.",
  gaveUpSignedOut: "Se detuvo porque el inicio de sesión ya no vale, y no se reiniciará solo.",
  gaveUp: "Se detuvo por un error que un reinicio no arregla. Mira los registros e inícialo de nuevo.",
  start: "Iniciar",
  startKeep: "Iniciar y mantener",
  startLogin: "Iniciar al entrar",
  stop: "Detener",
  remove: "No iniciar al entrar",
  checkAgain: "Comprobar de nuevo",
  working: {
    keep: "Iniciando…",
    start: "Iniciando…",
    stop: "Deteniendo…",
    uninstall: "Quitando…",
  },
  done: {
    keep: (tool) => `${tool} ya funciona en segundo plano y se inicia al entrar en tu sesión.`,
    start: (tool) => `${tool} funciona en segundo plano.`,
    stop: "Detenido. Seguirá detenido hasta que lo inicies.",
    uninstall: "Quitado. Ya no se inicia al entrar en tu sesión.",
  },
  stopMac:
    "En macOS un servicio detenido vuelve a iniciarse en el próximo inicio de sesión. Usa «No iniciar al entrar» para evitarlo.",
  fault: {
    managerMissing: {
      text: "El gestor de servicios de este ordenador no responde (systemd en Linux, launchd en macOS). WireCat no usa permisos de administrador, así que no puede arreglarlo.",
      hint: "Cierra la sesión y vuelve a entrar, y prueba otra vez. O ejecútalo solo por ahora: no se iniciará solo tras reiniciar.",
      action: "Ejecutar por ahora",
    },
    loginInUse: {
      text: "Otro programa ya usa esta cuenta, por ejemplo la misma herramienta en una terminal.",
      hint: "Ciérralo y prueba otra vez.",
      action: "Reintentar",
    },
    notSignedIn: {
      text: "Esta cuenta no tiene sesión iniciada, así que el servicio no puede conectar.",
      hint: "Inicia sesión y luego inicia el servicio.",
      action: "Iniciar sesión",
    },
    tooOld: {
      text: (tool) => `Esta versión de ${tool} no tiene servicio en segundo plano.`,
      hint: "Actualízala y vuelve aquí.",
      action: (tool) => `Actualizar ${tool}`,
    },
    permission: {
      text: "No se pudo escribir el archivo del servicio: el ordenador no lo permitió. WireCat nunca pide permisos de administrador.",
      hint: "Comprueba que tu cuenta puede escribir en tu carpeta personal y prueba otra vez.",
      action: "Reintentar",
    },
    other: {
      text: (message) => `No funcionó: ${message}`,
      hint: "Inténtalo de nuevo. Si sigue fallando, el mensaje de la herramienta de arriba dice por qué.",
      action: "Reintentar",
    },
  },
}

export type ServiceText = typeof en
export const serviceMessages: Messages<typeof en> = { en, ru, es }
