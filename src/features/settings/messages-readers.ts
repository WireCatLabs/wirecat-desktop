import type { Messages } from "@/i18n"

const en = {
  heading: "Reading for facts",
  help: "When you add a source to memory, WireCat can suggest facts from it. Choose what reads the text. Nothing reads it until you choose.",
  names: { "claude-code": "Claude Code", codex: "Codex", ollama: "Ollama", key: "Your API key" } as Record<
    string,
    string
  >,
  model: (model: string) => `Model: ${model}`,
  notFound: "Not found on this computer",
  notSignedIn: "Not signed in",
  noKey: "Save a key below to use it",
  leaves: "The text leaves this computer.",
  stays: "The text does not leave this computer.",
  readsFiles: "Codex can also open files on this computer while it reads.",
  looking: "Looking for readers on this computer…",
  failed: "Could not list the readers:",
  tooOld: "Memo on this computer cannot read sources for facts yet. Update it on the Tools page.",
  none: "No reader was found on this computer. Install Claude Code, Codex or Ollama, or save an API key below.",
  chooseFailed: "Your choice was not saved:",
  keyHeading: "API key",
  keyHelp: "WireCat hands the key to the system keyring and never shows it again.",
  provider: "Provider",
  pickProvider: "Choose a provider",
  providers: { openai: "OpenAI", anthropic: "Anthropic" } as Record<string, string>,
  key: "Key",
  showKey: "Show the key",
  hideKey: "Hide the key",
  saveKey: "Save key",
  keySaved: (where: string): string =>
    where === "file" ? "Saved in a protected file: no system keyring answered." : "Saved in the system keyring.",
  keyFailed: "The key was not saved:",
}

const ru: typeof en = {
  heading: "Чтение фактов",
  help: "Когда вы добавляете источник в память, WireCat может предложить из него факты. Выберите, что читает текст. Пока вы не выберете, текст никто не читает.",
  names: { "claude-code": "Claude Code", codex: "Codex", ollama: "Ollama", key: "Ваш ключ API" },
  model: (model: string) => `Модель: ${model}`,
  notFound: "Не найден на этом компьютере",
  notSignedIn: "Вход не выполнен",
  noKey: "Сохраните ключ ниже, чтобы им пользоваться",
  leaves: "Текст уходит с этого компьютера.",
  stays: "Текст не покидает этот компьютер.",
  readsFiles: "Пока Codex читает, он может открывать и файлы на этом компьютере.",
  looking: "Ищем читателей на этом компьютере…",
  failed: "Не удалось получить список читателей:",
  tooOld: "Memo на этом компьютере пока не умеет читать источники ради фактов. Обновите его на странице Инструменты.",
  none: "На этом компьютере не найдено ни одного читателя. Установите Claude Code, Codex или Ollama или сохраните ключ API ниже.",
  chooseFailed: "Ваш выбор не сохранён:",
  keyHeading: "Ключ API",
  keyHelp: "WireCat передаёт ключ в системное хранилище ключей и больше его не показывает.",
  provider: "Провайдер",
  pickProvider: "Выберите провайдера",
  providers: { openai: "OpenAI", anthropic: "Anthropic" },
  key: "Ключ",
  showKey: "Показать ключ",
  hideKey: "Скрыть ключ",
  saveKey: "Сохранить ключ",
  keySaved: (where: string) =>
    where === "file"
      ? "Сохранён в защищённом файле: системное хранилище ключей не ответило."
      : "Сохранён в системном хранилище ключей.",
  keyFailed: "Ключ не сохранён:",
}

const es: typeof en = {
  heading: "Lectura de hechos",
  help: "Cuando añades una fuente a la memoria, WireCat puede proponer hechos de ella. Elige qué lee el texto. Nada lo lee hasta que elijas.",
  names: { "claude-code": "Claude Code", codex: "Codex", ollama: "Ollama", key: "Tu clave de API" },
  model: (model: string) => `Modelo: ${model}`,
  notFound: "No está en este ordenador",
  notSignedIn: "Sin sesión iniciada",
  noKey: "Guarda una clave abajo para usarlo",
  leaves: "El texto sale de este ordenador.",
  stays: "El texto no sale de este ordenador.",
  readsFiles: "Mientras lee, Codex también puede abrir archivos de este ordenador.",
  looking: "Buscando lectores en este ordenador…",
  failed: "No se pudo obtener la lista de lectores:",
  tooOld: "Memo en este ordenador aún no puede leer fuentes para sacar hechos. Actualízalo en la página Herramientas.",
  none: "No se encontró ningún lector en este ordenador. Instala Claude Code, Codex u Ollama, o guarda una clave de API abajo.",
  chooseFailed: "Tu elección no se guardó:",
  keyHeading: "Clave de API",
  keyHelp: "WireCat entrega la clave al llavero del sistema y no la vuelve a mostrar.",
  provider: "Proveedor",
  pickProvider: "Elige un proveedor",
  providers: { openai: "OpenAI", anthropic: "Anthropic" },
  key: "Clave",
  showKey: "Mostrar la clave",
  hideKey: "Ocultar la clave",
  saveKey: "Guardar clave",
  keySaved: (where: string) =>
    where === "file"
      ? "Guardada en un archivo protegido: el llavero del sistema no respondió."
      : "Guardada en el llavero del sistema.",
  keyFailed: "La clave no se guardó:",
}

export const readersMessages: Messages<typeof en> = { en, ru, es }
