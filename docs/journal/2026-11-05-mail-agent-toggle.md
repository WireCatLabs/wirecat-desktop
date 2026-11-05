# 2026-11-05 — Почтовый агент: включить и выключить расписание из Desktop

Агент: `Mail Agent Toggle` · ветка: `feat/mail-agent-schedule-toggle` · начато: 2026-11-05 Europe/Madrid.

---

## 1. Задачи

**TASK-117 · «нужна кнопка в десктопе в UI, чтобы поставить на расписание или снять»**
Статус: сделано (PR ниже). Раздел «Mail agent» в Manage у Email на странице Tools: переключатель «Run on a schedule»
(`memo schedule agent mail-triage claude 'Run memo skill show mail-triage and follow it.' --every 5m --on-new-mail
mail-triage --max-cost 1` и `memo schedule remove mail-triage`), последний запуск и как прошёл, потрачено сегодня,
сколько предложений ждёт (`memo review status`), команда `memo review list`. Нет memo — кнопка «Open Memo»; memo старше
0.131.26 — просьба обновить; нет claude на PATH — переключатель выключен и объяснение; отказ memo — его слова.
Команды в `catalog/tools.json` (`email.mailAgent`), Rust `src-tauri/src/mail_agent.rs`. Таймер пишет сам memo
(systemd, launchd, Task Scheduler). `--max-cost-per-day` не передаётся: в конфиге memo `schedule_max_cost_per_day` = 5,
как и в просьбе. `--max-cost 1` передаётся: у него нет значения по умолчанию в конфиге. Настоящее расписание
`mail-triage` владельца не трогалось; живая проверка шла на имени `wcd-probe` с временными MEMO_STATE_DIR и
MEMO_CONFIG_DIR и удалена.

## 2. Вопросы Славы

нет

## 3. Находки

**FIND-209 · `memo schedule list` отдаёт `spent_today_usd`, а его outputSchema этого поля не знает**
`memo commands info schedule list` описывает item с `additionalProperties: false` и без `spent_today_usd`; в выводе
поле есть (memo 0.131.38). Desktop читает его как необязательное. Чинить в cli-core (schema-command).

**FIND-210 · `memo schedule list` не говорит дневной лимит и лимит за запуск**
Видно только `spent_today_usd`. Лимит за день берётся из `--max-cost-per-day` расписания или из конфига, за запуск — из
`--max-cost`; ни того, ни другого в list нет, поэтому Desktop пишет «Spent today: $0.84» без «из $5». Нужно поле вроде
`max_cost_per_day_usd` и `max_cost_usd` в item.

**FIND-211 · `memo review status --json`: outputSchema — общий список, а ответ — `item` с `waiting.count`**
Desktop берёт `item.waiting.count`; схема этого не описывает, так что изменение формы не поймает ни один контракт.

**FIND-212 · В Desktop нет экрана для предложений почтового агента (счета, платежи, mail_findings)**
Страница Memory показывает memories, facts и actions; invoice, payment, mail_findings, key_document туда не попадают.
Поэтому раздел даёт число ждущих предложений и команду `memo review list`, а не ссылку на экран.

## 4. Вопросы к Славе

нет
