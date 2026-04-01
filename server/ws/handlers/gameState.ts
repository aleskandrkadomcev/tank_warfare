import { ServerMsg } from '#shared/protocol.js';
import { getTankDef } from '#shared/tankDefs.js';
import type { WebSocket, WebSocketServer } from 'ws';
import {
    BRICK_SIZE,
    DETECTION_MEMORY_MS,
    BUSH_RADIUS,
    FOREST_DETECTION_RADIUS_FACTOR,
    MAX_SCORE,
    SMOKE_CLOUD_RADIUS,
    SPAWN_IMMUNITY_TIME,
} from '../../constants.js';
import { buildBotPathGrid } from '../../game/pathfinding.js';
import { triggerMine } from '../../game/mine.js';
import { broadcastGame, broadcastScores } from '../broadcast.js';
import { lineBlockedByStones, obbIntersectsObb } from '../../game/collision.js';
import { lobbies, type Lobby, type LobbyHull } from '../lobbyStore.js';
import { generateMapData } from '../../game/mapGenerator.js';
import { initBotsForStart, startAiTick, stopAiTick } from '../bots.js';

function pruneExpiredSmokes(lobby: (typeof lobbies)[string], now: number): void {
    lobby.smokes = lobby.smokes.filter((s) => s.expiresAt > now);
}

/** Возвращает облака дыма, покрывающие точку (для исключения «своего» дыма). */
function getSmokesCoveringPoint(lobby: (typeof lobbies)[string], x: number, y: number, now: number) {
    const result: typeof lobby.smokes = [];
    for (const s of lobby.smokes) {
        if (s.expiresAt <= now) continue;
        if (Math.hypot(x - s.x, y - s.y) < SMOKE_CLOUD_RADIUS) result.push(s);
    }
    return result;
}

/** Радиус обнаружения куста пропорционален его scale (0.25→37.5, 0.4→60). */
function bushR(f: { scale?: number }): number {
    return BUSH_RADIUS * ((f.scale ?? 0.25) / 0.25);
}

/** Возвращает кусты, покрывающие точку (для исключения «своего» куста). */
function getForestsCoveringPoint(lobby: (typeof lobbies)[string], x: number, y: number) {
    const forests = lobby.mapData?.forests || [];
    return forests.filter((f) => Math.hypot(x - f.x, y - f.y) < bushR(f));
}

function pointInsideAnySmoke(lobby: (typeof lobbies)[string], x: number, y: number, now: number, exclude?: Set<unknown>): boolean {
    for (const s of lobby.smokes) {
        if (s.expiresAt <= now) continue;
        if (exclude?.has(s)) continue;
        if (Math.hypot(x - s.x, y - s.y) < SMOKE_CLOUD_RADIUS) return true;
    }
    return false;
}

function pointInsideAnyForest(lobby: (typeof lobbies)[string], x: number, y: number, exclude?: Set<unknown>): boolean {
    const forests = lobby.mapData?.forests || [];
    return forests.some((f) => {
        if (exclude?.has(f)) return false;
        return Math.hypot(x - f.x, y - f.y) < bushR(f);
    });
}

/** Сегмент обзора пересекает диск облака дыма (исключая указанные облака). */
function lineCrossesSmokeCloud(lobby: (typeof lobbies)[string], x1: number, y1: number, x2: number, y2: number, now: number, exclude?: Set<unknown>): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 40));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        for (const s of lobby.smokes) {
            if (s.expiresAt <= now) continue;
            if (exclude?.has(s)) continue;
            if (Math.hypot(px - s.x, py - s.y) < SMOKE_CLOUD_RADIUS) return true;
        }
    }
    return false;
}

function lineCrossesForest(lobby: (typeof lobbies)[string], x1: number, y1: number, x2: number, y2: number, exclude?: Set<unknown>): boolean {
    const forests = lobby.mapData?.forests || [];
    if (forests.length === 0) return false;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 40));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        for (const f of forests) {
            if (exclude?.has(f)) continue;
            if (Math.hypot(px - f.x, py - f.y) < bushR(f)) return true;
        }
    }
    return false;
}

