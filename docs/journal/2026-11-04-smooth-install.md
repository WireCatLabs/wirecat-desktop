# 2026-11-04 — Гладкая установка инструментов (Windows PATH, ошибки навыков, ожидание в онбординге)

Агент: `smooth-install` · ветка: `feat/smooth-install` · начато: `~11:00` Europe/Madrid

---

## 1. Задачи

**TASK-89 · Установка без шероховатостей**
Слава: «after install on windows for some reason codex doesnt find cli» → «let's add this automatically, the experience
should be as smooth as possible, check for other possible issues. also after install I saw errors in skills that path is
not there - too many in 1 place, let's show just 1 and a button to fix it if it broke. Also make sure you check the
installation flow and provide some fallbacks … or provide an actionable hint to user what to do manually not just error.
also during install the cli was installing quite slow on onboarding … how much it will take roughly, show progress in %
… entertain them a bit eg … hints what they can do with wirecat … use impeccable for design».
Статус: сделано в ветке `feat/smooth-install`, на Windows и macOS не проверено.
- Своя папка Node.js и папка `~/.local/bin` (запасной префикс npm) идут в PATH пользователя сами, на всех ОС
  (`src-tauri/src/terminal_path.rs`, `profile.rs`: отдельный блок для папок инструментов); после установки — заметка
  «перезапустите открытые ИИ-приложения и терминалы» и строка для ручного добавления, если оболочка неизвестна.
- Ошибки навыков: одна строка «Новый терминал не находит …» вместо строки на инструмент (Agents) и одно сообщение над
  таблицей вместо ошибки в каждой ячейке (шаг Agents онбординга), с кнопкой Fix (`fix_terminal_path` + повторная проверка).
- Ошибки установки: свои причины `disk`, `proxy`, `longPath` с шагом, что делать; одна автоматическая повторная попытка
  при сетевой ошибке; подсказка теперь видна и в онбординге (раньше только текст ошибки).
- Ожидание: общий процент, полоса по инструментам, примерная оценка времени, советы «Пока ждёте» (листаются сами каждые
  9 с, стоят при наведении, фокусе и reduced motion).

**TASK-91 · Кнопка «Исправить ›» с агентом**
Слава: «On errors I'd add a button Fix > with terminal icon to run agent with a prompt and if impossible fallback to
showing user info with a prompt to copy and instructions on what happened, that agent couldnt be invoked (with
suggestions why) and how to fix the original issue and then a suggestion on how to fix the agent».
Статус: сделано в ветке. Rust пишет промпт в файл (`<app data>/fix-prompts/<ms>.md`, 0600, хранит 20 последних) и
открывает Claude Code, Codex или Gemini CLI в терминале одной фиксированной фразой «прочитай файл …» — текст ошибки в
командную строку не попадает (правило 2; `src-tauri/src/fix_agent.rs`). Панель под ошибкой: кнопки найденных агентов,
причина, если агент не запустился (нет в PATH / терминал не открылся / macOS запретил), и «Сделать самому» с промптом и
советом WireCat. Есть в онбординге, на странице Tools, в общем сообщении навыков (после автоматического Fix) и при
ошибке правки PATH. Claude Code и Codex: начальный промпт подтверждён их `--help`; Gemini CLI не установлен — не
проверено; Windows — не проверено.

**TASK-92 · Повторить установку с нуля, не трогая настоящий tg**
Слава: «let's also try somehow simulate the install again so I can check the onboarding, issues and usability of our
UI. mb remove tg cli (while keeping the keyring entries and database and config etc)». Вместо удаления своего tg —
`bin/try-fresh-install`: отладочная сборка в пустом домашнем каталоге, без Node.js в PATH и без доступа к keyring
(`DBUS_SESSION_BUS_ADDRESS=disabled:`). Настоящие tg, данные, настройки и вход не читаются и не меняются.

**TASK-94 · Второй круг установки: Node, прогресс, общий стор** — шаг «Ваш компьютер» не пускает дальше без Node или
кнопки «Поставлю сам»; распаковка Node с подробностями; верные полосы по каждому CLI; установка видна на следующих шагах и
на странице Tools; на экране «готово» — «другие инструменты можно поставить позже». Статус: влито (merge feat/install-r2), распаковка Node
с процентом по байтам архива, новый шаг «Add to PATH», `?node=slow`. Rust проверен после слияния (346 тестов, clippy).

