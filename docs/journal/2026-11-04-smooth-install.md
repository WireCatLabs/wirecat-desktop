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
