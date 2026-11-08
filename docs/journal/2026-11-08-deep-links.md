# 2026-11-08 — deep links и экран сводок

Агент: subagent · ветка: `feat/deep-links`, `feat/digests` · начато: 17:30 Europe/Madrid

---

## 1. Задачи

**TASK-143 · Ссылки `wirecat://open/v1/…` и экран «Сводки» в Desktop**
Статус: сделано, два PR (ссылки, затем сводки). План: `max-cli/docs_ai/plans/2026-11-07-deep-links.md`,
`2026-11-07-digest-format.md` §10.3. Грамматика — фикстура cli-core `test/fixtures/links-v1.json`
(ветка `feat/links-and-scope`, 8c0b78e4f), копия в `src/domain/links-v1.fixture.json`.

## 2. Вопросы Славы

Нет.

## 3. Находки

**FIND-252 · cli-core уже шлёт своё системное уведомление о каждом запуске сводки**
`runSchedule` зовёт `notify(...)` с заголовком и `summary` (`cli-core/src/background/schedules.ts:697`, ветка
`feat/links-and-scope`). Desktop теперь шлёт своё, с переходом на день. При открытом приложении будет два
уведомления. Проверено чтением кода, не на экране.

**RISK-115 · Запрос `created:>="<ISO>"` для ссылки `tasks/new/<since>` не проверен на живом memo**
Поле `created` (тип time) есть в `cli-core/src/store/sqlite/task-board.ts:54`; кавычки вокруг ISO-времени работают
в других полях (`starts_at>="…"`). Что `created:>="…"` с часовым поясом читается так же — вывод, не проверка.

**IDEA-33 · `msg/…` и `chat/…` можно открывать в контексте**
Экрана чата нет; ссылка показывает «пока нельзя открыть» и ссылку на объект. Memory уже читает контекст источника
(`memory_source_context`), Search — контекст хита. Любой из них мог бы показать сообщение с соседями.

**FIND-253 · У memo нет команды, которая перечисляет запуски расписания**
`schedule` умеет `command`, `agent`, `list`, `run`, `remove`, `exec` (`cli-core/src/cli/schedule/schedule-command.ts`,
ветка `feat/links-and-scope`). Поэтому `digests.rs` читает файлы `<memo state>/schedules/morning-digest/runs/`
напрямую. Если cli-core поменяет раскладку файлов, экран сводок опустеет без ошибки.

**RISK-116 · Клик по уведомлению проверен только по коду notify-rust, не на экране**
По исходнику notify-rust 4.19: Linux и macOS отдают `default` на клик по самому уведомлению, Windows — только на
кнопку Open (клик по телу приходит как `__closed`). macOS-путь требует главный run loop (у Tauri он есть) и может
показать уведомление не от имени WireCat. Нужна ручная проверка на каждой ОС.

## 4. Вопросы к Славе

Нет.
