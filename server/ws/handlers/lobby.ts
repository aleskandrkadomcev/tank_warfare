import { ServerMsg } from '#shared/protocol.js';
import { MAX_SCORE, SCORE_LIMITS } from '#shared/map.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { MAX_PLAYERS } from '../../constants.js';
import { generateMapData } from '../../game/mapGenerator.js';
import { buildBotPathGrid } from '../../game/pathfinding.js';
import { isValidColor, sanitizeLobbyName, sanitizeNick } from '../../utils/validation.js';
import { createBotForLobby, initBotsForStart, startAiTick } from '../bots.js';
import { broadcastLobbyList, broadcastLobbyState } from '../broadcast.js';
import { lobbies } from '../lobbyStore.js';
import { broadcastIdlePlayers, IDLE_BROADCAST_INTERVAL } from './gameState.js';

function parseScoreLimit(val: unknown): number {
    const n = typeof val === 'number' ? val : typeof val === 'string' ? parseInt(val, 10) : NaN;
    if (!Number.isFinite(n)) return MAX_SCORE;
    // берём ближайшее допустимое значение
    return (SCORE_LIMITS as readonly number[]).includes(n) ? n : MAX_SCORE;
}

export function handleCreateLobby(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    console.log('[DEBUG] handleCreateLobby data.mapSize =', data.mapSize);
    const lobbyId = Math.floor(Math.random() * 9000 + 1000).toString();
    ws.nickname = sanitizeNick(data.nickname);
    ws.id = `p_${Math.floor(Math.random() * 10000)}`;
    ws.lobbyId = lobbyId;
    ws.team = 1;
    ws.ready = false;
    ws.color = typeof data.color === 'string' ? data.color : '#4CAF50';
    ws.camo = typeof data.camo === 'string' ? data.camo : 'none';
    ws.tankType = typeof data.tankType === 'string' && (data.tankType === 'light' || data.tankType === 'medium' || data.tankType === 'heavy') ? data.tankType : 'medium';
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
        hulls: [],
        detectionVisibleUntil: {},
        smokes: [],
        idleTickHandle: null,
        botsOnlyCleanupHandle: null,
        hostReconnectHandle: null,
        mapSize: typeof data.mapSize === 'string' ? data.mapSize : 'small',
        scoreLimit: parseScoreLimit(data.scoreLimit),
        stats: {},
        roundOver: false,
        countdownHandle: null,
        countdown: 0,
        windAngle: 0,
        gameStartedAt: 0,
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

export function handleRejoinLobby(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobbyId = typeof data.lobbyId === 'string' ? data.lobbyId : '';
    const lobby = lobbyId ? lobbies[lobbyId] : undefined;
    if (!lobby) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Lobby not found' }));
        return;
    }
    const nickname = sanitizeNick(data.nickname);

    // --- Реджойн хоста в лобби ДО начала игры ---
    if (!lobby.gameStarted) {
        const ghost = lobby.players.find(
            (p) => !p.isBot && p.disconnectedAt && p.nickname === nickname && p.id === lobby.hostId,
        );
        if (!ghost) {
            ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'No slot to rejoin' }));
            return;
        }
        // Восстанавливаем WS хоста
        ws.id = ghost.id;
        ws.lobbyId = lobbyId;
        ws.nickname = ghost.nickname;
        ws.team = ghost.team;
        ws.ready = false;
        ws.color = ghost.color;
        ws.camo = ghost.camo;
        ws.tankType = ghost.tankType;
        const idx = lobby.players.indexOf(ghost);
        if (idx !== -1) lobby.players[idx] = ws;
        // Отменяем таймер удаления
        if (lobby.hostReconnectHandle) {
            clearTimeout(lobby.hostReconnectHandle);
            lobby.hostReconnectHandle = null;
        }
        // Отправляем как будто лобби только создано
        ws.send(JSON.stringify({
            type: ServerMsg.LOBBY_CREATED,
            lobbyId,
            playerId: ws.id,
            team: ws.team,
            nickname: ws.nickname,
            color: ws.color,
            isHost: true,
            name: lobby.name,
        }));
        broadcastLobbyState(lobby);
        broadcastLobbyList(wss);
        return;
    }
    // Ищем «призрака» — отключённого игрока с таким же ником
    const ghost = lobby.players.find(
        (p) => !p.isBot && p.disconnectedAt && p.nickname === nickname,
    );
    if (!ghost) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'No slot to rejoin' }));
        return;
    }
    // Переносим данные призрака на новый ws
    ws.id = ghost.id;
    ws.lobbyId = lobbyId;
    ws.nickname = ghost.nickname;
    ws.team = ghost.team;
    ws.ready = true;
    ws.color = ghost.color;
    ws.camo = ghost.camo;
    ws.tankType = ghost.tankType;
    ws.isInGame = true;
    ws.x = ghost.x;
    ws.y = ghost.y;
    ws.angle = ghost.angle;
    ws.turretAngle = ghost.turretAngle;
    ws.vx = ghost.vx;
    ws.vy = ghost.vy;
    ws.hp = ghost.hp;
    ws.spawnTime = ghost.spawnTime;
    ws.lastPos = ghost.lastPos;
    ws.lastPosAt = ghost.lastPosAt;
    ws.w = ghost.w ?? 75;
    ws.h = ghost.h ?? 45;
    ws.healCount = ghost.healCount ?? 0;
    ws.smokeCount = ghost.smokeCount ?? 0;
    ws.mineCount = ghost.mineCount ?? 0;
    ws.rocketCount = ghost.rocketCount ?? 0;
    // Заменяем призрака на живой ws
    const idx = lobby.players.indexOf(ghost);
    if (idx !== -1) lobby.players[idx] = ws;
    // Отменяем таймер удаления «только боты» — человек вернулся
    if (lobby.botsOnlyCleanupHandle) {
        clearTimeout(lobby.botsOnlyCleanupHandle);
        lobby.botsOnlyCleanupHandle = null;
    }
    // Считаем spawnSlot
    let spawnSlot = 0;
    for (const p of lobby.players) {
        if (p.team === ws.team) {
            if (p === ws) break;
            spawnSlot++;
        }
    }
    // Отправляем REJOIN — клиент обработает так же как START
    ws.send(JSON.stringify({
        type: ServerMsg.REJOIN,
        team: ws.team,
        playerId: ws.id,
        color: ws.color,
        camo: ws.camo || 'none',
        tankType: ws.tankType || 'medium',
        scoreLimit: lobby.scoreLimit,
        spawnSlot,
        windAngle: lobby.windAngle,
        hp: ws.hp,
        x: ws.x,
        y: ws.y,
        angle: ws.angle,
        turretAngle: ws.turretAngle,
        healCount: ws.healCount ?? 0,
        smokeCount: ws.smokeCount ?? 0,
        mineCount: ws.mineCount ?? 0,
        rocketCount: ws.rocketCount ?? 0,
        scores: lobby.scores,
        allPlayers: lobby.players.map((pl) => ({
            id: pl.id,
            nick: pl.nickname,
            team: pl.team,
            color: pl.color,
            camo: pl.camo || 'none',
            tankType: pl.tankType || 'medium',
            isBot: Boolean(pl.isBot),
        })),
        map: lobby.mapData,
        // Текущие сущности
        mines: lobby.mines,
        boosts: lobby.boosts,
        hulls: lobby.hulls,
    }));
}

