import { ServerMsg } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import {
    BRICK_SIZE,
    DETECTION_MEMORY_MS,
    DETECTION_RADIUS,
    DETECTION_RADIUS_SMALL,
    FOREST_SECTION_SIZE,
    MAX_SCORE,
    SMOKE_CLOUD_RADIUS,
    SPAWN_IMMUNITY_TIME,
} from '../../constants.js';
import { buildBotPathGrid } from '../../game/pathfinding.js';
import { triggerMine } from '../../game/mine.js';
import { broadcastGame, broadcastScores } from '../broadcast.js';
import { lobbies } from '../lobbyStore.js';

function pruneExpiredSmokes(lobby: (typeof lobbies)[string], now: number): void {
    lobby.smokes = lobby.smokes.filter((s) => s.expiresAt > now);
}

function pointInsideAnySmoke(lobby: (typeof lobbies)[string], x: number, y: number, now: number): boolean {
    for (const s of lobby.smokes) {
        if (s.expiresAt <= now) continue;
        if (Math.hypot(x - s.x, y - s.y) < SMOKE_CLOUD_RADIUS) return true;
    }
    return false;
}

function pointInsideAnyForest(lobby: (typeof lobbies)[string], x: number, y: number): boolean {
    const forests = lobby.mapData?.forests || [];
    return forests.some((f) => x >= f.x && x <= f.x + FOREST_SECTION_SIZE && y >= f.y && y <= f.y + FOREST_SECTION_SIZE);
}

/** Сегмент обзора пересекает диск облака дыма (игроки могут быть снаружи, дым между ними). */
function lineCrossesSmokeCloud(lobby: (typeof lobbies)[string], x1: number, y1: number, x2: number, y2: number, now: number): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 40));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        for (const s of lobby.smokes) {
            if (s.expiresAt <= now) continue;
            if (Math.hypot(px - s.x, py - s.y) < SMOKE_CLOUD_RADIUS) return true;
        }
    }
    return false;
}

function lineCrossesForest(lobby: (typeof lobbies)[string], x1: number, y1: number, x2: number, y2: number): boolean {
    const forests = lobby.mapData?.forests || [];
    if (forests.length === 0) return false;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 40));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        for (const f of forests) {
            if (px >= f.x && px <= f.x + FOREST_SECTION_SIZE && py >= f.y && py <= f.y + FOREST_SECTION_SIZE) return true;
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

function canObserverDetectTarget(lobby: (typeof lobbies)[string], observer: WebSocket, target: WebSocket, now: number): boolean {
    if (!observer.lastPos || !target.lastPos) return false;
    if (observer.lastPos.hp <= 0 || target.lastPos.hp <= 0) return false;
    const ox = observer.lastPos.x;
    const oy = observer.lastPos.y;
    const tx = target.lastPos.x;
    const ty = target.lastPos.y;
    const dist = Math.hypot(tx - ox, ty - oy);
    if (dist > DETECTION_RADIUS) return false;
    if (lineBlockedByBricks(lobby, ox, oy, tx, ty)) return false;

    const smokeBetween = lineCrossesSmokeCloud(lobby, ox, oy, tx, ty, now);
    const observerInSmoke = pointInsideAnySmoke(lobby, ox, oy, now);
    const targetInSmoke = pointInsideAnySmoke(lobby, tx, ty, now);
    const forestBetween = lineCrossesForest(lobby, ox, oy, tx, ty);
    const observerInForest = pointInsideAnyForest(lobby, ox, oy);
    const targetInForest = pointInsideAnyForest(lobby, tx, ty);
    if (smokeBetween || observerInSmoke || targetInSmoke || forestBetween || observerInForest || targetInForest) {
        if (dist > DETECTION_RADIUS_SMALL) return false;
    }
    return true;
}

function isTargetVisibleToTeam(lobby: (typeof lobbies)[string], target: WebSocket, team: number, now: number): boolean {
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

export function handleState(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
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
        ws.lastPos = {
            x: data.x as number,
            y: data.y as number,
            hp: data.hp as number,
            team: ws.team,
        };
        ws.lastPosAt = Date.now();

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

export function handleRestartMatch(_wss: WebSocketServer, ws: WebSocket, _data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby && ws.id === lobby.hostId) {
        lobby.scores = { 1: 0, 2: 0 };
        lobby.mines = [];
        lobby.boosts = [];
        lobby.rockets = [];
        lobby.aiBullets = [];
        lobby.aiGrid = lobby.mapData ? buildBotPathGrid(lobby.mapData) : null;
        lobby.detectionVisibleUntil = {};
        lobby.smokes = [];
        lobby.players.forEach((p) => {
            p.spawnTime = Date.now();
        });
        broadcastScores(lobby);
        broadcastGame(lobby, { type: ServerMsg.RESTART_MATCH, map: lobby.mapData });
    }
}

export function handleDeath(_wss: WebSocketServer, ws: WebSocket, _data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        ws.hp = 0;
        if (ws.lastPos) ws.lastPos.hp = 0;
        ws.spawnTime = Date.now() + 2000;
        const enemyTeam = ws.team === 1 ? 2 : 1;
        lobby.scores[enemyTeam]++;
        broadcastScores(lobby);

        if (lobby.scores[1] >= MAX_SCORE && lobby.scores[2] >= MAX_SCORE) {
            broadcastGame(lobby, { type: ServerMsg.GAME_OVER, winner: 0 });
        } else if (lobby.scores[enemyTeam] >= MAX_SCORE) {
            broadcastGame(lobby, { type: ServerMsg.GAME_OVER, winner: enemyTeam });
        } else {
            broadcastGame(lobby, { type: ServerMsg.PLAYER_DIED, playerId: ws.id });
        }
    }
}
