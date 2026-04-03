import http from 'http';
import https from 'https';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { handleHttpRequest } from './http/staticHandler.js';
import { log } from './logger.js';
import { assertDispatchRegistryComplete } from './ws/dispatch.js';
import { attachWebSocketServer } from './ws/attachWebSocket.js';

if (process.env.NODE_ENV !== 'production') {
    assertDispatchRegistryComplete();
}

const certPath = '/etc/letsencrypt/live/tanks-warfare.ru';
const hasCerts = fs.existsSync(`${certPath}/fullchain.pem`);

if (hasCerts) {
    // --- HTTPS (порт 443) — основной сервер ---
    const httpsServer = https.createServer(
        {
            cert: fs.readFileSync(`${certPath}/fullchain.pem`),
            key: fs.readFileSync(`${certPath}/privkey.pem`),
        },
        handleHttpRequest,
    );
    const wss = new WebSocketServer({ server: httpsServer });
    attachWebSocketServer(wss);

    httpsServer.listen(443, () => {
        log.info('server_listen', { port: 443, mode: 'https', staticRoot: config.staticRoot });
    });

    // --- HTTP (порт 80) — редирект на HTTPS ---
    const httpRedirect = http.createServer((req, res) => {
        const host = req.headers.host?.replace(/:.*/, '') || 'tanks-warfare.ru';
        res.writeHead(301, { Location: `https://${host}${req.url}` });
        res.end();
    });
    httpRedirect.listen(80, () => {
        log.info('server_listen', { port: 80, mode: 'http-redirect' });
    });
} else {
    // --- Без сертификатов — обычный HTTP (локальная разработка) ---
    const server = http.createServer(handleHttpRequest);
    const wss = new WebSocketServer({ server });
    attachWebSocketServer(wss);

    server.listen(config.port, () => {
        log.info('server_listen', {
            staticRoot: config.staticRoot,
            port: config.port,
            nodeEnv: config.nodeEnv,
        });
    });
}