export function handleJoinLobby(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobbyId = typeof data.lobbyId === 'string' ? data.lobbyId : '';
    const lobby = lobbyId ? lobbies[lobbyId] : undefined;
    if (lobby && !lobby.gameStarted && lobby.players.length < MAX_PLAYERS) {
        const nick = sanitizeNick(data.nickname);
        // Если есть ghost-хост с таким же ником — реджойним вместо создания дубля
        const ghost = lobby.players.find(
            (p) => !p.isBot && p.disconnectedAt && p.nickname === nick && p.id === lobby.hostId,
        );
        if (ghost) {
            handleRejoinLobby(wss, ws, { lobbyId, nickname: nick });
            return;
        }
        ws.nickname = nick;
        ws.id = `p_${Math.floor(Math.random() * 10000)}`;
        ws.lobbyId = lobbyId;
        ws.team = 2;
        ws.ready = false;
        ws.color = typeof data.color === 'string' ? data.color : '#f44336';
        ws.camo = typeof data.camo === 'string' ? data.camo : 'none';
        ws.tankType = typeof data.tankType === 'string' && (data.tankType === 'light' || data.tankType === 'medium' || data.tankType === 'heavy') ? data.tankType : 'medium';
        // Новый игрок не готов — отменяем отсчёт если был
        cancelCountdown(lobby);
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
        if (typeof data.camo === 'string') ws.camo = data.camo;
        if (typeof data.tankType === 'string' && (data.tankType === 'light' || data.tankType === 'medium' || data.tankType === 'heavy')) {
            ws.tankType = data.tankType;
        }
        // Хост может менять настройки лобби
        if (ws.id === lobby.hostId) {
            if (data.scoreLimit !== undefined) lobby.scoreLimit = parseScoreLimit(data.scoreLimit);
        }
        broadcastLobbyState(lobby);
    }
}

