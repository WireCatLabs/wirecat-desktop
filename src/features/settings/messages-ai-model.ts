import type { Messages } from "@/i18n"

/** What a reason's line may name: the provider's host, the model, how long it took, and whether it is Ollama. */
export type Said = { host: string; model: string; ms: number | null; ollama: boolean }

export const CHECK_REASONS = [
  "ai.ok",
  "ai.not-set",
  "ai.key-missing",
  "ai.key-rejected",
  "ai.no-credit",
  "ai.spend-limit",
  "ai.rate-limited",
  "ai.model-unknown",
  "ai.unreachable",
  "ai.bad-answer",
  "ai.provider-error",
  "ai.address-refused",
  "ai.failed",
] as const
export type CheckReason = (typeof CHECK_REASONS)[number]

export const SAVE_REASONS = ["ai.address-refused", "ai.setting-invalid", "ai.owner-only", "local-only.refused"] as const
export type SaveReason = (typeof SAVE_REASONS)[number]

const en = {
  heading: "AI model",
  intro:
    "Instead of your agent (Claude Code, Codex), WireCat can read sources, link chats and do other jobs with an AI model of your choice: Anthropic (Claude), OpenAI (ChatGPT), a service like OpenRouter, or Ollama on this computer. You pay Anthropic, OpenAI or the service for what the model reads. Ollama is free.",
  shared:
    "Linking chats, reply drafts and reading text in attachments (OCR) use this model too, unless a messenger profile sets a model of its own for them.",
  noModel: "No model (use your agent)",
  noModelDetails: "WireCat leaves this work to your agent. A picture you add to memory is kept by its name only.",
  providers: {
    anthropic: "Anthropic (Claude)",
    openai: "OpenAI or compatible",
    ollama: "Ollama on this computer (beta)",
  } as Record<string, string>,
  providerLegend: "Provider",
  baseUrl: "Address (base URL)",
  baseUrlHelp:
    "The address WireCat sends requests to. Leave it empty for OpenAI itself. To use another service that works like OpenAI, paste its address. For OpenRouter, which gives one key for models from many companies, it is https://openrouter.ai/api/v1. Then type the model as OpenRouter names it, for example openai/gpt-4o-mini. Your key is sent only to this address.",
  baseUrlRule: "Use an https address. http works only for a server on this computer, such as LM Studio or Ollama.",
  key: "API key",
  keyHelp: "Kept in your system's password store and never shown again.",
  keyInFile: "This computer has no password store, so the key is kept in a file only your user can read.",
  keyFromEnvironment: "The key comes from an environment variable on this computer.",
  keyNone: "No key is saved yet.",
  keyNotNeeded: "A model on this computer usually needs no key. Paste one only if your server asks for it.",
  keyReplace: "A key is saved. Paste a new one only to replace it.",
  showKey: "Show the key",
  hideKey: "Hide the key",
  model: "Model",
  modelHelp: "Pick from the list, or type a name that is not on it.",
  modelType: "Type the model's name as the provider writes it.",
  listLoading: "Loading the list of models…",
  listNeedsKey: (company: string) =>
    `${company} shows its list of models only with your key, and WireCat cannot ask for it yet. Type the name by hand.`,
  listOtherAddress: "WireCat cannot read the list of models at this address yet. Type the name by hand.",
  listOllamaOff: "Could not read Ollama's list: it is not running. Start it, or type the name by hand.",
  listOllamaEmpty: "Ollama has no models yet. Download one with ollama pull, or type the name by hand.",
  listFailed: "Could not read OpenRouter's list. Check the connection, or type the name by hand.",
  listDocs: (company: string) => `${company} models`,
  ollamaBeta:
    "Beta. Ollama must be running, and the model pulled with ollama pull. Nothing leaves this computer. Use a model that can read pictures, such as llava, if you want it to read them.",
  images: "Read pictures with this model",
  imagesConsent: (host: string, local: boolean) =>
    local
      ? "Pictures you add to memory stay on this computer. The model on it reads the text in them. A model on your computer is usually slower and less accurate than Anthropic's or OpenAI's."
      : `Pictures you add to memory leave this computer and go to ${host}, so the model can read the text in them.`,
  imagesNow: (by: string | null, here: boolean) =>
    by === null
      ? "Now no model reads pictures: each one is kept by its name only."
      : here
        ? `Now ${by}, a model on this computer, reads pictures.`
        : `Now ${by} reads pictures.`,
  imagesChange:
    "A change applies only to pictures you add from now on. Pictures already in memory stay as they are: nothing is deleted and nothing is read again. WireCat keeps their text but not the pictures, so a new model cannot read them.",
  save: "Save",
  saved: "Saved.",
  refused: "The request was refused. Check the provider, the model and the address, then try again.",
  checkFailed: "The check could not run:",
  saveFailed: "The model was not saved:",
  saveReasons: {
    "ai.address-refused": "This address is not allowed. Use https, or http only for a server on this computer.",
    "ai.setting-invalid": "These settings were refused. Check the provider, the model and the address.",
    "ai.owner-only": "Only you can change the AI model, from WireCat or from your own terminal.",
    "local-only.refused":
      "“Only this computer” is on below, so WireCat sends nothing to a model on another computer. Choose a model on this computer, or turn that switch off.",
  } satisfies Record<SaveReason, string>,
  check: "Check",
  checking: "Checking…",
  checkCost: "Sends one short request, billed by your provider. Usually under one cent.",
  checkSaveFirst: "Check works on the saved model. Save your changes first.",
  nothingToSave: "Nothing is changed yet. Change a setting, then save.",
  needModel: "Type the model name first.",
  checkReasons: {
    "ai.ok": (s) => `Works: ${s.model} answered${s.ms === null ? "" : ` in ${s.ms} ms`}.`,
    "ai.not-set": () => "No AI model is set yet.",
    "ai.key-missing": (s) => `No API key saved for ${s.host}.`,
    "ai.key-rejected": (s) => `${s.host} refused the key. Check that it is copied whole and not revoked.`,
    "ai.no-credit": (s) => `The account at ${s.host} has no credit left.`,
    "ai.spend-limit": (s) => `A spending limit at ${s.host} is reached. Raise it in your account there.`,
    "ai.rate-limited": (s) => `${s.host} is busy or the limit is reached. Try again in a minute.`,
    "ai.model-unknown": (s) =>
      s.ollama ? `Run ollama pull ${s.model} first.` : `${s.host} has no model called ${s.model}.`,
    "ai.unreachable": (s) =>
      s.ollama ? "Ollama is not running. Start it, then check again." : `Cannot reach ${s.host}.`,
    "ai.bad-answer": (s) => `${s.host} answered, but not with text. The model may not support chat.`,
    "ai.provider-error": (s) => `${s.host} has a problem on its side. Try again later.`,
    "ai.address-refused": () => "This address is not allowed. Use https, or http only for a server on this computer.",
    "ai.failed": (s) => `${s.host} refused the request.`,
  } as Record<string, (s: Said) => string>,
  checkUnknown:
    "The check failed for a reason WireCat has no words for. Update WireCat from the Help menu, and Memo on the Tools page.",
  turnedOff: "The AI model is off. Your key stays where it is.",
  offFailed: "It was not turned off:",
  summary: (provider: string, model: string) => `In use: ${provider}, ${model}.`,
  looking: "Looking at the AI model…",
  failed: "Could not read the AI model.",
}

