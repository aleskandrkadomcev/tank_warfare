import { onLobbyCleanup, shouldDeleteLobbyAfterClose } from './bots.js';
import { broadcastLobbyList, broadcastLobbyState, sendLobbyList } from './broadcast.js';
import { lobbies } from './lobbyStore.js';
import { handleGameMessage } from './messageHandler.js';
export function attachWebSocketServer(wss) {
    wss.on('connection', (ws) => {
        ws.id = null;
        ws.lobbyId = null;
        ws.nickname = '';
        ws.team = 0;
        ws.ready = false;
        ws.color = '#4CAF50';
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
            if (lobby) {
                lobby.players = lobby.players.filter((p) => p !== ws);
                if (ws.id === lobby.hostId && lobby.players.length > 0) {
                    const nextHost = lobby.players.find((p) => !p.isBot) || lobby.players[0];
                    lobby.hostId = nextHost.id;
                }
                if (lobby.players.length === 0 || shouldDeleteLobbyAfterClose(lobby)) {
                    onLobbyCleanup(lobby);
                    delete lobbies[ws.lobbyId];
                }
                else {
                    broadcastLobbyState(lobby);
                }
                broadcastLobbyList(wss);
            }
        });
    });
}
//# sourceMappingURL=attachWebSocket.js.map