function lineBlockedByBricks(lobby: (typeof lobbies)[string], x1: number, y1: number, x2: number, y2: number): boolean {
    if (!lobby.mapData?.bricks?.length) return false;
    const distance = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(distance / (BRICK_SIZE / 3)));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        for (const brick of lobby.mapData.bricks) {
            if (px >= brick.x && px <= brick.x + BRICK_SIZE && py >= brick.y && py <= brick.y + BRICK_SIZE) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Игрок внутри куста/дыма получает преимущество: его собственный куст/дым
 * НЕ ограничивает ему обзор. Но если между ним и врагом есть ДРУГОЙ дым/куст,
 * обзор всё равно режется до малого радиуса.
 */
function canObserverDetectTarget(lobby: (typeof lobbies)[string], observer: WebSocket, target: WebSocket, now: number): boolean {
    if (!observer.lastPos || !target.lastPos) return false;
    if (observer.lastPos.hp <= 0 || target.lastPos.hp <= 0) return false;
    const ox = observer.lastPos.x;
    const oy = observer.lastPos.y;
    const tx = target.lastPos.x;
    const ty = target.lastPos.y;
    const dist = Math.hypot(tx - ox, ty - oy);
    const obsRadius = getTankDef(observer.tankType).detectionRadius;
    if (dist > obsRadius) return false;
    if (lineBlockedByBricks(lobby, ox, oy, tx, ty)) return false;
    if (lobby.mapData?.stones?.length && lineBlockedByStones(ox, oy, tx, ty, lobby.mapData.stones)) return false;

    // Собираем дымы и кусты, в которых стоит наблюдатель — они ему НЕ мешают
    const observerSmokes = getSmokesCoveringPoint(lobby, ox, oy, now);
    const observerForests = getForestsCoveringPoint(lobby, ox, oy);
    const excluded: Set<unknown> = new Set([...observerSmokes, ...observerForests]);

    // Все проверки — с исключением «своих» объектов наблюдателя
    const smokeBetween = lineCrossesSmokeCloud(lobby, ox, oy, tx, ty, now, excluded);
    const targetInSmoke = pointInsideAnySmoke(lobby, tx, ty, now, excluded);
    const forestBetween = lineCrossesForest(lobby, ox, oy, tx, ty, excluded);
    const targetInForest = pointInsideAnyForest(lobby, tx, ty, excluded);

    if (smokeBetween || targetInSmoke || forestBetween || targetInForest) {
        if (dist > obsRadius * FOREST_DETECTION_RADIUS_FACTOR) return false;
    }
    return true;
}

export function isTargetVisibleToTeam(lobby: (typeof lobbies)[string], target: WebSocket, team: number, now: number): boolean {
    const key = `${team}:${target.id}`;
    /** Союзники того же `team`, включая ботов: боты тоже «засекают» врагов для команды. */
    const teamCanSeeNow = lobby.players.some(
        (p) => p.team === team && canObserverDetectTarget(lobby, p, target, now),
    );
    if (teamCanSeeNow) {
        lobby.detectionVisibleUntil[key] = now + DETECTION_MEMORY_MS;
        return true;
    }
    return (lobby.detectionVisibleUntil[key] ?? 0) >= now;
}

/** Толкает остовы от танка. Возвращает массив сдвинутых hull. */
function pushHullsFromTank(lobby: Lobby, tx: number, ty: number, tAngle: number, tw: number, th: number): LobbyHull[] {
    const pushed: LobbyHull[] = [];
    const thw = tw / 2;
    const thh = th / 2;
    const map = lobby.mapData;
    for (const hull of lobby.hulls) {
        if (!obbIntersectsObb(tx, ty, tAngle, thw, thh, hull.x, hull.y, hull.angle, hull.w / 2, hull.h / 2)) continue;
        const dx = hull.x - tx;
        const dy = hull.y - ty;
        const d = Math.hypot(dx, dy) || 1;
        hull.x += (dx / d) * 4;
        hull.y += (dy / d) * 4;
        if (map) {
            hull.x = Math.max(hull.w / 2, Math.min(map.w - hull.w / 2, hull.x));
            hull.y = Math.max(hull.h / 2, Math.min(map.h - hull.h / 2, hull.y));
        }
        pushed.push(hull);
    }
    // Остовы не стакаются — расталкиваем друг от друга
    for (let a = 0; a < lobby.hulls.length; a++) {
        const ha = lobby.hulls[a];
        for (let b = a + 1; b < lobby.hulls.length; b++) {
            const hb = lobby.hulls[b];
            if (obbIntersectsObb(ha.x, ha.y, ha.angle, ha.w / 2, ha.h / 2, hb.x, hb.y, hb.angle, hb.w / 2, hb.h / 2)) {
                const dx = hb.x - ha.x;
                const dy = hb.y - ha.y;
                const d = Math.hypot(dx, dy) || 1;
                hb.x += (dx / d) * 4;
                hb.y += (dy / d) * 4;
                ha.x -= (dx / d) * 4;
                ha.y -= (dy / d) * 4;
                if (map) {
                    ha.x = Math.max(ha.w / 2, Math.min(map.w - ha.w / 2, ha.x));
                    ha.y = Math.max(ha.h / 2, Math.min(map.h - ha.h / 2, ha.y));
                    hb.x = Math.max(hb.w / 2, Math.min(map.w - hb.w / 2, hb.x));
                    hb.y = Math.max(hb.h / 2, Math.min(map.h - hb.h / 2, hb.y));
                }
                if (!pushed.includes(ha)) pushed.push(ha);
                if (!pushed.includes(hb)) pushed.push(hb);
            }
        }
    }
    return pushed;
}

export function handleState(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted && !lobby.roundOver) {
        const now = Date.now();
        if (!lobby.smokes) lobby.smokes = [];
        pruneExpiredSmokes(lobby, now);

        ws.x = data.x as number;
        ws.y = data.y as number;
        ws.angle = data.angle as number;
        ws.turretAngle = data.turretAngle as number;
        ws.vx = data.vx as number;
        ws.vy = data.vy as number;
        ws.hp = data.hp as number;
        if (data.healCount !== undefined) ws.healCount = data.healCount as number;
        if (data.smokeCount !== undefined) ws.smokeCount = data.smokeCount as number;
        if (data.mineCount !== undefined) ws.mineCount = data.mineCount as number;
        if (data.rocketCount !== undefined) ws.rocketCount = data.rocketCount as number;
        ws.lastPos = {
            x: data.x as number,
            y: data.y as number,
            hp: data.hp as number,
            team: ws.team,
        };
        ws.lastPosAt = Date.now();

        // Толкаем остовы
        if (lobby.hulls && lobby.hulls.length > 0 && ws.hp > 0) {
            const pushed = pushHullsFromTank(lobby, ws.x, ws.y, ws.angle ?? 0, ws.w ?? 75, ws.h ?? 45);
            if (pushed.length > 0) {
                for (const h of pushed) {
                    broadcastGame(lobby, { type: ServerMsg.HULL_UPDATE, id: h.id, x: h.x, y: h.y, angle: h.angle });
                }
                // Сервер говорит клиенту: ты толкнул остов — замедлись
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ type: ServerMsg.HULL_SLOW }));
                }
            }
        }

        if (lobby.mines) {
            lobby.mines.forEach((mine) => {
                if (mine.triggered) return;
                const mineOwner = lobby.players.find((p) => p.id === mine.owner);
                if (ws.lastPos && mineOwner && mineOwner.team !== ws.team && ws.lastPos.hp > 0) {
                    if (Math.hypot(ws.lastPos.x - mine.x, ws.lastPos.y - mine.y) < 90) {
                        triggerMine(lobby, mine);
                    }
                }
            });
        }

        const statePayload = {
            type: ServerMsg.STATE,
            id: ws.id,
            team: ws.team,
            color: ws.color,
            x: data.x,
            y: data.y,
            angle: data.angle,
            turretAngle: data.turretAngle,
            hp: data.hp,
            vx: data.vx,
            vy: data.vy,
            w: ws.w,
            h: ws.h,
            tankType: ws.tankType || 'medium',
            spawnImmunityTimer: Math.max(0, SPAWN_IMMUNITY_TIME - (now - ws.spawnTime) / 1000),
        };

        lobby.players.forEach((recipient) => {
            if (recipient === ws || recipient.readyState !== 1) return;
            if (recipient.team === ws.team) {
                recipient.send(JSON.stringify(statePayload));
                return;
            }
            if (isTargetVisibleToTeam(lobby, ws, recipient.team, now)) {
                recipient.send(JSON.stringify(statePayload));
            }
        });
    }
}

