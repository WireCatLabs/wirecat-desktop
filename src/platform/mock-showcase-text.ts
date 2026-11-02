// The made-up content of `?showcase` in each interface language, so a Russian or Spanish screenshot shows no English
// chats. `text` replaces a whole string from the stock mocks (tasks, memory); `names` then replaces names inside the
// rest. "You" in `lines` and `chats` is the owner.

export type ShowcaseLang = "en" | "ru" | "es"

type Text = {
  query: string
  note: string
  you: string
  chats: { title: string; people: string[] }[]
  lines: [chat: number, from: string, text: string][]
  around: string[]
  text: Record<string, string>
  names: [from: string, to: string][]
}

const en: Text = {
  query: "Lisbon",
  note: "searched 18,240 messages in 72 chats",
  you: "You",
  chats: [
    { title: "Lisbon trip", people: ["Ana Ruiz", "Marco Bellini", "You"] },
    { title: "Design crit", people: ["Marco Bellini", "Kai", "You"] },
    { title: "Family", people: ["Jo Park", "You"] },
    { title: "Climbing club", people: ["Lena Vogel", "Kai"] },
  ],
  lines: [
    [0, "Ana Ruiz", "Booked the flat in Alfama for Lisbon, 12–16 May. Check-in after 3 pm"],
    [0, "Marco Bellini", "Flights to Lisbon are cheaper on Thursday, sending the link"],
    [1, "Kai", "Can we move the crit to Monday? I'm back from Lisbon on Sunday night"],
    [0, "You", "Made a shared list for Lisbon: pastéis, Belém, the tram 28 at sunrise"],
    [2, "Jo Park", "Grandma says bring her a tin of sardines from Lisbon 🙂"],
    [3, "Lena Vogel", "Anyone up for Sintra cliffs the weekend after Lisbon?"],
    [0, "Ana Ruiz", "Table for six at a fado place in Lisbon on Friday, 9 pm"],
    [1, "Marco Bellini", "Moodboard is up, half of it is Lisbon tiles, sorry not sorry"],
    [0, "Marco Bellini", "Lisbon card covers the trams and most museums, worth it for three days"],
    [2, "You", "Landing in Lisbon at 14:20, will call when we're at the flat"],
    [3, "Kai", "Found a climbing gym ten minutes from our Lisbon flat"],
    [0, "Ana Ruiz", "Weather for Lisbon looks perfect: 24° and sun all week"],
  ],
  around: [
    "Did anyone find a place yet?",
    "Ana was looking in Alfama",
    "Yes! One sec",
    "Three bedrooms and a terrace with a view",
    "",
    "Perfect, I'll book flights tonight",
    "Who brings the camera?",
    "Me, and the spare battery this time",
    "See you all on Thursday",
  ],
  text: {},
  names: [["Kai Sample", "Kai Sato"]],
}

