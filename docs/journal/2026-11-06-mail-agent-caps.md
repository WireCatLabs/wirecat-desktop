# 2026-11-06 — Почтовый агент: лимиты расходов и причина пропуска

Агент: `Mail Agent Caps` · ветка: `feat/mail-agent-caps` · начато: 2026-11-06 Europe/Madrid.
Продолжение [2026-11-05-mail-agent-toggle.md](2026-11-05-mail-agent-toggle.md) (FIND-209..212).

---

## 1. Задачи

**TASK-118 · «Spent today: $0.84 of $5.00» и локализованная причина пропуска**
Статус: сделано. Rust читает `max_cost_usd`, `max_cost_per_day_usd` и `last.skipped` из `memo schedule list --json`
(cli-core 0.584.0, PR 2533); раздел пишет «Spent today: $0.84 of $5.00» на en/ru/es, без «of», когда лимит 0 или
поля нет. Установленный memo 0.131.39 (npm latest на 2026-11-06) собран на cli-core 0.582.0 и полей лимитов ещё не
отдаёт: тогда строка остаётся «Spent today: $0.84». Причина пропуска показывается словами memo (см. FIND-213).
Релиз 0.4.2 вместе с этим, как решено в NEED-2260 = B.

## 2. Вопросы Славы

нет

## 3. Находки

**BUG-82 · Раздел принимал `last.reason` за причину пропуска, а пропуск не показывал вовсе**
В memo `last.reason` — причина *неудачного* запуска (`provider_error (claude.exit)`), а пропуск лежит в
`last.skipped: {at, why}`, и `exit_code` при этом остаётся от последнего настоящего запуска (cli-core
`src/background/schedules.ts`, `recordSkip`). Поэтому запуск, упавший с причиной, показывался как «skipped: …», а
настоящий пропуск у лимита за день — как «finished». Исправлено: исход «skipped», когда есть `last.skipped`; время
берётся из `skipped.at`.

**FIND-213 · memo не даёт код причины пропуска, только английский текст**
`last.skipped` = `{at, why}`; `why` — свободный текст («today's runs cost $5.02, the $5.00 a day allowed; it runs
again tomorrow»), кода вроде `daily-cap` нет. Сейчас `recordSkip` вызывается только у дневного лимита, но схема
описывает и «too little new mail». Desktop показывает текст как есть внутри русского и испанского интерфейса.
Нужно в cli-core: `skipped.reason` с id (`schedule.daily-cap`, `schedule.mail-wait`) рядом с `why`; тогда Desktop
переводит известные коды и оставляет `why` для остальных.

**FIND-214 · FIND-209 и FIND-210 закрыты в cli-core 0.584.0 (PR 2533); memo получит их в следующем выпуске**
Схема `schedule list` теперь описывает `spent_today_usd`, `last.cost_usd`, `last.skipped`, а item даёт
`max_cost_usd` и `max_cost_per_day_usd`. FIND-211 (`review status`) не тронут.

## 4. Вопросы к Славе

нет