export function handleChangeTeam(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    const team = typeof data.team === 'number' ? data.team : 0;
    if (lobby && !lobby.gameStarted) {
        const teamCount = lobby.players.filter((p) => p.team === team).length;
        if (teamCount >= 5) return;
        // Хост может перемещать других игроков
        if (typeof data.targetId === 'string' && ws.id === lobby.hostId) {
            const target = lobby.players.find((p) => p.id === data.targetId);
            if (target) {
                target.team = team;
                broadcastLobbyState(lobby);
            }
            return;
        }
        ws.team = team;
        broadcastLobbyState(lobby);
    }
}

function cancelCountdown(lobby: import('../lobbyStore.js').Lobby): void {
    if (lobby.countdownHandle) {
        clearInterval(lobby.countdownHandle);
        lobby.countdownHandle = null;
        lobby.countdown = 0;
    }
}

function broadcastChat(lobby: import('../lobbyStore.js').Lobby, nick: string, text: string, color?: string): void {
    const msg = JSON.stringify({ type: ServerMsg.LOBBY_CHAT, nick, text, color });
    lobby.players.forEach((p) => {
        if (!p.isBot && p.readyState === 1) p.send(msg);
    });
}

export function handleLobbyChat(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (!lobby) return;
    const text = typeof data.text === 'string' ? data.text.trim().slice(0, 200) : '';
    if (!text) return;
    broadcastChat(lobby, ws.nickname || 'Игрок', text);
}

export function handleToggleReady(_wss: WebSocketServer, ws: WebSocket, _data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby && !lobby.gameStarted) {
        // Нельзя снять готовность во время отсчёта
        if (ws.ready && lobby.countdownHandle) return;
        ws.ready = !ws.ready;
        broadcastLobbyState(lobby);
    }
}

