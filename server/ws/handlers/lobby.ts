import { ServerMsg } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { MAX_PLAYERS } from '../../constants.js';
import { generateMapData } from '../../game/mapGenerator.js';
import { buildBotPathGrid } from '../../game/pathfinding.js';
import { isValidColor, sanitizeLobbyName, sanitizeNick } from '../../utils/validation.js';
import { createBotForLobby, initBotsForStart, startAiTick } from '../bots.js';
import { broadcastLobbyList, broadcastLobbyState } from '../broadcast.js';
import { lobbies } from '../lobbyStore.js';

export function handleCreateLobby(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    console.log('[DEBUG] handleCreateLobby data.mapSize =', data.mapSize);
    const lobbyId = Math.floor(Math.random() * 9000 + 1000).toString();
    ws.nickname = sanitizeNick(data.nickname);
    ws.id = `p_${Math.floor(Math.random() * 10000)}`;
    ws.lobbyId = lobbyId;
    ws.team = 1;
    ws.ready = false;
    ws.color = typeof data.color === 'string' ? data.color : '#4CAF50';
    lobbies[lobbyId] = {
        hostId: ws.id,
        name: sanitizeLobbyName(data.lobbyName),
        players: [ws],
        scores: { 1: 0, 2: 0 },
        mines: [],
        boosts: [],
        rockets: [],
        aiBullets: [],
        aiGrid: null,
        gameStarted: false,
        mapData: null,
        aiTickHandle: null,
        detectionVisibleUntil: {},
        smokes: [],
        mapSize: typeof data.mapSize === 'string' ? data.mapSize : 'small',
    };
    ws.send(
        JSON.stringify({
            type: ServerMsg.LOBBY_CREATED,
            lobbyId,
            playerId: ws.id,
            team: 1,
            nickname: ws.nickname,
            color: ws.color,
            isHost: true,
        }),
    );
    broadcastLobbyState(lobbies[lobbyId]);
    broadcastLobbyList(wss);
}

export function handleJoinLobby(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobbyId = typeof data.lobbyId === 'string' ? data.lobbyId : '';
    const lobby = lobbyId ? lobbies[lobbyId] : undefined;
    if (lobby && !lobby.gameStarted && lobby.players.length < MAX_PLAYERS) {
        ws.nickname = sanitizeNick(data.nickname);
        ws.id = `p_${Math.floor(Math.random() * 10000)}`;
        ws.lobbyId = lobbyId;
        ws.team = 2;
        ws.ready = false;
        ws.color = typeof data.color === 'string' ? data.color : '#f44336';
        lobby.players.push(ws);
        ws.send(
            JSON.stringify({
                type: ServerMsg.LOBBY_JOINED,
                lobbyId,
                playerId: ws.id,
                team: 2,
                nickname: ws.nickname,
                color: ws.color,
                isHost: false,
            }),
        );
        broadcastLobbyState(lobby);
        broadcastLobbyList(wss);
    } else {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Lobby full or not found' }));
    }
}

export function handleUpdatePlayer(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby && !lobby.gameStarted) {
        if (typeof data.nickname === 'string') ws.nickname = sanitizeNick(data.nickname);
        if (typeof data.color === 'string' && isValidColor(data.color)) ws.color = data.color;
        broadcastLobbyState(lobby);
    }
}

export function handleChangeTeam(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    const team = typeof data.team === 'number' ? data.team : 0;
    if (lobby && !lobby.gameStarted) {
        const teamCount = lobby.players.filter((p) => p.team === team).length;
        if (teamCount < 5) {
            ws.team = team;
            broadcastLobbyState(lobby);
        }
    }
}

export function handleToggleReady(_wss: WebSocketServer, ws: WebSocket, _data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby && !lobby.gameStarted) {
        ws.ready = !ws.ready;
        broadcastLobbyState(lobby);
    }
}

export function handleStartGame(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby && ws.id === lobby.hostId && !lobby.gameStarted && lobby.players.length >= 1) {
        lobby.gameStarted = true;
        const mapSize = typeof data.mapSize === 'string' ? data.mapSize : (lobby.mapSize || 'small');
        console.log('[DEBUG] handleStartGame mapSize =', mapSize);
        lobby.mapData = generateMapData(mapSize);
        console.log('[DEBUG] generated map w =', lobby.mapData?.w, 'h =', lobby.mapData?.h);
        lobby.aiGrid = buildBotPathGrid(lobby.mapData);
        initBotsForStart(lobby);
        lobby.players.forEach((p) => {
            p.isInGame = true;
            p.spawnTime = Date.now();
            p.send(
                JSON.stringify({
                    type: ServerMsg.START,
                    team: p.team,
                    playerId: p.id,
                    color: p.color,
                    allPlayers: lobby.players.map((pl) => ({
                        id: pl.id,
                        nick: pl.nickname,
                        team: pl.team,
                        color: pl.color,
                        isBot: Boolean(pl.isBot),
                    })),
                    map: lobby.mapData,
                }),
            );
        });
        if (lobby.players.some((p) => p.isBot)) {
            startAiTick(_wss, lobby);
        }
    }
}

export function handleAddBot(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (!lobby) return;
    if (ws.id !== lobby.hostId) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Only host can add bots' }));
        return;
    }
    if (lobby.gameStarted) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Game already started' }));
        return;
    }
    console.log('[DEBUG] handleAddBot players.length =', lobby.players.length, 'MAX_PLAYERS =', MAX_PLAYERS);
    if (lobby.players.length >= MAX_PLAYERS) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Lobby full' }));
        return;
    }
    const team = typeof data.team === 'number' && (data.team === 1 || data.team === 2) ? data.team : undefined;
    const difficulty = typeof data.difficulty === 'number' ? data.difficulty : 1;
    createBotForLobby(lobby, { team, difficulty });
    broadcastLobbyState(lobby);
    broadcastLobbyList(wss);
}

export function handleRemoveBot(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (!lobby) return;
    if (ws.id !== lobby.hostId) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Only host can remove bots' }));
        return;
    }
    if (lobby.gameStarted) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Game already started' }));
        return;
    }
    const botId = typeof data.botId === 'string' ? data.botId : undefined;
    const index = lobby.players.findIndex((p) => p.isBot && (!botId || p.id === botId));
    if (index === -1) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Bot not found' }));
        return;
    }
    lobby.players.splice(index, 1);
    broadcastLobbyState(lobby);
    broadcastLobbyList(wss);
}
