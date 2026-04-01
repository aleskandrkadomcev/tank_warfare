Игровые PNG и MP3 лежат в client/src/game-assets/ и подключаются через import … ?url
в client/src/lib/assets.js — Vite кладёт их в dist при npm run build.

Папка public/assets/ оставлена для подсказок; отдельно копировать файлы на сервер не нужно.

При dev (Vite) ассеты отдаются тем же dev-сервером по URL из сборки (не через /assets/*).