const ru: Text = {
  query: "Лиссабон",
  note: "просмотрено 18 240 сообщений в 72 чатах",
  you: "Вы",
  chats: [
    { title: "Поездка в Лиссабон", people: ["Анна Руис", "Марко Беллини", "You"] },
    { title: "Дизайн-ревью", people: ["Марко Беллини", "Кай", "You"] },
    { title: "Семья", people: ["Женя Пак", "You"] },
    { title: "Скалолазы", people: ["Лена Фогель", "Кай"] },
  ],
  lines: [
    [0, "Анна Руис", "Забронировала квартиру в Алфаме для Лиссабона, 12–16 мая. Заезд после 15:00"],
    [0, "Марко Беллини", "Билеты в Лиссабон дешевле в четверг, скидываю ссылку"],
    [1, "Кай", "Перенесём ревью на понедельник? Возвращаюсь из Лиссабона в воскресенье вечером"],
    [0, "You", "Сделал общий список для Лиссабона: паштел-де-ната, Белен, трамвай 28 на рассвете"],
    [2, "Женя Пак", "Бабушка просит привезти ей банку сардин из Лиссабона 🙂"],
    [3, "Лена Фогель", "Кто со мной на скалы в Синтре в выходные после Лиссабона?"],
    [0, "Анна Руис", "Столик на шестерых в фаду-баре в Лиссабоне, пятница, 21:00"],
    [1, "Марко Беллини", "Мудборд готов, половина — плитка из Лиссабона, уж простите"],
    [0, "Марко Беллини", "Lisboa Card покрывает трамваи и почти все музеи в Лиссабоне, на три дня окупается"],
    [2, "You", "Приземляюсь в Лиссабоне в 14:20, позвоню, как доберёмся до квартиры"],
    [3, "Кай", "Нашёл скалодром в десяти минутах от нашей квартиры в Лиссабоне"],
    [0, "Анна Руис", "Погода в Лиссабоне идеальная: 24° и солнце всю неделю"],
  ],
  around: [
    "Кто-нибудь уже нашёл жильё?",
    "Анна смотрела в Алфаме",
    "Да! Секунду",
    "Три спальни и терраса с видом",
    "",
    "Отлично, вечером куплю билеты",
    "Кто берёт камеру?",
    "Я, и в этот раз с запасным аккумулятором",
    "До встречи в четверг!",
  ],
  text: {
    "Harbour launch": "Запуск «Гавани»",
    Operations: "Операции",
    Home: "Дом",
    "Send Kai the pricing table with the clinic discount": "Отправить Каю таблицу цен со скидкой для клиник",
    "Book the two pilot clinics for February": "Договориться с двумя пилотными клиниками на февраль",
    "Draft the launch announcement for 2 March": "Написать анонс запуска к 2 марта",
    "Agenda for the Monday call with Kai": "Повестка для звонка с Каем в понедельник",
    "Renew the domain and check the DNS records": "Продлить домен и проверить записи DNS",
    "Compare the two registrars' renewal prices": "Сравнить цены продления у двух регистраторов",
    "Summarise last week's support chats": "Подвести итоги чатов поддержки за прошлую неделю",
    "Call the landlord about the boiler": "Позвонить хозяину квартиры насчёт бойлера",
    "Send the signed NDA back to Kai": "Отправить Каю подписанное NDA",
    "Move the backups to the new disk": "Перенести резервные копии на новый диск",
    "Pick the new backup disk": "Выбрать новый диск для копий",
    "Order the disk": "Заказать диск",
    "Copy the archive onto it": "Скопировать на него архив",
    "Scores below 0.72 on the retrieval suite block a release of the Northbridge ranking model. The threshold was agreed in the 28 October review after the 0.69 run let two broken answers through, and it applies to every model change, including prompt-only ones.":
      "Оценка ниже 0,72 на тестах поиска блокирует релиз модели ранжирования Northbridge. Порог согласовали на ревью 28 октября, после того как прогон с 0,69 пропустил два неверных ответа; он действует для любого изменения модели, даже только в промпте.",
    "Kai Sample prefers calls on Friday afternoons and asks for the agenda the evening before. When a call moves to a Monday he tends to cancel it at the last minute, so propose Friday after 15:00 first and send three or four points by 20:00 the day before.":
      "Кай Сато предпочитает созвоны в пятницу после обеда и просит повестку накануне вечером. Когда звонок переносят на понедельник, он часто отменяет его в последний момент, поэтому сначала предлагайте пятницу после 15:00 и присылайте три-четыре пункта до 20:00 накануне.",
    "Harbour launch moves to 2 March; the pilot with two clinics stays in February.":
      "Запуск «Гавани» переносится на 2 марта; пилот с двумя клиниками остаётся в феврале.",
    "Here is the pricing table I promised, see the second tab. The clinic discount is spelled out per seat for 20 and for 50 seats, and the pilot price holds until the end of February.":
      "Вот обещанная таблица цен, смотри вторую вкладку. Скидка для клиник расписана за место для 20 и 50 мест, а пилотная цена действует до конца февраля.",
    "Reply Kai Sample: Here is the pricing table I promised, see the second tab. The clinic discount is spelled out per…":
      "Ответить Каю Сато: Вот обещанная таблица цен, смотри вторую вкладку. Скидка для клиник расписана за…",
    "Kai asked for the pricing table twice this week.": "Кай дважды за неделю просил таблицу цен.",
    "Ana Ruiz is moving to Valencia in December and is looking for a flat near the old town, two bedrooms, with a budget around 1,400 a month. She asked twice whether you know a landlord there.":
      "Анна Руис в декабре переезжает в Валенсию и ищет квартиру рядом со старым городом: две спальни, бюджет около 1 400 в месяц. Она дважды спрашивала, нет ли у вас там знакомого арендодателя.",
    "Project Harbour this week: the clinics confirmed the February pilot, Lena Ortiz owns the onboarding script, and the open question is who signs the data agreement on the clinics' side. Two calls slipped because the agenda arrived late; Kai wants it the evening before.":
      "Проект «Гавань» на этой неделе: клиники подтвердили февральский пилот, за сценарий онбординга отвечает Лена Ортис, открыт вопрос, кто подписывает соглашение о данных со стороны клиник. Два звонка сорвались из-за поздней повестки; Кай хочет получать её накануне вечером.",
    "You want reminders in the morning, never after 21:00.": "Напоминания — утром и никогда после 21:00.",
    "You promised Kai the pricing table by 4 November.": "Вы обещали Каю таблицу цен к 4 ноября.",
    "Kai Sample prefers Monday morning calls.": "Кай Сато предпочитает созвоны в понедельник утром.",
    "The evaluation set moves from 80 to 120 queries, and 40 of the new ones are in Spanish, because the October run scored Spanish answers 18 points below English ones.":
      "Набор для оценки растёт с 80 до 120 запросов, 40 новых — на испанском: в октябрьском прогоне испанские ответы получили на 18 баллов меньше английских.",
    "Add 40 Spanish queries to the evaluation set before the 12 November review":
      "Добавить 40 испанских запросов в набор для оценки до ревью 12 ноября",
    "Lena Ortiz asked for Spanish coverage in the review thread and nobody took it.":
      "Лена Ортис просила покрыть испанский в ветке ревью, и никто не взялся.",
    "Northbridge Bench runs nightly at 02:00 on the shared runner; a run takes about 40 minutes.":
      "Northbridge Bench запускается каждую ночь в 02:00 на общем раннере; прогон занимает около 40 минут.",
    "Ask Tom Becker for read access to the runner logs": "Попросить у Тома Беккера доступ к логам раннера",
    "Two failed runs last week could not be explained without them.":
      "Два упавших прогона на прошлой неделе без них не объяснить.",
  },
  names: [
    ["Kai Sample", "Кай Сато"],
    ["Ana Ruiz", "Анна Руис"],
    ["Lena Ortiz", "Лена Ортис"],
    ["Tom Becker", "Том Беккер"],
    ["Project Harbour", "Проект «Гавань»"],
  ],
}

