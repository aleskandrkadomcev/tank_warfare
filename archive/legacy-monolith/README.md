# Легаси: монолитный клиент

Здесь лежит **старый** корневой `index.html` — один файл со встроенным `<script>` (Canvas, лобби, WebSocket), до разнесения на **Vite** (`client/`) и модульный сервер.

- **Актуальная игра:** `npm run dev` / `npm run build`, точка входа клиента — `client/index.html` → `client/src/`.
- **Регенерация черновика `gameClient.js` из этого HTML** (если понадобится): `node tools/extract-game-client.mjs` — источник задан в `tools/extract-game-client.mjs` (`archive/legacy-monolith/index.html`).

Файл сохранён только для истории и редких сравнений; в продакшене не используется.
