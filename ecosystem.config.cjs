/**
 * Пример PM2 для продакшена.
 * Перед запуском: `npm run build` (клиент + shared + server).
 *
 * Указать на VPS: `STATIC_ROOT` (каталог с `index.html` и `assets`), `PORT`.
 *
 * Запуск: `pm2 start ecosystem.config.cjs --env production`
 */
module.exports = {
    apps: [
        {
            name: 'tanks',
            script: 'server/dist/index.js',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '400M',
            env: {
                NODE_ENV: 'development',
                PORT: 3033,
            },
            env_production: {
                NODE_ENV: 'production',
                PORT: 80,
                // STATIC_ROOT: '/var/www/tanks',
                // LOG_LEVEL: 'info',
            },
        },
    ],
};