/**
 * Периодически рассылает STATE неактивных (свернувших браузер) игроков,
 * чтобы они не пропадали с карты у других.
 */
const IDLE_BROADCAST_INTERVAL = 500; // мс
const IDLE_THRESHOLD = 1000; // считаем idle после 1 сек без STATE

export function broadcastIdlePlayers(lobby: Lobby): void {
    const now = Date.now();
    lobby.players.forEach((ws) => {
        if (ws.isBot) return; // боты обновляются через bots.ts
        if (!ws.lastPos || ws.lastPos.hp <= 0) return;
        if (now - ws.lastPosAt < IDLE_THRESHOLD) return; // активен — уже шлёт сам

        const statePayload = {
            type: ServerMsg.STATE,
            id: ws.id,
            team: ws.team,
            color: ws.color,
            x: ws.x,
            y: ws.y,
            angle: ws.angle ?? 0,
            turretAngle: ws.turretAngle ?? 0,
            hp: ws.hp,
            vx: 0,
            vy: 0,
            w: ws.w,
            h: ws.h,
            tankType: ws.tankType || 'medium',
            spawnImmunityTimer: Math.max(0, SPAWN_IMMUNITY_TIME - (now - ws.spawnTime) / 1000),
        };

        lobby.players.forEach((recipient) => {
            if (recipient === ws || recipient.readyState !== 1) return;
            if (recipient.team === ws.team) {
                recipient.send(JSON.stringify(statePayload));
                return;
            }
            if (isTargetVisibleToTeam(lobby, ws, recipient.team, now)) {
                recipient.send(JSON.stringify(statePayload));
            }
        });
    });
}

