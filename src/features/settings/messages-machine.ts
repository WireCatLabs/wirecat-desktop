import type { Messages } from "@/i18n"

const en = {
  title: "On this computer",
  intro: "What WireCat does by itself. A change applies at once to every signed-in account.",
  welcome: "Three things WireCat can do by itself. Accounts get them once you sign in; Settings changes them later.",
  atLogin: "Start WireCat when you log in",
  atLoginHelp: "WireCat opens by itself after you log in to this computer.",
  atLoginFailed: "Could not change whether WireCat starts when you log in.",
  nightly: "Sync everything on a schedule",
  nightlyHelp:
    "Once a day, every signed-in account syncs all its messages and mail, also while WireCat is closed. Each tool's " +
    "own timer runs it.",
  time: "Time",
  timeInvalid: "Enter a time such as 04:45.",
  live: "Get new messages right away",
  liveHelp:
    "Telegram, MAX and WhatsApp keep their connection open in the background and start when you log in, so new " +
    "messages arrive as they are sent.",
  results: "What was set up",
  job: {
    nightly: (account: string) => `Daily sync of ${account}`,
    live: (account: string) => `${account} in the background`,
  },
  step: {
    working: "Setting up…",
    testing: "Test run: a first full sync. It can take a while.",
    done: "Set up.",
    tested: "Set up. The test run worked.",
    kept: (when: string) => `Kept the schedule you chose for it: ${when}.`,
    testFailed: "The test run failed.",
    failed: "Could not set it up.",
  },
}

const ru: typeof en = {
  title: "На этом компьютере",
  intro: "Что WireCat делает сам. Изменение сразу применяется ко всем аккаунтам, в которые вы вошли.",
  welcome:
    "Три вещи, которые WireCat может делать сам. Аккаунты получат их после входа; изменить это можно потом в Настройках.",
  atLogin: "Запускать WireCat при входе в систему",
  atLoginHelp: "WireCat откроется сам, когда вы войдёте в этот компьютер.",
  atLoginFailed: "Не удалось изменить запуск WireCat при входе в систему.",
  nightly: "Синхронизировать всё по расписанию",
  nightlyHelp:
    "Раз в день каждый аккаунт, в который вы вошли, синхронизирует все сообщения и почту, даже когда WireCat закрыт. " +
    "Запускает это таймер самого инструмента.",
  time: "Время",
  timeInvalid: "Введите время, например 04:45.",
  live: "Получать новые сообщения сразу",
  liveHelp:
    "Telegram, MAX и WhatsApp держат соединение в фоне и запускаются при входе в систему, поэтому новые сообщения " +
    "приходят сразу.",
  results: "Что настроено",
  job: {
    nightly: (account) => `Ежедневная синхронизация ${account}`,
    live: (account) => `${account} в фоне`,
  },
  step: {
    working: "Настраиваю…",
    testing: "Пробный запуск: первая полная синхронизация. Это может занять время.",
    done: "Настроено.",
    tested: "Настроено. Пробный запуск прошёл.",
    kept: (when) => `Оставлено ваше расписание: ${when}.`,
    testFailed: "Пробный запуск не удался.",
    failed: "Не удалось настроить.",
  },
}

const es: typeof en = {
  title: "En este ordenador",
  intro: "Lo que WireCat hace por sí solo. Un cambio se aplica al momento a todas las cuentas con sesión iniciada.",
  welcome:
    "Tres cosas que WireCat puede hacer por sí solo. Las cuentas las reciben al iniciar sesión; luego se cambian en Ajustes.",
  atLogin: "Abrir WireCat al iniciar sesión",
  atLoginHelp: "WireCat se abre solo cuando inicias sesión en este ordenador.",
  atLoginFailed: "No se pudo cambiar si WireCat se abre al iniciar sesión.",
  nightly: "Sincronizar todo con un horario",
  nightlyHelp:
    "Una vez al día, cada cuenta con sesión iniciada sincroniza todos sus mensajes y correos, también con WireCat " +
    "cerrado. Lo ejecuta el temporizador de cada herramienta.",
  time: "Hora",
  timeInvalid: "Escribe una hora, por ejemplo 04:45.",
  live: "Recibir los mensajes nuevos al momento",
  liveHelp:
    "Telegram, MAX y WhatsApp mantienen su conexión abierta en segundo plano y se inician al iniciar sesión, así los " +
    "mensajes nuevos llegan en cuanto se envían.",
  results: "Lo que se configuró",
  job: {
    nightly: (account) => `Sincronización diaria de ${account}`,
    live: (account) => `${account} en segundo plano`,
  },
  step: {
    working: "Configurando…",
    testing: "Prueba: una primera sincronización completa. Puede tardar.",
    done: "Configurado.",
    tested: "Configurado. La prueba funcionó.",
    kept: (when) => `Se mantiene el horario que elegiste: ${when}.`,
    testFailed: "La prueba falló.",
    failed: "No se pudo configurar.",
  },
}

export type MachineText = typeof en
export const machineMessages: Messages<typeof en> = { en, ru, es }
