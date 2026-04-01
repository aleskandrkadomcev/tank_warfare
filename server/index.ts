import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { handleHttpRequest } from './http/staticHandler.js';
import { log } from './logger.js';
import { assertDispatchRegistryComplete } from './ws/dispatch.js';
import { attachWebSocketServer } from './ws/attachWebSocket.js';

if (process.env.NODE_ENV !== 'production') {
    assertDispatchRegistryComplete();
}

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