function doStartGame(wss: WebSocketServer, lobby: import('../lobbyStore.js').Lobby): void {
    if (lobby.gameStarted) return;
    lobby.gameStarted = true;
    lobby.roundOver = false;
    lobby.gameStartedAt = Date.now();
    const mapSize = lobby.mapSize || 'small';
    console.log('[DEBUG] handleStartGame mapSize =', mapSize);
    lobby.mapData = generateMapData(mapSize);
    lobby.stats = {};
    lobby.players.forEach((p) => {
        lobby.stats[p.id!] = { kills: 0, deaths: 0, damageDealt: 0, damageReceived: 0 };
    });
    console.log('[DEBUG] generated map w =', lobby.mapData?.w, 'h =', lobby.mapData?.h);
    lobby.aiGrid = buildBotPathGrid(lobby.mapData);
    initBotsForStart(lobby);
    lobby.windAngle = Math.random() * Math.PI * 2;
    const windAngle = lobby.windAngle;
    const teamCounters: Record<number, number> = { 1: 0, 2: 0 };
    lobby.players.forEach((p) => {
        p.isInGame = true;
        p.spawnTime = Date.now();
        const spawnSlot = teamCounters[p.team] ?? 0;
        teamCounters[p.team] = spawnSlot + 1;
        p.send(
            JSON.stringify({
                type: ServerMsg.START,
                team: p.team,
                playerId: p.id,
                color: p.color,
                camo: p.camo || 'none',
                tankType: p.tankType || 'medium',
                scoreLimit: lobby.scoreLimit,
                spawnSlot,
                windAngle,
                allPlayers: lobby.players.map((pl) => ({
                    id: pl.id,
                    nick: pl.nickname,
                    team: pl.team,
                    color: pl.color,
                    camo: pl.camo || 'none',
                    tankType: pl.tankType || 'medium',
                    isBot: Boolean(pl.isBot),
                })),
                map: lobby.mapData,
            }),
        );
    });
    startAiTick(wss, lobby);
    if (!lobby.idleTickHandle) {
        lobby.idleTickHandle = setInterval(() => {
            if (!lobby.gameStarted) {
                if (lobby.idleTickHandle) { clearInterval(lobby.idleTickHandle); lobby.idleTickHandle = null; }
                return;
            }
            broadcastIdlePlayers(lobby);
        }, IDLE_BROADCAST_INTERVAL);
    }
}

export function handleStartGame(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (!lobby || ws.id !== lobby.hostId || lobby.gameStarted || lobby.players.length < 1) return;
    // Обновляем mapSize из запроса старта (хост мог поменять в лобби)
    if (typeof data.mapSize === 'string' && ['small', 'medium', 'large', 'huge'].includes(data.mapSize)) {
        lobby.mapSize = data.mapSize;
    }
    // Если уже идёт отсчёт — игнорируем повторное нажатие
    if (lobby.countdownHandle) return;
    // Проверяем, все ли люди готовы
    const humans = lobby.players.filter((p) => !p.isBot);
    const notReady = humans.filter((p) => !p.ready);
    if (notReady.length > 0) {
        const names = notReady.map((p) => p.nickname || 'Игрок').join(', ');
        broadcastChat(lobby, '', `${names} не готов!`, '#b10000');
        return;
    }
    // Все готовы — запускаем 5-секундный отсчёт
    lobby.countdown = 5;
    broadcastChat(lobby, '', 'Игра начнётся через 5...', '#00b604');
    broadcastLobbyState(lobby);
    lobby.countdownHandle = setInterval(() => {
        lobby.countdown--;
        if (lobby.countdown <= 0) {
            cancelCountdown(lobby);
            broadcastChat(lobby, '', 'Бой начался!', '#00b604');
            doStartGame(wss, lobby);
            return;
        }
        broadcastChat(lobby, '', `Игра начнётся через ${lobby.countdown}...`, '#00b604');
        broadcastLobbyState(lobby);
    }, 1000);
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
    // Удаляем последнего бота (или конкретного по id)
    let index = -1;
    for (let i = lobby.players.length - 1; i >= 0; i--) {
        if (lobby.players[i].isBot && (!botId || lobby.players[i].id === botId)) { index = i; break; }
    }
    if (index === -1) {
        ws.send(JSON.stringify({ type: ServerMsg.ERROR, msg: 'Bot not found' }));
        return;
    }
    lobby.players.splice(index, 1);
    broadcastLobbyState(lobby);
    broadcastLobbyList(wss);
}
