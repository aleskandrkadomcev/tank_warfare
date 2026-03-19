# Соглашения по коду (code conventions)

Язык комментариев и док-стрингов — **русский** (см. `.cursor/rules/tanks-core.mdc`).

Поведение в сообществе — в корневом [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md).

## Модули и стек

- **ESM** везде: `import` / `export`; без `require` в новом коде.
- **Клиент:** браузерные глобалы только в `client/src/`; конфиг Vite — среда Node.
- **Сервер:** Node 18+, `import` с расширением `.js` в относительных путях.

## Стиль форматирования

- Отступы **4 пробела** (как в текущем `gameClient.js` и сервере); в новых файлах **сохранять стиль соседних строк**.
- Точка с запятой — **как в файле**, не смешивать стиль в одном модуле.
- Строки: предпочтительно одинарные кавычки `'`, если в файле уже так; иначе согласовать с существующим кодом.

## Именование

- Файлы: `camelCase` для утилит или **kebab-case** не использовать; в проекте приняты **одно слово или camelCase** (`messageHandler.js`, `staticHandler.js`).
- Функции и переменные: `camelCase`; константы баланса — `UPPER_SNAKE` в `constants.ts` (клиент/сервер).
- Типы сообщений WebSocket — **английский**, короткие стабильные строки; единый источник: **`shared/src/protocol.ts`**. На сервере импорт `#shared/protocol.js` (см. `imports` в корневом `package.json`). Новый входящий тип: константа в `shared`, хендлер в `server/ws/dispatch.ts` + `handlers/`, при необходимости ветка в `client/src/network/messageHandlers.ts`. Контракт payload — `shared/src/payloads.ts`. Обзор: [protocol.md](./protocol.md).

## Линтер

- Запуск: `npm run lint`; автоисправление где возможно: `npm run lint:fix`.
- Конфигурация: корневой `eslint.config.js` (flat config, ESLint 9+).
- Игнорируются: `node_modules`, `client/dist`, `server/dist`, `shared/dist`, исходники `shared/src`, `server/**/*.ts`, `client/src/**/*.ts` (проверка TS — `npm run typecheck`), архив `archive/**` (легаси HTML).
- В **`client/src/game/gameClient.js`** отключены некоторые правила для постепенного выноса логики (см. `eslint.config.js`); новый код предпочтительно писать в **новых модулях** уже без ослаблений.

## CI

- При push и pull request: workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `npm ci`, затем `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (`build:shared` + `build:server` + Vite).
- Локально перед PR имеет смысл повторить ту же последовательность.

## Ошибки и данные с сети

- Входящие JSON от клиента: не доверять без проверки там, где влияет на честность игры или стабильность сервера.
- `JSON.parse` в обработчике WS — уже с `try/catch` на сервере; при дублировании паттерна сохранять тот же подход.

## Константы клиент / сервер

- Размеры карты, `BRICK_SIZE`, `MAX_SCORE`, `MAX_PLAYERS`, палитра танков — **`shared/src`** (`map.ts`, `colors.ts`); клиент реэкспортирует часть в `client/src/config/constants.ts`, сервер — в `server/constants.ts`. Баланс, специфичный только для клиента или только для сервера, остаётся в соответствующих `constants`.

## Юнит-тесты (Vitest)

- Клиент: `client/src/**/*.test.js` (например коллизии, `messageHandlers`).
- Сервер: `server/**/*.test.ts` рядом с модулем; перед прогоном `npm test` собирает `shared/dist`. Импорты `#shared/*` в тестах резолвятся через `vitest.config.js` (`resolve.alias`).
- Исключать `*.test.ts` из `tsc` сборки сервера: в `server/tsconfig.json` уже в `exclude`.

## Зависимости

- Новые пакеты — осознанно: предпочтение встроенным API Node и минимальному числу dev-зависимостей.
