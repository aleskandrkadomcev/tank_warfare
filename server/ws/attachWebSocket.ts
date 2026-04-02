import type { WebSocketServer } from 'ws';
import { onLobbyCleanup, shouldDeleteLobbyAfterClose } from './bots.js';
import { broadcastLobbyList, broadcastLobbyState, sendLobbyList } from './broadcast.js';
import { lobbies } from './lobbyStore.js';
import { handleGameMessage } from './messageHandler.js';

/** Время (мс) до удаления лобби, в котором остались только боты. */
const BOTS_ONLY_CLEANUP_MS = 10_000;

export function attachWebSocketServer(wss: WebSocketServer): void {
    wss.on('connection', (ws) => {
        ws.id = null;
        ws.lobbyId = null;
        ws.nickname = '';
        ws.team = 0;
        ws.ready = false;
        ws.color = '#4CAF50';
        ws.camo = 'none';
        ws.isInGame = false;
        ws.isBot = false;
        ws.lastPos = { x: 0, y: 0, hp: 100 };
        ws.lastPosAt = 0;
        ws.x = 0;
        ws.y = 0;
        ws.angle = 0;
        ws.turretAngle = 0;
        ws.vx = 0;
        ws.vy = 0;
        ws.hp = 100;
        ws.spawnTime = 0;

        sendLobbyList(ws);

        ws.on('message', (message) => {
            handleGameMessage(wss, ws, message);
        });

        ws.on('close', () => {
            const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
            if (!lobby) return;

            if (lobby.gameStarted && !ws.isBot) {
                // Во время игры — не удаляем, а оставляем «призрака»
                // (readyState уже не 1, значит send() ничего не сделает)
                // Помечаем disconnected — для возможности реконнекта
                ws.disconnectedAt = Date.now();
                // Передаём хост если нужно
                if (ws.id === lobby.hostId) {
                    const nextHost = lobby.players.find((p) => p !== ws && !p.isBot && p.readyState === 1)
                        || lobby.players.find((p) => !p.isBot && p.readyState === 1)
                        || lobby.players.find((p) => p !== ws);
                    if (nextHost) lobby.hostId = nextHost.id!;
                }
            } else if (ws.id === lobby.hostId) {
                // Хост вышел из лобби — даём 10 сек на реконнект
                ws.disconnectedAt = Date.now();
                const lobbyId = ws.lobbyId!;
                // Отменяем отсчёт если был
                if (lobby.countdownHandle) {
                    clearInterval(lobby.countdownHandle);
                    lobby.countdownHandle = null;
                    lobby.countdown = 0;
                }
                lobby.hostReconnectHandle = setTimeout(() => {
                    const l = lobbies[lobbyId];
                    if (!l) return;
                    // Хост не вернулся — закрываем лобби
                    const closeMsg = JSON.stringify({ type: 'lobby_closed' });
                    for (const p of l.players) {
                        if (p !== ws && !p.isBot && p.readyState === 1) {
                            p.send(closeMsg);
                        }
                    }
                    onLobbyCleanup(l);
                    delete lobbies[lobbyId];
                    broadcastLobbyList(wss);
                }, 10_000);
                broadcastLobbyState(lobby);
                broadcastLobbyList(wss);
                return;
            } else {
                // Обычный игрок вышел из лобби — просто удаляем
                lobby.players = lobby.players.filter((p) => p !== ws);
                // Отменяем отсчёт если был
                if (lobby.countdownHandle) {
                    clearInterval(lobby.countdownHandle);
                    lobby.countdownHandle = null;
                    lobby.countdown = 0;
                }
            }

            if (lobby.players.length === 0 || shouldDeleteLobbyAfterClose(lobby)) {
                onLobbyCleanup(lobby);
                delete lobbies[ws.lobbyId!];
            } else {
                // Если остались только боты — запускаем таймер удаления
                const hasHuman = lobby.players.some((p) => !p.isBot && p.readyState === 1);
                if (!hasHuman && !lobby.botsOnlyCleanupHandle) {
                    const lobbyId = ws.lobbyId!;
                    lobby.botsOnlyCleanupHandle = setTimeout(() => {
                        const l = lobbies[lobbyId];
                        if (!l) return;
                        // Перепроверяем — вдруг кто-то зашёл
                        const stillHasHuman = l.players.some((p) => !p.isBot && p.readyState === 1);
                        if (!stillHasHuman) {
                            onLobbyCleanup(l);
                            delete lobbies[lobbyId];
                            broadcastLobbyList(wss);
                        }
                    }, BOTS_ONLY_CLEANUP_MS);
                }
                broadcastLobbyState(lobby);
            }
            broadcastLobbyList(wss);
        });
    });
}
