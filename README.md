```text
      ████████╗ █████╗ ███╗   ██╗██╗  ██╗███████╗    ██╗    ██╗ █████╗ ██████╗ ███████╗ █████╗ ██████╗ ███████╗
      ╚══██╔══╝██╔══██╗████╗  ██║██║ ██╔╝██╔════╝    ██║    ██║██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔════╝
         ██║   ███████║██╔██╗ ██║█████╔╝ ███████╗    ██║ █╗ ██║███████║██████╔╝█████╗  ███████║██████╔╝█████╗
         ██║   ██╔══██║██║╚██╗██║██╔═██╗ ╚════██║    ██║███╗██║██╔══██║██╔══██╗██╔══╝  ██╔══██║██╔══██╗██╔══╝
         ██║   ██║  ██║██║ ╚████║██║  ██╗███████║    ╚███╔███╔╝██║  ██║██║  ██║██║     ██║  ██║██║  ██║███████╗
         ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝     ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝

              ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
             █  HTML5 · Canvas · WebSocket │ Vite │ Node + ws │ TypeScript (shared / server / client) █
              ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀

```

**Репозиторий на GitHub:** [github.com/shuanat/tanks-warfare](https://github.com/shuanat/tanks-warfare)

# Tanks: Warfare

Монолит (`archive/legacy-monolith/index.html` + `server.js`) разнесён на **клиент (Vite)** и **модульный сервер (Node + WebSocket)**. Общий слой протокола и констант — **`shared/`** (TypeScript).

Участие в проекте регулируется [кодексом поведения](CODE_OF_CONDUCT.md).

---

## Установка Git на Windows и клонирование репозитория

### 1. Установить Git

**Вариант A — установщик (рекомендуется новичкам)**

1. Откройте [git-scm.com/download/win](https://git-scm.com/download/win) и скачайте **64-bit Git for Windows**.
2. Запустите установщик. Важные экраны:
   - **Adjusting your PATH** — удобно выбрать _Git from the command line and also from 3rd-party software_, чтобы `git` был доступен в PowerShell и CMD.
   - **Line ending conversions** — для Windows обычно подходит _Checkout Windows-style, commit Unix-style_ (`core.autocrlf=true`).
3. Завершите установку и **перезапустите** терминал (или Cursor).

**Вариант B — через winget (PowerShell от администратора не обязателен для пользовательской установки)**

```powershell
winget install --id Git.Git -e --source winget
```

После установки проверьте:

```powershell
git --version
```

### 2. Первоначальная настройка Git (один раз на ПК)

Укажите имя и почту — они попадут в коммиты:

```powershell
git config --global user.name "Ваше Имя"
git config --global user.email "you@example.com"
```

Проверка:

```powershell
git config --global --list
```

### 3. Клонировать этот проект

**HTTPS** (проще начать; для приватных репозиториев GitHub попросит логин или Personal Access Token):

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/shuanat/tanks-warfare.git
cd tanks-warfare
```

**SSH** (если настроили ключи в GitHub → Settings → SSH keys):

```powershell
git clone git@github.com:shuanat/tanks-warfare.git
cd tanks-warfare
```

Дальше установите зависимости:

```powershell
npm install
```

Если репозиторий переименован или лежит под другим пользователем — замените `shuanat/tanks-warfare` на свой путь `USER/REPO` со страницы репозитория на GitHub.

---

## GitHub CLI (`gh`): установка, вход и работа с репозиторием

### Установка `gh` на Windows

```powershell
winget install --id GitHub.cli -e --source winget
```

Проверка: `gh --version`.

### Вход в аккаунт GitHub

```powershell
gh auth login
```

Следуйте подсказкам: GitHub.com → HTTPS или SSH → авторизация через браузер.

### Клонирование через `gh`

```powershell
gh repo clone shuanat/tanks-warfare
cd tanks-warfare
```

### Создать новый репозиторий из локальной папки (для мейнтейнеров)

Если проект ещё не на GitHub, из **корня** репозитория (уже с `git init` и коммитом):

```powershell
gh repo create tanks-warfare --public --source=. --remote=origin --push --description "HTML5 tanks: Vite + Node WebSocket, shared TypeScript"
```

- `--private` вместо `--public` — приватный репозиторий.
- Если имя `tanks-warfare` занято, укажите другое: `gh repo create my-tanks-game ...`.

Подробнее: [CLI manual: gh repo create](https://cli.github.com/manual/gh_repo_create).

---

## Быстрый старт (разработка)

```bash
npm install
# Терминал 1 — API + WebSocket (без .env слушает порт 3033; на Windows порт 80 без прав админа не поднимется)
copy .env.example .env   # по желанию
npm run dev:server

# Терминал 2 — Vite (client/.env.development → VITE_WS_URL должен совпадать с PORT, по умолчанию ws://localhost:3033)
npm run dev:client
```

Или одной командой: `npm run dev` (Vite + watch-сервер).

На **PowerShell** вместо `copy` можно: `Copy-Item .env.example .env`.

Проверка стиля: `npm run lint`; TypeScript: `npm run typecheck`; юнит-тесты: `npm test` (клиент: `client/src/**/*.test.js`, сервер: `server/**/*.test.ts`, см. `vitest.config.js` и alias `#shared/*`). В CI — `lint` → `typecheck` → `test` → `build` (см. [.github/workflows/ci.yml](.github/workflows/ci.yml), [docs/CODE_CONVENTIONS.md](docs/CODE_CONVENTIONS.md)).

Каталог **`shared/dist/`** не в git: общий слой компилируется из `shared/src` (`npm run build:shared`). Это уже входит в `npm run dev`, `npm test` и `npm run build`.

Мини-репорты по багам и фиксам: [docs/bug-notes/](docs/bug-notes/) (шаблон и индекс в [docs/bug-notes/README.md](docs/bug-notes/README.md)).

**Чёрный экран / `ECONNREFUSED 127.0.0.1:3033` для `/assets/...` в логе Vite:** либо поднимите **сервер** (`npm run dev:server` или одной командой `npm run dev`), либо скопируйте ассеты в **`client/public/assets/`** (`images/`, `sounds/`, …) — тогда Vite отдаст их без прокси. Порт прокси берётся из корневого `.env` (`PORT`, по умолчанию 3033), он должен совпадать с портом сервера.

## Сборка

Положите ассеты в **`client/public/assets/`** (`images/`, `sounds/` — см. [client/public/assets/README.txt](client/public/assets/README.txt)).

```bash
npm run build
```

Собирает `shared`, сервер и клиент. Статика игры — **`client/dist`**. Пример набора переменных без dev-сервера: [`.env.production.example`](.env.production.example).

## Переменные окружения

| Переменная    | Описание                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `PORT`        | HTTP + WebSocket. По умолчанию **3033**; смена порта — в `.env` или в команде запуска процесса                     |
| `STATIC_ROOT` | Каталог со статикой (`index.html`, `/assets/...`). По умолчанию: `client/dist` относительно репозитория            |
| `NODE_ENV`    | `development` / `production`                                                                                       |
| `LOG_LEVEL`   | Опционально: `error` / `warn` / `info` / `debug` — серверный лог (`server/logger.ts`). В prod по умолчанию `info`. |

Клиент (только dev-сборка Vite):

| Переменная    | Описание                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `VITE_WS_URL` | Полный URL WebSocket, напр. `ws://localhost:3033` (тот же порт, что `PORT` у сервера). Для собранного клиента обычно не нужен |

## Структура каталогов

```text
shared/           — общий TS: протокол WS, размеры карты, палитра танков → dist после tsc
server/           — сервер на TypeScript → `npm run build:server` → `server/dist/` (импорт `#shared/*` из корня package.json)
client/
  src/
    config/       — константы игры, env (WS URL)
    lib/          — ассеты, аудио
    game/         — gameClient (логика; план дробить на simulation / render / net)
  public/assets/  — PNG, MP3 (не коммитятся, если большие)
tools/            — extract-game-client.mjs (регенерация из archive/legacy-monolith/index.html при необходимости)
```

Подробнее см. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), план рефакторинга — [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md).

## Cursor

Правила для агента и подсказки по стеку — в [`.cursor/rules/`](.cursor/rules/) (`*.mdc`: ядро проекта всегда, клиент/сервер/docs — по glob).

## Легаси

Монолитный клиент лежит в **`archive/legacy-monolith/`** (`index.html` + `README.md`). Черновик `gameClient.js`: `node tools/extract-game-client.mjs`. Актуальная сборка — **`client/dist`**.