const ru: typeof en = {
  heading: "Модель ИИ",
  intro:
    "Вместо вашего агента (Claude Code, Codex) WireCat может читать источники, связывать чаты и делать другую работу с помощью модели ИИ, которую вы выберете: Anthropic (Claude), OpenAI (ChatGPT), сервис вроде OpenRouter или Ollama на этом компьютере. За прочитанное вы платите Anthropic, OpenAI или этому сервису. Ollama бесплатна.",
  shared:
    "Связывание чатов, черновики ответов и чтение текста во вложениях (OCR) тоже идут через эту модель, если в профиле мессенджера для них не задана своя.",
  noModel: "Без модели (использовать агента)",
  noModelDetails:
    "Эту работу WireCat оставляет вашему агенту. Картинка, которую вы добавляете в память, сохраняется только по названию.",
  providers: {
    anthropic: "Anthropic (Claude)",
    openai: "OpenAI или совместимый",
    ollama: "Ollama на этом компьютере (бета)",
  },
  providerLegend: "Провайдер",
  baseUrl: "Адрес (base URL)",
  baseUrlHelp:
    "Адрес, на который WireCat отправляет запросы. Для самого OpenAI оставьте поле пустым. Чтобы подключить другой сервис, который работает как OpenAI, вставьте его адрес. Для OpenRouter (один ключ для моделей многих компаний) это https://openrouter.ai/api/v1. Модель укажите так, как её называет OpenRouter, например openai/gpt-4o-mini. Ключ уходит только на этот адрес.",
  baseUrlRule:
    "Нужен адрес с https. http подходит только для сервера на этом компьютере, например LM Studio или Ollama.",
  key: "API-ключ",
  keyHelp: "Хранится в системном хранилище паролей и больше не показывается.",
  keyInFile:
    "На этом компьютере нет хранилища паролей, поэтому ключ хранится в файле, который может прочитать только ваш пользователь.",
  keyFromEnvironment: "Ключ берётся из переменной окружения на этом компьютере.",
  keyNone: "Ключ пока не сохранён.",
  keyNotNeeded: "Модели на этом компьютере ключ обычно не нужен. Вставьте его, только если ваш сервер его просит.",
  keyReplace: "Ключ сохранён. Вставляйте новый, только если хотите заменить его.",
  showKey: "Показать ключ",
  hideKey: "Скрыть ключ",
  model: "Модель",
  modelHelp: "Выберите из списка или впишите название, которого в нем нет.",
  modelType: "Впишите название модели так, как его пишет провайдер.",
  listLoading: "Загружаем список моделей…",
  listNeedsKey: (company: string) =>
    `${company} показывает список моделей только по вашему ключу, а WireCat пока не умеет его запрашивать. Впишите название вручную.`,
  listOtherAddress: "WireCat пока не умеет читать список моделей по этому адресу. Впишите название вручную.",
  listOllamaOff: "Не удалось прочитать список Ollama: она не запущена. Запустите ее или впишите название вручную.",
  listOllamaEmpty: "В Ollama пока нет моделей. Скачайте модель командой ollama pull или впишите название вручную.",
  listFailed: "Не удалось прочитать список OpenRouter. Проверьте подключение или впишите название вручную.",
  listDocs: (company: string) => `Модели ${company}`,
  ollamaBeta:
    "Бета. Ollama должна быть запущена, а модель скачана командой ollama pull. Ничего не покидает этот компьютер. Чтобы модель читала картинки, возьмите такую, что их понимает, например llava.",
  images: "Распознавать картинки этой моделью",
  imagesConsent: (host: string, local: boolean) =>
    local
      ? "Картинки, которые вы добавляете в память, остаются на этом компьютере. Текст в них читает модель на нем. Модель на компьютере обычно работает медленнее, и точность у нее ниже, чем у Anthropic или OpenAI."
      : `Картинки, которые вы добавляете в память, уходят с этого компьютера на ${host}, чтобы модель прочитала текст в них.`,
  imagesNow: (by: string | null, here: boolean) =>
    by === null
      ? "Сейчас картинки никакая модель не читает: каждая сохраняется только по названию."
      : here
        ? `Сейчас картинки читает ${by}, модель на этом компьютере.`
        : `Сейчас картинки читает ${by}.`,
  imagesChange:
    "Изменение действует только на картинки, которые вы добавите дальше. Картинки, которые уже в памяти, остаются как есть: ничего не удаляется и заново не распознается. WireCat хранит их текст, но не сами картинки, поэтому новая модель прочитать их не сможет.",
  save: "Сохранить",
  saved: "Сохранено.",
  refused: "Запрос отклонён. Проверьте провайдера, модель и адрес и попробуйте снова.",
  checkFailed: "Проверку не удалось выполнить:",
  saveFailed: "Модель не сохранена:",
  saveReasons: {
    "ai.address-refused": "Этот адрес не разрешён. Нужен https, а http только для сервера на этом компьютере.",
    "ai.setting-invalid": "Эти настройки не приняты. Проверьте провайдера, модель и адрес.",
    "ai.owner-only": "Модель ИИ можете менять только вы, из WireCat или из своего терминала.",
    "local-only.refused":
      "Ниже включено «Только этот компьютер», поэтому WireCat ничего не отправляет модели на другом компьютере. Выберите модель на этом компьютере или выключите этот переключатель.",
  },
  check: "Проверить",
  checking: "Проверяем…",
  checkCost: "Отправляет один короткий запрос, его оплачиваете вы у провайдера. Обычно меньше цента.",
  checkSaveFirst: "Проверка работает с сохранённой моделью. Сначала сохраните изменения.",
  nothingToSave: "Пока ничего не изменено. Поменяйте настройку и сохраните.",
  needModel: "Сначала введите имя модели.",
  checkReasons: {
    "ai.ok": (s) => `Работает: ${s.model} ответила${s.ms === null ? "" : ` за ${s.ms} мс`}.`,
    "ai.not-set": () => "Модель ИИ пока не выбрана.",
    "ai.key-missing": (s) => `Для ${s.host} не сохранён ключ API.`,
    "ai.key-rejected": (s) => `${s.host} отклонил ключ. Проверьте, что он скопирован целиком и не отозван.`,
    "ai.no-credit": (s) => `На счёте у ${s.host} закончились деньги.`,
    "ai.spend-limit": (s) => `Достигнут лимит расходов у ${s.host}. Поднимите его в своём аккаунте там.`,
    "ai.rate-limited": (s) => `${s.host} занят или достигнут лимит. Попробуйте через минуту.`,
    "ai.model-unknown": (s) =>
      s.ollama ? `Сначала выполните ollama pull ${s.model}.` : `У ${s.host} нет модели ${s.model}.`,
    "ai.unreachable": (s) =>
      s.ollama ? "Ollama не запущена. Запустите её и проверьте снова." : `Не удаётся связаться с ${s.host}.`,
    "ai.bad-answer": (s) => `${s.host} ответил, но не текстом. Возможно, модель не умеет вести чат.`,
    "ai.provider-error": (s) => `У ${s.host} неполадка на их стороне. Попробуйте позже.`,
    "ai.address-refused": () => "Этот адрес не разрешён. Нужен https, а http только для сервера на этом компьютере.",
    "ai.failed": (s) => `${s.host} отклонил запрос.`,
  },
  checkUnknown:
    "Проверка не удалась по причине, для которой у WireCat нет слов. Обновите WireCat через меню «Справка», а Memo на странице «Инструменты».",
  turnedOff: "Модель ИИ выключена. Ключ остался там, где был.",
  offFailed: "Не удалось выключить:",
  summary: (provider: string, model: string) => `Используется: ${provider}, ${model}.`,
  looking: "Смотрим модель ИИ…",
  failed: "Не удалось прочитать модель ИИ.",
}