**TASK-95 · Шаг «Подключить агентов» (навыки)** — проще текст без колонок, крупнее; Continue блёклая до первого навыка;
кнопки установки фиолетовые; «Установить всем» для CLI; починить определение агентов (BUG-62); выпадающий список агента у
«Copy prompt» запускает терминал с этим агентом (BUG-63). Статус: влито e6cfb2c. BUG-62: детект был верен; таблица делала колонку на каждую папку навыков, а Cursor
читает обе (`skillColumns` в src/domain/skills.ts). `fix_with_agent` → `run_agent` (agent_run.rs), общий для Fix и гайдов.
После слияния: 698 тестов vitest, 346 Rust, clippy чисто; собрана отладочная сборка для `bin/try-fresh-install`.

**TASK-96 · Вход в Telegram** — шаги создания app с двумя скриншотами, копирование api_id/api_hash, иконка копирования у
ссылки my.telegram.org, понятное предупреждение о keyring, разбор API_ID_INVALID и типичных ошибок с кнопкой «ввести
заново», заметка про пароль 2FA. Статус: в работе (подагент).

**TASK-97 · Скриншоты my.telegram.org и привязки устройства в cli-docs и tg-cli** — с вкладками iOS/Android; личные данные
закрыть (SEC-114). Статус: в работе (подагент).
- **2026-11-04:** готово, не запушено. tg-cli `.claude/worktrees/tg-app-docs` 6a09711 (docs/sessions.md + 7 PNG); cli-docs
  `.claude/worktrees/tg-app-docs` 9311897f (translations/pages/tg/installation.{en,es,ru}.md, вкладки iOS/Android, `#q-scan`).
  Путь на iOS (Settings › Devices › Link Desktop Device) подтверждён только частично; сборка сайта не запускалась.

**TASK-98 · Аудит фронтенда** — слои, модульность, библиотека компонентов, тесты; рефакторинг после покрытия тестами.
Статус: аудит в работе (подагент), рефакторинг отдельным PR после отчёта.

**TASK-99 · После первого гайда — выбор, что делать дальше** — Слава: «after first guide would be nice to have options of
what to do eg check next guide etc». Вместе с NEED-2187 (экран «как WireCat работает с агентом») после слияния TASK-94/95.

**TASK-96 итог (2026-11-04):** feat/tg-signin 33db891, 0fbad56. Реальный порядок: tg открывает my.telegram.org, спрашивает
api_id, api_hash, затем QR или телефон+код, затем пароль 2FA. Ошибки Telegram с причиной и кнопкой назад
(src/domain/telegram-signin.ts), заметка keyring (src/domain/signin-notes.ts), картинки в src/assets/signin. 687 тестов
vitest. Текст про пароль поправлен: Telegram получает доказательство, не сам пароль. Хэш на картинке закрашен (2084b2f, проверил картинку); в feat/smooth-install влито одним коммитом 5850bf2, чтобы старая
картинка не попала в историю; ветку feat/tg-signin не пушить, удалить (CLEANUP.md). 221 тест signin+domain после слияния.

**TASK-100 · Оболочка пользователя по-настоящему** — SHELL, затем оболочка учётной записи (/etc/passwd, на macOS dscl),
затем /bin/sh; флаги проверки под каждую оболочку. Подагент, ветка fix/user-shell. **Влито 51140e5**, 349 тестов Rust; fish и macOS не запускались.