const es: Text = {
  query: "Lisboa",
  note: "se buscaron 18.240 mensajes en 72 chats",
  you: "Tú",
  chats: [
    { title: "Viaje a Lisboa", people: ["Ana Ruiz", "Marco Bellini", "You"] },
    { title: "Revisión de diseño", people: ["Marco Bellini", "Kai", "You"] },
    { title: "Familia", people: ["Jo Park", "You"] },
    { title: "Club de escalada", people: ["Lena Vogel", "Kai"] },
  ],
  lines: [
    [0, "Ana Ruiz", "Reservé el piso en Alfama para Lisboa, del 12 al 16 de mayo. Entrada después de las 15:00"],
    [0, "Marco Bellini", "Los vuelos a Lisboa son más baratos el jueves, os paso el enlace"],
    [1, "Kai", "¿Movemos la revisión al lunes? Vuelvo de Lisboa el domingo por la noche"],
    [0, "You", "He hecho una lista compartida para Lisboa: pastéis, Belém, el tranvía 28 al amanecer"],
    [2, "Jo Park", "La abuela pide que le traigas una lata de sardinas de Lisboa 🙂"],
    [3, "Lena Vogel", "¿Alguien se apunta a los acantilados de Sintra el finde después de Lisboa?"],
    [0, "Ana Ruiz", "Mesa para seis en un local de fado en Lisboa el viernes a las 21:00"],
    [1, "Marco Bellini", "El moodboard está listo, la mitad son azulejos de Lisboa, lo siento"],
    [0, "Marco Bellini", "La Lisboa Card cubre los tranvías y casi todos los museos, vale la pena para tres días"],
    [2, "You", "Aterrizo en Lisboa a las 14:20, te llamo cuando lleguemos al piso"],
    [3, "Kai", "He encontrado un rocódromo a diez minutos de nuestro piso en Lisboa"],
    [0, "Ana Ruiz", "El tiempo en Lisboa pinta perfecto: 24° y sol toda la semana"],
  ],
  around: [
    "¿Alguien ha encontrado sitio ya?",
    "Ana estaba mirando en Alfama",
    "¡Sí! Un segundo",
    "Tres habitaciones y una terraza con vistas",
    "",
    "Perfecto, compro los vuelos esta noche",
    "¿Quién trae la cámara?",
    "Yo, y esta vez con batería de repuesto",
    "¡Nos vemos el jueves!",
  ],
  text: {
    "Harbour launch": "Lanzamiento de Harbour",
    Operations: "Operaciones",
    Home: "Casa",
    "Send Kai the pricing table with the clinic discount":
      "Enviar a Kai la tabla de precios con el descuento para clínicas",
    "Book the two pilot clinics for February": "Cerrar las dos clínicas piloto para febrero",
    "Draft the launch announcement for 2 March": "Redactar el anuncio del lanzamiento para el 2 de marzo",
    "Agenda for the Monday call with Kai": "Agenda de la llamada del lunes con Kai",
    "Renew the domain and check the DNS records": "Renovar el dominio y revisar los registros DNS",
    "Compare the two registrars' renewal prices": "Comparar los precios de renovación de los dos registradores",
    "Summarise last week's support chats": "Resumir los chats de soporte de la semana pasada",
    "Call the landlord about the boiler": "Llamar al casero por la caldera",
    "Send the signed NDA back to Kai": "Devolver a Kai el NDA firmado",
    "Move the backups to the new disk": "Mover las copias de seguridad al disco nuevo",
    "Pick the new backup disk": "Elegir el disco nuevo para las copias",
    "Order the disk": "Pedir el disco",
    "Copy the archive onto it": "Copiar el archivo en él",
    "Scores below 0.72 on the retrieval suite block a release of the Northbridge ranking model. The threshold was agreed in the 28 October review after the 0.69 run let two broken answers through, and it applies to every model change, including prompt-only ones.":
      "Una puntuación por debajo de 0,72 en las pruebas de búsqueda bloquea la publicación del modelo de ranking de Northbridge. El umbral se acordó en la revisión del 28 de octubre, después de que la ejecución con 0,69 dejara pasar dos respuestas erróneas, y vale para cualquier cambio del modelo, también los que solo tocan el prompt.",
    "Kai Sample prefers calls on Friday afternoons and asks for the agenda the evening before. When a call moves to a Monday he tends to cancel it at the last minute, so propose Friday after 15:00 first and send three or four points by 20:00 the day before.":
      "Kai Sato prefiere las llamadas los viernes por la tarde y pide la agenda la noche anterior. Cuando una llamada pasa al lunes suele cancelarla en el último momento, así que propón primero el viernes después de las 15:00 y envía tres o cuatro puntos antes de las 20:00 del día anterior.",
    "Harbour launch moves to 2 March; the pilot with two clinics stays in February.":
      "El lanzamiento de Harbour pasa al 2 de marzo; el piloto con dos clínicas sigue en febrero.",
    "Here is the pricing table I promised, see the second tab. The clinic discount is spelled out per seat for 20 and for 50 seats, and the pilot price holds until the end of February.":
      "Aquí tienes la tabla de precios que te prometí, mira la segunda pestaña. El descuento para clínicas va por puesto para 20 y para 50 puestos, y el precio piloto se mantiene hasta finales de febrero.",
    "Reply Kai Sample: Here is the pricing table I promised, see the second tab. The clinic discount is spelled out per…":
      "Responder a Kai Sato: Aquí tienes la tabla de precios que te prometí, mira la segunda pestaña. El descuento…",
    "Kai asked for the pricing table twice this week.": "Kai pidió la tabla de precios dos veces esta semana.",
    "Ana Ruiz is moving to Valencia in December and is looking for a flat near the old town, two bedrooms, with a budget around 1,400 a month. She asked twice whether you know a landlord there.":
      "Ana Ruiz se muda a Valencia en diciembre y busca piso cerca del casco antiguo, de dos habitaciones, con un presupuesto de unos 1.400 al mes. Te ha preguntado dos veces si conoces a algún casero allí.",
    "Project Harbour this week: the clinics confirmed the February pilot, Lena Ortiz owns the onboarding script, and the open question is who signs the data agreement on the clinics' side. Two calls slipped because the agenda arrived late; Kai wants it the evening before.":
      "Proyecto Harbour esta semana: las clínicas confirmaron el piloto de febrero, Lena Ortiz se encarga del guion de bienvenida y falta saber quién firma el acuerdo de datos por parte de las clínicas. Dos llamadas se retrasaron porque la agenda llegó tarde; Kai la quiere la noche anterior.",
    "You want reminders in the morning, never after 21:00.":
      "Quieres los recordatorios por la mañana, nunca después de las 21:00.",
    "You promised Kai the pricing table by 4 November.": "Prometiste a Kai la tabla de precios para el 4 de noviembre.",
    "Kai Sample prefers Monday morning calls.": "Kai Sato prefiere las llamadas los lunes por la mañana.",
    "The evaluation set moves from 80 to 120 queries, and 40 of the new ones are in Spanish, because the October run scored Spanish answers 18 points below English ones.":
      "El conjunto de evaluación pasa de 80 a 120 consultas, y 40 de las nuevas están en español, porque en la ejecución de octubre las respuestas en español sacaron 18 puntos menos que las inglesas.",
    "Add 40 Spanish queries to the evaluation set before the 12 November review":
      "Añadir 40 consultas en español al conjunto de evaluación antes de la revisión del 12 de noviembre",
    "Lena Ortiz asked for Spanish coverage in the review thread and nobody took it.":
      "Lena Ortiz pidió cubrir el español en el hilo de la revisión y nadie se encargó.",
    "Northbridge Bench runs nightly at 02:00 on the shared runner; a run takes about 40 minutes.":
      "Northbridge Bench se ejecuta cada noche a las 02:00 en el runner compartido; cada ejecución tarda unos 40 minutos.",
    "Ask Tom Becker for read access to the runner logs": "Pedir a Tom Becker acceso de lectura a los logs del runner",
    "Two failed runs last week could not be explained without them.":
      "Dos ejecuciones fallidas de la semana pasada no se pudieron explicar sin ellos.",
  },
  names: [
    ["Kai Sample", "Kai Sato"],
    ["Project Harbour", "Proyecto Harbour"],
  ],
}

export const SHOWCASE_TEXT: Record<ShowcaseLang, Text> = { en, ru, es }

/** The interface language as the app resolves it: the saved choice, else the system's first Russian or Spanish. */
export function showcaseLang(): ShowcaseLang {
  let choice: unknown = "system"
  try {
    choice = JSON.parse(localStorage.getItem("wirecat.language") ?? "null")?.state?.choice ?? "system"
  } catch {
    // No storage: the system language decides.
  }
  if (choice === "en" || choice === "ru" || choice === "es") return choice
  for (const tag of globalThis.navigator?.languages ?? []) {
    const base = tag.toLowerCase().split("-")[0]
    if (base === "ru" || base === "es" || base === "en") return base
  }
  return "en"
}