export { IDLE_BROADCAST_INTERVAL };

export function handleRestartMatch(wss: WebSocketServer, ws: WebSocket, _data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby && ws.id === lobby.hostId) {
        lobby.scores = { 1: 0, 2: 0 };
        lobby.mines = [];
        lobby.boosts = [];
        lobby.rockets = [];
        lobby.aiBullets = [];
        lobby.hulls = [];
        lobby.roundOver = false;
        // Перегенерируем карту
        const mapSize = lobby.mapSize || 'small';
        lobby.mapData = generateMapData(mapSize);
        lobby.aiGrid = lobby.mapData ? buildBotPathGrid(lobby.mapData) : null;
        lobby.detectionVisibleUntil = {};
        lobby.smokes = [];
        // Сброс статистики
        lobby.stats = {};
        lobby.players.forEach((p) => {
            p.spawnTime = Date.now();
            p._lastAttackerId = undefined;
            lobby.stats[p.id!] = { kills: 0, deaths: 0, damageDealt: 0, damageReceived: 0 };
        });
        // Перезапускаем ботов
        initBotsForStart(lobby);
        stopAiTick(lobby);
        startAiTick(wss, lobby);
        broadcastScores(lobby);
        broadcastGame(lobby, { type: ServerMsg.RESTART_MATCH, map: lobby.mapData });
    }
}

export function handleDeath(_wss: WebSocketServer, ws: WebSocket, _data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted && !lobby.roundOver) {
        ws.hp = 0;
        if (ws.lastPos) ws.lastPos.hp = 0;
        ws.spawnTime = Date.now() + 2000;

        // Остов мёртвого танка
        const hullX = ws.lastPos?.x ?? ws.x;
        const hullY = ws.lastPos?.y ?? ws.y;
        const hull = {
            id: `hull_${ws.id}_${Date.now()}`,
            x: hullX,
            y: hullY,
            angle: ws.angle ?? 0,
            w: 75,
            h: 45,
        };
        lobby.hulls.push(hull);
        broadcastGame(lobby, { type: ServerMsg.HULL_SPAWN, ...hull });

        // Статистика: смерть
        if (lobby.stats[ws.id!]) lobby.stats[ws.id!].deaths++;

        const enemyTeam = ws.team === 1 ? 2 : 1;
        lobby.scores[enemyTeam]++;

        // Статистика: +1 kill ко всем живым врагам (последний стрелявший неизвестен — считаем команде)
        // Для простоты: если есть lastAttacker на ws, считаем его
        if (ws._lastAttackerId && lobby.stats[ws._lastAttackerId]) {
            lobby.stats[ws._lastAttackerId].kills++;
        }

        broadcastScores(lobby);

        const limit = lobby.scoreLimit ?? MAX_SCORE;
        const gameOver = (lobby.scores[1] >= limit && lobby.scores[2] >= limit) || lobby.scores[enemyTeam] >= limit;
        if (gameOver) {
            lobby.roundOver = true;
            stopAiTick(lobby);
            const winner = (lobby.scores[1] >= limit && lobby.scores[2] >= limit) ? 0 : enemyTeam;
            // Формируем статистику для клиента
            const playerStats = lobby.players.map((p) => ({
                id: p.id,
                nick: p.nickname || 'Bot',
                team: p.team,
                ...(lobby.stats[p.id!] || { kills: 0, deaths: 0, damageDealt: 0, damageReceived: 0 }),
            }));
            broadcastGame(lobby, { type: ServerMsg.GAME_OVER, winner, stats: playerStats });
        } else {
            broadcastGame(lobby, { type: ServerMsg.PLAYER_DIED, playerId: ws.id, x: hullX, y: hullY });
        }
    }
}