**TASK-101 · Отчёт об архитектуре и правила для ИИ** — **готово:** be623db (сравнение), b254072 (отчёт + 8 гайдов + раздел
в CLAUDE.md). Предложено сверх 2 и 3: Playwright smoke + axe, бюджет размера бандла, порог покрытия только domain, Ladle
для ui/; не нужно: Storybook, снимки, визуальная регрессия в CI, роутер. — docs/dev/architecture-report.md, docs/dev/guides/*.md (new-screen,
new-component, application-logic, rust-command, testing, i18n, release, reuse), ссылка из CLAUDE.md. Сравнение UI-библиотек
(с shadcn, Tailwind, React Aria, Radix, Base UI, Ark, Mantine, HeroUI) — docs/dev/ui-libraries.md. Подагенты.

**TASK-102 · Тесты на весь первый запуск и установку** — **влито** (merge test/onboarding-install): 51 новый тест,
src/domain/onboarding-flow.ts, src/testing/onboarding.tsx; 753 теста, 3 прогона подряд без сбоев. — Слава: «cover the onboarding and install steps with tests so we
dont get regression there - this is critical». Подагент, ветка test/onboarding-install. Чистка диска /home по просьбе
Славы («you free - find merged worktrees/branches, npm and other build caches etc») — подагент, журнал удалений в CLEANUP.md.
NEED-2189 — Слава думает, спросить снова после сравнения.

**TASK-103 · PATH во все оболочки пользователя, выбор оболочки, понятная ошибка** — Слава: «I dont think we should rely on
shell that started the desktop app, more on the user shell, I'd maybe add to path in multiple shell profile files? not sure.
And mb allow the user to pick the shell if the adding to path didnt work? if still fails show actionable message».
Подагент, ветка feat/shell-profiles. **Влито**: оболочка терминала = выбранная в приложении → оболочка учётной
записи → $SHELL → /bin/sh; блок в файл оболочки терминала (создаётся) и в существующие файлы других установленных bash/zsh/fish;
дубль папки убран; после неудачи — выбор оболочки (`terminal_shells`, `use_terminal_shell`), затем строка+файл и Fix ›.
764 теста vitest, 363 Rust. На настоящих оболочках, macOS, fish, Windows не проверено.

## 2. Вопросы Славы

**ASK-56 · «can you give quick prompt to codex to try to find the tg cli location»**
Дан промпт только на чтение: `Get-Command`/`where.exe tg`, `npm prefix -g`, поиск `tg*` в
`%LOCALAPPDATA%\dev.wirecat.desktop\node\*`, `%APPDATA%\npm`, `%LOCALAPPDATA%\pnpm`, `%ProgramFiles%\nodejs`, сравнение
PATH процесса и сохранённого PATH пользователя.

**ASK-57 · «they are using 0.3.0 is this correct?»**
Да. В 0.3.0 приложение ставит свой Node и инструменты в `%LOCALAPPDATA%\dev.wirecat.desktop\node\v<версия>\` и пишет эту
папку в PATH пользователя только по кнопке «Add to PATH» (FIND-196). Слава: «there is no System page in wirecat».

**ASK-58 · «desktop prompted me to install node.js, I clicked the button. after I installed tg cli I saw the warning that there are 2 cli versions installed, why?»**
Точно не знаю — нужны два пути из предупреждения (FIND-198). На Windows поиск находит в каждой папке только `tg.cmd`
(`which` 8.0.6: файл без расширения проходит лишь через `GetBinaryTypeW`, скрипт npm его не проходит), значит копии в
двух разных папках. Вероятные причины в FIND-198.

**ASK-59 · «btw is our fronted good? modular, best practices, correct layers and libraries installed - it needs to be
ready for the heavy extension»** — ответ после аудита (TASK-98).
- **Ответ (2026-11-04, аудит подагента, выборочно проверен):** основа хорошая (правила слоёв в biome.json соблюдены, 0 нарушений;
  граница с Rust проверяется valibot; тесты ищут по ролям, без снимков), но к тяжёлому расширению не готова: DEBT-14, DEBT-15,
  RISK-97, PERF-4. План: страховочные тесты → запрет глубоких импортов между фичами → разрыв циклов → примитивы ui/ →
  дробление больших файлов → api.ts на фичу → ленивые страницы и мок вне сборки. Отдельный PR после #93.

**ASK-60 · «why radix exactly? and are there any alternatives? ... do we just need a UI library? what about storage, caching,
other layers. and what about rust backend ... I still have no idea how it works»** — ответ в чате 2026-11-04: схема
работы, сравнение React Aria / Radix / Base UI / Ark, слои данных и Rust; решение — NEED-2189 переформулирован.

**ASK-61 · «but shall we use bash? I think we need to identify user's default shell eg zsh, fish etc and adjust
accordingly, falling back to smth»** — уже берём оболочку из SHELL (profile.rs, paths.rs), bash был только тем случаем, где
флаги отличаются. Пробел: без SHELL падаем в sh — TASK-100 добавляет оболочку учётной записи.

## 3. Находки

**FIND-196 · Инструменты из своего Node приложения не видны терминалам и агентам**
На теге v0.3.0 `profile::add` (папка в `HKCU\Environment\Path`) вызывается только по кнопке «Add to PATH»
(`src/features/system/ManagedNode.tsx:61`, `src-tauri/src/lib.rs:120`). Приложение само видит `tg`, Codex — нет.
Прочитано в коде; на Windows-машине пользователя не проверено.

**FIND-197 · Автодобавление в PATH на Windows уже есть в main, но вышло после 0.3.0**
`lib.rs` после установки Node и `npm_prefix::keep_tools_on_windows_path` при запуске пишут папки в
`HKCU\Environment\Path` — 35 коммитов после тега v0.3.0, не выпущено. Пользователь 0.3.0 этого не получил.

**BUG-60 · Шаг Agents онбординга показывал одинаковую ошибку в каждой ячейке**
`AgentsMatrix.tsx`: ошибка `skillStatus` одного инструмента ставила `failed` во все его колонки, и каждая ячейка
рисовала свой красный блок — 10 одинаковых сообщений на экране (6 инструментов × 2 колонки). Исправлено: одно
сообщение над таблицей с Fix. Точный текст ошибки у пользователя не видели (см. NEED-2185).

**BUG-61 · PATH терминала запоминался на весь запуск приложения**
`paths::login_shell` был `OnceLock`: после правки `.zshrc` проверка «видит ли терминал инструмент» отвечала по старому
PATH до перезапуска приложения, и Fix выглядел бы неработающим. Теперь кэш сбрасывается после каждой правки профиля
(`paths::forget_login_shell`). Проверено тестом мока, не на настоящем `.zshrc`.

**UX-59 · В онбординге ошибка установки была без подсказки, что делать**
`steps.tsx` показывал только `message`; `hint` из Rust был виден лишь на странице Tools. Общая функция
`tools/failure-words.ts` теперь у обоих мест.

**PERF-3 · Установка tg холодным кешем — около 24 с, из них ~20 с скачивание**
Linux, npm 11.17, node 24.19, @wirecat/tg-cli 0.115.0, чистый префикс: `npm view` 1.3 с, `npm audit signatures`
2.4 с, два GET проверки происхождения 0.85 + 0.55 с, `npm install` холодный 23.8 с (288 пакетов, 323 МБ, 545
запросов), тёплый 2.9 с; `--prefer-offline` не помогает. Самые тяжёлые: echarts 62 МБ, @wirecat 49 МБ, @anthropic-ai
24 МБ, @mtcute 23 МБ, sherpa-onnx 15 МБ. На Windows не мерили — там антивирус проверяет каждый файл, вероятно дольше.

**IDEA-23 · Ускорить установку**
(a) проверку происхождения запускать вместе с `npm view`, а два GET — параллельно (~1 с); (b) `npm cache add` для
следующего инструмента, пока ставится текущий; (c) в tg-cli сделать echarts и sherpa-onnx необязательными —
минус около трети размера; (d) не спрашивать `npm view`, когда версия уже известна со страницы Tools.

**RISK-96 · Правка PATH на macOS и Windows не проверена на настоящей машине**
Unix-ветка покрыта тестами чистых функций, запись в реестр Windows и `.zshrc` на macOS не запускались.

**FIND-198 · Две копии tg после установки на Windows — версии причин**
Не воспроизведено. (a) Codex, пока искал `tg`, сам поставил его своим npm в `%APPDATA%\npm`; (b) Node.js приложения
ставился дважды (две папки `v<версия>`), старая осталась в PATH пользователя, и в ней свой `tg.cmd`; (c) npm приложения
взял префикс из чужого `.npmrc`. Проверка: Tools → панель tg показывает обе папки; `bin/try-fresh-install` повторяет
первый запуск на Linux.

**BUG-62 · Шаг навыков показывает Cursor дважды и не видит других агентов** — в тестовом запуске (`bin/try-fresh-install`)
пустой HOME и узкий PATH прячут Claude Code и Codex, это ожидаемо; дубль Cursor — настоящая ошибка.

**BUG-63 · Выбор агента у «Copy prompt» в гайде ничего не меняет** — список есть, действия нет.

**SEC-114 · На скриншотах Славы личные данные** — номер телефона (экран кода), api_id и название app (AISWE), имена
устройств и город (Android «Devices»). В публичные cli-docs и tg-cli только после закрашивания.
- **2026-11-04:** я сам просмотрел 4 изменённых PNG (код, credentials, обе Android): номер, api_id, AISWE, город, устройство
  закрыты; копии в двух репо побайтно одинаковые.

**DEBT-14 · Фичи импортируют друг друга по кругу** — tools↔agents, storage, onboarding, logs, config; правило запрещает
только импорт из app. Нужен общий слой (ToolIcon, ReportThis, safeStorage, JsonTree, реестр инструментов) и index.ts на фичу.

**DEBT-15 · Большие файлы и тонкий ui/** — 29 tsx больше 300 строк (ConnectGuide.tsx 1112, проверено `wc -l`; steps.tsx 689);
нет Tabs, Switch, Field, Progress, Table, Toast — фичи пишут свои (прогресс в 8 местах). 21 отключение проверки зависимостей эффектов.

**RISK-99 · Диск /home заполнен — 2026-11-04 свободно 0.8–2.5 ГБ из 375; сборки Rust подагентов падали «No space left on
device». Удалил только свой кэш `target/debug/incremental` (2 ГБ). Нужна чистка вне проекта.

**RISK-97 · Нет тестов там, где риск** — ConnectGuide, Permissions, Health без тестов; 1 тест на 27 файлов схем; нет e2e
(playwright-core только в скриптах); нет общего render-хелпера; мок с задержками делает тесты медленными.

**PERF-4 · Мок (6132 строки) в боевой сборке** — `src/platform/bridge.ts:32` импортирует `./mock` статически, выбор в
`bridge.ts:315` во время выполнения (проверено чтением). Один JS-чанк 3.26 МБ (со слов аудита). Динамический импорт и ленивые страницы.

**UX-61 · Раздел «Advanced: MCP» на странице агента непонятен** — Слава: «This is not actionable - no idea what to do and
why we have this section». Решение: без серверов WireCat раздел не показывать; с ними — простыми словами «агенту они не нужны,
удалите, если не ставили сами»; для чат-приложений ссылка на Tools → Connect an AI app. Передано подагенту TASK-95.

**BUG-64 · Fix «не найдено в новом терминале» пишет «Added», а ошибка остаётся** — проверка запускала `bash -lic` (читает
только `.profile`), а запись идёт в `.bashrc`; в тестовом HOME нет `.profile`, который подключает `.bashrc`. Повторное
нажатие добавило второй блок (видно в `~/.cache/wirecat-fresh-install/home/.bashrc`). Исправлено: на Linux bash проверяется
как новый терминал (`-ic`), `src-tauri/src/paths.rs` `terminal_flags`, тест.

**BUG-65 · Боковая панель настройки пропускала проверку Node.js** — Continue был заблокирован, а шаги в панели открывались.
Исправлено (0ec6958): шаги после «Ваш компьютер» недоступны с той же причиной.

**BUG-66 · Причина блокировки Continue устаревала на 200 мс** — текст внутри анимации затухания, две копии с одним id,
экранный диктор читал старую. Исправлено (35bd6cb).

**BUG-67 · Установка считала «n из N» не в том порядке** — ставились в порядке отметок, считались в порядке списка.
Исправлено (0a79584): очередь идёт по списку на экране.

**RISK-100 · Кэш модулей vitest прятал новые файлы сообщений от catalogs.test.ts** — `import.meta.glob` в кэшированном
преобразовании; fix/messages.ts и signin/messages-telegram.ts не проверялись локально (73 вместо 77 тестов). CI с чистой
установкой не задет. Выключил `fsModuleCache` в vitest.config.ts; полный прогон 56 с, как и раньше.

## 4. Вопросы к Славе

**NEED-2184 · Добавлять ли папку своего Node в PATH пользователя автоматически после установки, а не по кнопке?**
- Сейчас: без кнопки агенты не видят `tg` (FIND-196).
- Варианты: **A** автоматически и сказать об этом · **B** кнопка + заметка
- Я бы: **A** — CLI ставят ради агентов; правка только в PATH пользователя, без прав администратора.
- Если не ответить: каждый пользователь Windows без своего Node упрётся в то же.
- **Ответ Славы (2026-11-04):** **A** («let's add this automatically»).

**NEED-2185 · Какой текст был в ошибках навыков после установки?**
- Сейчас: сделал одно сообщение и Fix для любых одинаковых ошибок проверки навыков, но точного текста не видел.
- Варианты: **A** прислать скриншот или текст · **B** оставить как есть
- Я бы: **A** — если ошибка не про PATH, Fix её не исправит, и нужен другой шаг.
- Если не ответить: Fix перепроверит навыки, но причина вне PATH останется.
- **Ответ Славы (2026-11-04):** «dont remember, cant see now» — текста нет; проверим на повторной установке (TASK-92).

**NEED-2186 · Выпустить ли эти исправления версией 0.3.1 сразу после слияния PR?**
- Сейчас: у пользователя 0.3.0 без автодобавления в PATH; в main уже 35 коммитов после 0.3.0 плюс эта ветка.
- Варианты: **A** выпустить сразу после слияния · **B** ждать следующего планового выпуска
- Я бы: **A** — пользователи Windows без своего Node сейчас упираются в «агент не находит tg».
- Если не ответить: исправление ждёт следующего выпуска.
- **Ответ Славы (2026-11-04):** **B** — ждать планового выпуска.

**NEED-2187 · Показывать ли после входа в CLI короткий экран «как WireCat работает с агентом» перед первым гайдом?**
- Сейчас: после входа сразу открывается первый гайд; не объяснено, что агент сам запускает команды через навык.
- Варианты: **A** короткий экран (3 пункта + пример фразы агенту), затем гайд · **B** объяснение внутри гайда · **C** оставить
- Я бы: **A** — сначала модель «вы просите агента словами, он запускает tg», потом практика.
- Если не ответить: делаю A после TASK-94/95.
- **Ответ Славы (2026-11-04):** **A**.

**NEED-2188 · Выпадающий список агента у «Copy prompt»: запускать терминал с агентом или убрать?**
- Сейчас: выбор ничего не делает (BUG-63).
- Варианты: **A** кнопка «Открыть в <агент>» запускает терминал с промптом, копирование остаётся · **B** убрать список
- Я бы: **A** — механизм уже есть (Fix ›), и это короче путь к первому результату.
- Если не ответить: делаю A.
- **Ответ Славы (2026-11-04):** **A**.

**NEED-2189 · Брать ли Radix для доступных примитивов (Dialog, Tabs, Switch, Popover) вместо своих?**
- Сейчас: своя доступность в ui/ (Calendar, Combobox, FilterMenu) — фокус, клавиатура, aria написаны руками.
- Варианты: **A** Radix primitives под нашими стилями, по одному компоненту · **B** писать свои дальше
- Я бы: **A** — меньше своего кода с тонкими ошибками фокуса; стили остаются наши.
- Если не ответить: рефакторинг начнётся с тестов и структуры, без новых зависимостей.

**NEED-2190 · Пушить ли ветки документации tg-cli и cli-docs и открывать PR сейчас?**
- Варианты: **A** сейчас · **B** когда будет готов PR #93
- Я бы: **A**.
- **Ответ Славы (2026-11-04):** **B**.

**NEED-2191 · TanStack Query для ответов Rust и типы TypeScript из Rust?** — **Ответ Славы (2026-11-04):** **A** (оба).

**NEED-2192 · Типизированные ошибки Rust, лог-файл, lib.rs по фичам?** — **Ответ Славы (2026-11-04):** **A**, отдельным PR.

**NEED-2189 · (обновление)** — Слава: «still dont see most popular tools like shadcn, tailwind ... need better comparison
and explanation». Ждёт сравнения (TASK-101).

**NEED-2189 · Библиотека поведения UI** — **Ответ Славы (2026-11-04):** «Use React Aria Components, with our own Tailwind
classes. Do not add shadcn or a kit.»

**NEED-2193 · Где жить общим частям (ToolIcon, ReportThis, safeStorage, JsonTree)?** — A `src/shared/` · B ui/ и platform/.
Я бы A. **Ответ Славы (2026-11-04):** **A**.

**NEED-2194 · Удалить ли ~/.cache/wirecat-bench (7 ГБ данных бенчмарков)?** — A удалить · B оставить. Я бы B, пока не
подтверждено, что результаты в cli-testing.

**NEED-2195 · Посмотреть ли внутрь ~/.local/share/WireCat (13 ГБ) только на чтение?** — Я бы A: если там копятся кэши,
приложение должно их чистить. **Ответ Славы: A** «and suggest what we can clean» (подагент, только чтение).

**NEED-2196 · Удалить ли старые worktree в visage/.claude/worktrees, чьи PR слиты или закрыты?** — Я бы A: проверить PR на
GitHub, удалить чистые, остальные списком. (Папки сборки в них уже удалены, 76 ГБ.) **Ответ Славы: A** (подагент).

**NEED-2197 · После «Настроить позже» и перезапуска открывать настройку там, где остановились, а не с приветствия?**
- Сейчас: сохраняется только статус, настройка открывается с Welcome.
- Варианты: **A** продолжать с сохранённого шага · **B** с начала
- Я бы: **A** — человек уже прошёл Node.js и выбор, повторять скучно.
- Если не ответить: с начала.
- **Ответ Славы (2026-11-04):** «check if the steps could have been passed eg at least 1 cli installed, logged in etc and
  either move user to a relevent step or show home - tools page (right now it's home default), home may change later» —
  шаг выводится из реального состояния (TASK-104, подагент, ветка feat/onboarding-resume).

(NEED-2198 выдан счётчиком и не использован.)