const es: typeof en = {
  heading: "Modelo de IA",
  intro:
    "En lugar de tu agente (Claude Code, Codex), WireCat puede leer fuentes, enlazar chats y hacer otras tareas con el modelo de IA que elijas: Anthropic (Claude), OpenAI (ChatGPT), un servicio como OpenRouter u Ollama en este ordenador. Pagas a Anthropic, OpenAI o al servicio por lo que lee el modelo. Ollama es gratis.",
  shared:
    "Enlazar chats, los borradores de respuesta y leer el texto de los adjuntos (OCR) también usan este modelo, salvo que un perfil de mensajería les asigne uno propio.",
  noModel: "Sin modelo (usar tu agente)",
  noModelDetails:
    "WireCat deja este trabajo a tu agente. Una imagen que añades a la memoria se guarda solo por su nombre.",
  providers: {
    anthropic: "Anthropic (Claude)",
    openai: "OpenAI o compatible",
    ollama: "Ollama en este ordenador (beta)",
  },
  providerLegend: "Proveedor",
  baseUrl: "Dirección (base URL)",
  baseUrlHelp:
    "La dirección a la que WireCat envía las peticiones. Déjala vacía para OpenAI. Para otro servicio que funciona como OpenAI, pega su dirección. Para OpenRouter, que da una sola clave para modelos de muchas empresas, es https://openrouter.ai/api/v1. Escribe el modelo como lo llama OpenRouter, por ejemplo openai/gpt-4o-mini. Tu clave solo se envía a esta dirección.",
  baseUrlRule:
    "Usa una dirección https. http solo funciona con un servidor en este ordenador, como LM Studio u Ollama.",
  key: "Clave de API",
  keyHelp: "Se guarda en el almacén de contraseñas del sistema y no se vuelve a mostrar.",
  keyInFile:
    "Este ordenador no tiene almacén de contraseñas, así que la clave se guarda en un archivo que solo tu usuario puede leer.",
  keyFromEnvironment: "La clave viene de una variable de entorno de este ordenador.",
  keyNone: "Aún no hay ninguna clave guardada.",
  keyNotNeeded: "Un modelo en este ordenador no suele necesitar clave. Pega una solo si tu servidor la pide.",
  keyReplace: "Hay una clave guardada. Pega otra solo para reemplazarla.",
  showKey: "Mostrar la clave",
  hideKey: "Ocultar la clave",
  model: "Modelo",
  modelHelp: "Elige de la lista o escribe un nombre que no esté en ella.",
  modelType: "Escribe el nombre del modelo como lo escribe el proveedor.",
  listLoading: "Cargando la lista de modelos…",
  listNeedsKey: (company: string) =>
    `${company} solo muestra su lista de modelos con tu clave, y WireCat aún no sabe pedirla. Escribe el nombre a mano.`,
  listOtherAddress: "WireCat aún no puede leer la lista de modelos en esta dirección. Escribe el nombre a mano.",
  listOllamaOff: "No se pudo leer la lista de Ollama: no está en marcha. Inícialo o escribe el nombre a mano.",
  listOllamaEmpty: "Ollama aún no tiene modelos. Descarga uno con ollama pull o escribe el nombre a mano.",
  listFailed: "No se pudo leer la lista de OpenRouter. Revisa la conexión o escribe el nombre a mano.",
  listDocs: (company: string) => `Modelos de ${company}`,
  ollamaBeta:
    "Beta. Ollama debe estar en marcha y el modelo descargado con ollama pull. Nada sale de este ordenador. Si quieres que lea imágenes, usa un modelo que las entienda, como llava.",
  images: "Leer imágenes con este modelo",
  imagesConsent: (host: string, local: boolean) =>
    local
      ? "Las imágenes que añades a la memoria se quedan en este ordenador. El modelo que corre en él lee el texto que contienen. Un modelo en tu ordenador suele ser más lento y menos preciso que los de Anthropic u OpenAI."
      : `Las imágenes que añades a la memoria salen de este ordenador y van a ${host}, para que el modelo lea el texto que contienen.`,
  imagesNow: (by: string | null, here: boolean) =>
    by === null
      ? "Ahora ningún modelo lee las imágenes: cada una se guarda solo por su nombre."
      : here
        ? `Ahora lee las imágenes ${by}, un modelo en este ordenador.`
        : `Ahora lee las imágenes ${by}.`,
  imagesChange:
    "Un cambio solo afecta a las imágenes que añadas a partir de ahora. Las que ya están en la memoria se quedan como están: no se borra nada ni se vuelve a leer nada. WireCat guarda su texto pero no las imágenes, así que un modelo nuevo no puede leerlas.",
  save: "Guardar",
  saved: "Guardado.",
  refused: "La petición fue rechazada. Revisa el proveedor, el modelo y la dirección y vuelve a intentarlo.",
  checkFailed: "No se pudo hacer la comprobación:",
  saveFailed: "El modelo no se guardó:",
  saveReasons: {
    "ai.address-refused":
      "Esta dirección no está permitida. Usa https, o http solo para un servidor en este ordenador.",
    "ai.setting-invalid": "Estos ajustes fueron rechazados. Revisa el proveedor, el modelo y la dirección.",
    "ai.owner-only": "Solo tú puedes cambiar el modelo de IA, desde WireCat o desde tu propia terminal.",
    "local-only.refused":
      "«Solo este ordenador» está activado abajo, así que WireCat no envía nada a un modelo en otro ordenador. Elige un modelo en este ordenador o desactiva ese interruptor.",
  },
  check: "Comprobar",
  checking: "Comprobando…",
  checkCost: "Envía una petición corta que cobra tu proveedor. Suele costar menos de un céntimo.",
  checkSaveFirst: "La comprobación usa el modelo guardado. Guarda primero tus cambios.",
  nothingToSave: "Aún no has cambiado nada. Cambia un ajuste y guarda.",
  needModel: "Escribe primero el nombre del modelo.",
  checkReasons: {
    "ai.ok": (s) => `Funciona: ${s.model} respondió${s.ms === null ? "" : ` en ${s.ms} ms`}.`,
    "ai.not-set": () => "Aún no hay ningún modelo de IA elegido.",
    "ai.key-missing": (s) => `No hay clave de API guardada para ${s.host}.`,
    "ai.key-rejected": (s) => `${s.host} rechazó la clave. Comprueba que está copiada entera y no revocada.`,
    "ai.no-credit": (s) => `La cuenta en ${s.host} se quedó sin saldo.`,
    "ai.spend-limit": (s) => `Se alcanzó un límite de gasto en ${s.host}. Súbelo en tu cuenta allí.`,
    "ai.rate-limited": (s) => `${s.host} está ocupado o se alcanzó el límite. Inténtalo en un minuto.`,
    "ai.model-unknown": (s) =>
      s.ollama ? `Ejecuta primero ollama pull ${s.model}.` : `${s.host} no tiene ningún modelo llamado ${s.model}.`,
    "ai.unreachable": (s) =>
      s.ollama ? "Ollama no está en marcha. Inícialo y comprueba de nuevo." : `No se puede conectar con ${s.host}.`,
    "ai.bad-answer": (s) => `${s.host} respondió, pero no con texto. Puede que el modelo no admita chat.`,
    "ai.provider-error": (s) => `${s.host} tiene un problema por su parte. Inténtalo más tarde.`,
    "ai.address-refused": () =>
      "Esta dirección no está permitida. Usa https, o http solo para un servidor en este ordenador.",
    "ai.failed": (s) => `${s.host} rechazó la petición.`,
  },
  checkUnknown:
    "La comprobación falló por un motivo para el que WireCat no tiene palabras. Actualiza WireCat desde el menú Ayuda, y Memo en la página Herramientas.",
  turnedOff: "El modelo de IA está desactivado. Tu clave sigue donde estaba.",
  offFailed: "No se desactivó:",
  summary: (provider: string, model: string) => `En uso: ${provider}, ${model}.`,
  looking: "Mirando el modelo de IA…",
  failed: "No se pudo leer el modelo de IA.",
}

export const aiModelMessages: Messages<typeof en> = { en, ru, es }
