# 2026-11-03 — Funnel helper (tsnet)

Агент: `funnel` · ветка: `docs/funnel-helper-plan` · начато: `02:10` Europe/Madrid

---

## 1. Задачи

**TASK-89 · Помощник на tsnet для Funnel без пароля: план, CLI, тексты о приватности, скрипт живой проверки**
Статус: в работе. План `docs/dev/plans/2026-11-03-funnel-helper.md`.
- репозиторий https://github.com/WireCatLabs/funnel-cli (приватный, создан этой сессией), PR #1. Вместо
  pid-файла — локальная точка управления (127.0.0.1 + токен в файле 600): `stop` без сигналов по PID, работает и на
  Windows. `login_url`/`funnel_url` слиты в `action_url`.
- PR: план https://github.com/WireCatLabs/wirecat-desktop/pull/90 · CLI https://github.com/WireCatLabs/funnel-cli/pull/1 ·
  черновики о приватности https://github.com/WireCatLabs/cli-docs/pull/552 и
  https://github.com/WireCatLabs/wirecat-desktop/pull/99 (не сливать до выпуска помощника) · замер
  https://github.com/WireCatLabs/cli-testing/pull/295 · идея поста POST-139 в cli-private (5d0eb753).
- Живая проверка NEED-74 для владельца: `/home/leemour/Projects/AI/funnel-cli/bin/live-check`. Прогон до ссылки
  входа (без входа) проверен: сборка, заглушка MCP, маршрут, ссылка, остановка и уборка за собой.

## 2. Вопросы Славы

## 3. Находки

**FIND-196 · tsnet сам не читает `TS_NO_LOGS_NO_SUPPORT`, но выключатель всё равно работает.**
`tsnet.startLogger` (`tsnet/tsnet.go:1100-1137` @v1.104.5) всегда создаёт отправщик логов; переменная действует через
транспорт: `logpolicy.TransportOptions.New` отдаёт «ничего не отправляющий» транспорт (`logpolicy/logpolicy.go:894-897`).
Помощник вызывает `envknob.SetNoLogsNoSupport()` и `logtail.Disable()` в начале `main`. Файлы `tailscaled.log.conf`
и пустые буферы всё равно создаются в папке состояния. `go test` это не проверяет: под `testenv.InTest()` tsnet
логгер не запускает вовсе. Проверка — на собранном бинарнике.
- 2026-11-05: подтверждено на собранном бинарнике (без входа): за 30 с искалось только имя `controlplane.tailscale.com`,
  одно соединение — к серверу управления, `tailscaled.log1.txt`/`log2.txt` по 0 байт. Не проверено: после входа
  (это покажет `bin/live-check`).

**RISK-96 · Эфемерная нода tsnet может не принять вход через браузер.** Тогда для NEED-74 нужен эфемерный ключ
из админки (файл с правами 600).

**FIND-197 · DNS-over-HTTPS к 1.1.1.1:443 с этой машины не проходит, обычный DNS к 1.1.1.1 отвечает.**
`curl --doh-url https://1.1.1.1/dns-query` → «Could not resolve host», прямой `curl https://1.1.1.1/...` → «Failed to connect»;
`dig @1.1.1.1` отвечает. Поэтому `bin/live-check` берёт адрес через `dig @1.1.1.1` и `curl --resolve`. Причина
(песочница агента или сеть) не выяснялась.

## 4. Вопросы к Славе
