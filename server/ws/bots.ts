import { ClientMsg, ServerMsg } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { BRICK_SIZE, TANK_MAX_HP } from '../constants.js';
import { log } from '../logger.js';
import { broadcastGame } from './broadcast.js';
import { handleDealDamage } from './handlers/combat.js';
import { handleState } from './handlers/gameState.js';
import {
    clampTankCenterToMap,
    getTankHullHalfExtents,
    separateTankFromBricks,
    tankBrickCollisionIndex,
} from '../game/collision.js';
import { findBotPath, worldToCell } from '../game/pathfinding.js';
import { lobbies, type Lobby, type LobbyBotBullet } from './lobbyStore.js';

/** ~30 тиков/сек — плавнее движение ботов на клиенте. */
const BOT_TICK_MS = Math.round(1000 / 30);
const BOT_VIEW_DISTANCE = 900;
const BOT_FIRE_DISTANCE = 720;
const BOT_AIM_THRESHOLD = 0.25;
const BOT_SHOT_COOLDOWN_MS = 900;
const BOT_SPEED_PER_SEC = 155;
const BOT_TURN_RATE = 3.2;
const BOT_BULLET_SPEED = 1200;
const BOT_BULLET_TTL = 2400;
const BOT_BULLET_HIT_RADIUS = 24;
const BOT_PATH_REBUILD_MS = 900;
const BOT_STUCK_LIMIT = 6;
const BOT_WAYPOINT_REACH = 30;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function normalizeAngle(value: number): number {
    let angle = value;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
}

function pickTeam(lobby: Lobby): number {
    const team1 = lobby.players.filter((p) => p.team === 1).length;
    const team2 = lobby.players.filter((p) => p.team === 2).length;
    return team1 <= team2 ? 1 : 2;
}

function createBotName(lobby: Lobby): string {
    const index = lobby.players.filter((p) => p.isBot).length + 1;
    return `AI-${index}`;
}

function getLobbyId(lobby: Lobby): string | null {
    return Object.keys(lobbies).find((key) => lobbies[key] === lobby) ?? null;
}

function isBotPlayer(player: WebSocket): boolean {
    return Boolean(player.isBot);
}

function isAlivePlayer(player: WebSocket): boolean {
    return !player.lastPos || player.lastPos.hp > 0;
}

function getMapSize(lobby: Lobby): { w: number; h: number } {
    return {
        w: lobby.mapData?.w || 4000,
        h: lobby.mapData?.h || 4000,
    };
}

function getActorPosition(player: WebSocket): { x: number; y: number; hp: number } {
    return {
        x: player.lastPos?.x ?? player.x,
        y: player.lastPos?.y ?? player.y,
        hp: player.lastPos?.hp ?? player.hp,
    };
}

function pickSpawnPoint(lobby: Lobby, team: number): { x: number; y: number; angle: number } {
    const { w, h } = getMapSize(lobby);
    const sectorW = Math.max(150, w / 4);
    const spawnW = Math.max(80, sectorW - 50);
    const x =
        team === 1
            ? Math.random() * spawnW + 50
            : w - (Math.random() * spawnW + 50);
    const y = Math.random() * Math.max(1, h - 100) + 50;
    return {
        x,
        y,
        angle: team === 1 ? 0 : Math.PI,
    };
}

function makeBotActor(lobby: Lobby, team?: number, difficulty = 1): WebSocket {
    const botTeam = team === 1 || team === 2 ? team : pickTeam(lobby);
    const bot = {
        id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        lobbyId: null,
        nickname: createBotName(lobby),
        team: botTeam,
        ready: true,
        color: botTeam === 1 ? '#4CAF50' : '#f44336',
        isInGame: false,
        isBot: true,
        lastPos: { x: 0, y: 0, hp: TANK_MAX_HP, team: botTeam },
        lastPosAt: 0,
        x: 0,
        y: 0,
        w: 75,
        h: 45,
        angle: botTeam === 1 ? 0 : Math.PI,
        turretAngle: botTeam === 1 ? 0 : Math.PI,
        vx: 0,
        vy: 0,
        hp: TANK_MAX_HP,
        spawnTime: Date.now(),
        botDifficulty: clamp(difficulty, 0.5, 3),
        botBrain: {
            targetId: null,
            wanderAngle: Math.random() * Math.PI * 2,
            lastShotAt: 0,
            nextDecisionAt: 0,
            path: [],
            pathKey: '',
            lastPathAt: 0,
            stuckTicks: 0,
        },
        readyState: 1,
        send: () => { },
    } as unknown as WebSocket;
    return bot;
}

function setBotSpawnState(bot: WebSocket, lobby: Lobby): void {
    const spawn = pickSpawnPoint(lobby, bot.team);
    bot.x = spawn.x;
    bot.y = spawn.y;
    bot.angle = spawn.angle;
    bot.turretAngle = spawn.angle;
    bot.vx = 0;
    bot.vy = 0;
    bot.hp = TANK_MAX_HP;
    bot.spawnTime = Date.now();
    bot.w = 75;
    bot.h = 45;
    bot.lastPos = {
        x: bot.x,
        y: bot.y,
        hp: bot.hp,
        team: bot.team,
    };
    bot.lastPosAt = Date.now();
    clearBotPath(bot);
}

function lineBlocked(lobby: Lobby, x1: number, y1: number, x2: number, y2: number): boolean {
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

function clearBotPath(bot: WebSocket): void {
    if (!bot.botBrain) return;
    bot.botBrain.path = [];
    bot.botBrain.pathKey = '';
    bot.botBrain.lastPathAt = 0;
    bot.botBrain.stuckTicks = 0;
}

function getMovementGoal(bot: WebSocket, lobby: Lobby, target: WebSocket | null): { x: number; y: number } {
    if (!target || !target.lastPos) {
        clearBotPath(bot);
        return {
            x: bot.x + Math.cos(bot.botBrain?.wanderAngle ?? 0) * 180,
            y: bot.y + Math.sin(bot.botBrain?.wanderAngle ?? 0) * 180,
        };
    }

    const targetPos = getActorPosition(target);
    if (lineBlocked(lobby, bot.x, bot.y, targetPos.x, targetPos.y)) {
        const grid = lobby.aiGrid;
        if (grid && bot.botBrain) {
            const start = worldToCell(bot.x, bot.y, grid);
            const goal = worldToCell(targetPos.x, targetPos.y, grid);
            const pathKey = `${start.col}:${start.row}->${goal.col}:${goal.row}`;
            const now = Date.now();
            const shouldRebuild =
                bot.botBrain.path.length === 0 ||
                bot.botBrain.pathKey !== pathKey ||
                now - bot.botBrain.lastPathAt > BOT_PATH_REBUILD_MS ||
                bot.botBrain.stuckTicks >= BOT_STUCK_LIMIT;

            if (shouldRebuild) {
                const path = findBotPath(grid, { x: bot.x, y: bot.y }, targetPos);
                bot.botBrain.pathKey = pathKey;
                bot.botBrain.lastPathAt = now;
                bot.botBrain.stuckTicks = 0;
                bot.botBrain.path = path.length > 0 ? path : [{ x: targetPos.x, y: targetPos.y }];
            }

            while (bot.botBrain.path.length > 0) {
                const next = bot.botBrain.path[0];
                if (Math.hypot(next.x - bot.x, next.y - bot.y) <= BOT_WAYPOINT_REACH) {
                    bot.botBrain.path.shift();
                    continue;
                }
                return next;
            }
        }
    }

    clearBotPath(bot);
    return targetPos;
}

function moveBotTowards(bot: WebSocket, goal: { x: number; y: number }, dtSec: number, lobby: Lobby): boolean {
    const map = lobby.mapData;
    if (!map) return false;

    const desiredAngle = Math.atan2(goal.y - bot.y, goal.x - bot.x);
    const angleDiff = normalizeAngle(desiredAngle - bot.angle);
    const turnStep = BOT_TURN_RATE * dtSec;
    bot.angle += clamp(angleDiff, -turnStep, turnStep);

    const distance = Math.hypot(goal.x - bot.x, goal.y - bot.y);
    const speed = BOT_SPEED_PER_SEC * (distance < 120 ? 0.55 : 0.9 + (bot.botDifficulty ?? 1) * 0.08);
    const step = Math.min(distance, speed * dtSec);
    const moveX = Math.cos(bot.angle) * step;
    const moveY = Math.sin(bot.angle) * step;
    const { hw, hh } = getTankHullHalfExtents(bot);

    let moved = false;
    const nextX = bot.x + moveX;
    const nextY = bot.y + moveY;
    if (tankBrickCollisionIndex(nextX, bot.y, bot.angle, hw, hh, map.bricks, map.w, map.h) === -1) {
        bot.x = nextX;
        bot.vx = moveX / dtSec;
        moved = true;
    } else {
        bot.vx = 0;
    }
    if (tankBrickCollisionIndex(bot.x, nextY, bot.angle, hw, hh, map.bricks, map.w, map.h) === -1) {
        bot.y = nextY;
        bot.vy = moveY / dtSec;
        moved = true;
    } else {
        bot.vy = 0;
    }

    separateTankFromBricks(bot, map.bricks, map.w, map.h);
    clampTankCenterToMap(bot, map.w, map.h);
    if (!moved && bot.botBrain) bot.botBrain.stuckTicks += 1;
    if (moved && bot.botBrain) bot.botBrain.stuckTicks = 0;
    bot.lastPos = { x: bot.x, y: bot.y, hp: bot.hp, team: bot.team };
    bot.lastPosAt = Date.now();
    return moved;
}

function broadcastBulletRemoval(lobby: Lobby, bulletId: string): void {
    broadcastGame(lobby, { type: ServerMsg.BULLET_REMOVE, bulletId });
}

function removeBotBullet(lobby: Lobby, bulletId: string): void {
    const index = lobby.aiBullets.findIndex((b) => b.bulletId === bulletId);
    if (index === -1) return;
    lobby.aiBullets.splice(index, 1);
    broadcastBulletRemoval(lobby, bulletId);
}

function findBulletHitTarget(lobby: Lobby, bullet: LobbyBotBullet): WebSocket | null {
    let closest: WebSocket | null = null;
    let closestDist = Infinity;
    lobby.players.forEach((player) => {
        if (player.id === bullet.ownerId || player.team === bullet.ownerTeam || !isAlivePlayer(player)) return;
        const pos = getActorPosition(player);
        if (pos.hp <= 0) return;
        const dist = Math.hypot(pos.x - bullet.x, pos.y - bullet.y);
        if (dist < closestDist) {
            closest = player;
            closestDist = dist;
        }
    });
    return closestDist <= BOT_BULLET_HIT_RADIUS ? closest : null;
}

function stepBotBullets(wss: WebSocketServer, lobby: Lobby, dtSec: number): void {
    const now = Date.now();
    for (let i = lobby.aiBullets.length - 1; i >= 0; i--) {
        const bullet = lobby.aiBullets[i];
        bullet.x += bullet.vx * dtSec;
        bullet.y += bullet.vy * dtSec;
        if (now - bullet.createdAt >= bullet.ttl) {
            removeBotBullet(lobby, bullet.bulletId);
            continue;
        }
        const target = findBulletHitTarget(lobby, bullet);
        if (target) {
            const shooter = lobby.players.find((p) => p.id === bullet.ownerId);
            if (shooter) {
                handleDealDamage(
                    wss,
                    shooter,
                    {
                        type: ClientMsg.DEAL_DAMAGE,
                        targetId: target.id,
                        damage: bullet.damage,
                        hitX: bullet.x,
                        hitY: bullet.y,
                        bulletId: bullet.bulletId,
                    },
                );
            }
            removeBotBullet(lobby, bullet.bulletId);
        }
    }
}

function findTarget(lobby: Lobby, bot: WebSocket): WebSocket | null {
    const now = Date.now();
    let best: WebSocket | null = null;
    let bestDist = Infinity;
    lobby.players.forEach((player) => {
        if (player.id === bot.id || player.team === bot.team || !isAlivePlayer(player)) return;
        if (player.lastPosAt && now - player.lastPosAt > 1000) return;
        const x = player.lastPos?.x ?? player.x;
        const y = player.lastPos?.y ?? player.y;
        const dist = Math.hypot(x - bot.x, y - bot.y);
        if (dist < bestDist) {
            best = player;
            bestDist = dist;
        }
    });
    if (best && bestDist <= BOT_VIEW_DISTANCE) {
        return best;
    }
    return null;
}

function aimAndMove(bot: WebSocket, target: WebSocket | null, dtSec: number, lobby: Lobby): void {
    const goal = getMovementGoal(bot, lobby, target);
    const targetPos = target ? getActorPosition(target) : goal;
    bot.turretAngle = Math.atan2(targetPos.y - bot.y, targetPos.x - bot.x);
    const moved = moveBotTowards(bot, goal, dtSec, lobby);
    if (!moved && bot.botBrain && bot.botBrain.stuckTicks >= BOT_STUCK_LIMIT) {
        bot.botBrain.wanderAngle = Math.random() * Math.PI * 2;
    }
}

function maybeShoot(lobby: Lobby, bot: WebSocket, target: WebSocket | null): void {
    if (!target || !target.lastPos) return;
    const now = Date.now();
    const brain = bot.botBrain;
    if (!brain) return;
    const difficulty = bot.botDifficulty ?? 1;
    const distance = Math.hypot(target.lastPos.x - bot.x, target.lastPos.y - bot.y);
    const aimError = normalizeAngle(Math.atan2(target.lastPos.y - bot.y, target.lastPos.x - bot.x) - bot.turretAngle);
    const canSee = !lineBlocked(lobby, bot.x, bot.y, target.lastPos.x, target.lastPos.y);
    const shotCooldown = Math.max(400, BOT_SHOT_COOLDOWN_MS - difficulty * 120);
    if (distance > BOT_FIRE_DISTANCE || Math.abs(aimError) > BOT_AIM_THRESHOLD || !canSee) return;
    if (now - brain.lastShotAt < shotCooldown) return;

    const bulletId = `bot_b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ownerId = bot.id ?? `bot_${Date.now()}`;
    const aimAngle = bot.turretAngle + (Math.random() - 0.5) * ((3 - (bot.botDifficulty ?? 1)) * 0.06);
    const vx = Math.cos(aimAngle) * BOT_BULLET_SPEED;
    const vy = Math.sin(aimAngle) * BOT_BULLET_SPEED;

    brain.lastShotAt = now;
    lobby.aiBullets.push({
        bulletId,
        x: bot.x,
        y: bot.y,
        vx,
        vy,
        ownerId,
        ownerTeam: bot.team,
        damage: 35,
        createdAt: now,
        ttl: BOT_BULLET_TTL,
    });
    broadcastGame(
        lobby,
        {
            type: ServerMsg.BULLET,
            bulletId,
            x: bot.x,
            y: bot.y,
            vx,
            vy,
            damage: 35,
            ownerId,
            ownerTeam: bot.team,
        },
        bot,
    );
}

function updateBot(wss: WebSocketServer, lobby: Lobby, bot: WebSocket, dtSec: number): void {
    const now = Date.now();
    if (!lobby.gameStarted) return;

    if (bot.hp <= 0) {
        if (now >= bot.spawnTime) {
            setBotSpawnState(bot, lobby);
            handleState(
                wss,
                bot,
                {
                    type: ServerMsg.STATE,
                    x: bot.x,
                    y: bot.y,
                    angle: bot.angle,
                    turretAngle: bot.turretAngle,
                    hp: bot.hp,
                    vx: bot.vx,
                    vy: bot.vy,
                },
            );
        }
        return;
    }

    if (!bot.botBrain) return;
    if (now >= bot.botBrain.nextDecisionAt) {
        const target = findTarget(lobby, bot);
        if (!target) {
            bot.botBrain.wanderAngle = normalizeAngle(bot.botBrain.wanderAngle + (Math.random() - 0.5) * 0.8);
            bot.botBrain.targetId = null;
            clearBotPath(bot);
        } else {
            bot.botBrain.targetId = target.id;
        }
        bot.botBrain.nextDecisionAt = now + 150 + Math.random() * 150;
    }

    const target = bot.botBrain.targetId ? lobby.players.find((p) => p.id === bot.botBrain?.targetId) ?? null : findTarget(lobby, bot);
    aimAndMove(bot, target, dtSec, lobby);
    maybeShoot(lobby, bot, target);

    handleState(
        wss,
        bot,
        {
            type: ServerMsg.STATE,
            x: bot.x,
            y: bot.y,
            angle: bot.angle,
            turretAngle: bot.turretAngle,
            hp: bot.hp,
            vx: bot.vx,
            vy: bot.vy,
        },
    );
}

function hasBots(lobby: Lobby): boolean {
    return lobby.players.some((p) => p.isBot);
}

export function createBotForLobby(lobby: Lobby, options: { team?: number; difficulty?: number } = {}): WebSocket {
    const bot = makeBotActor(lobby, options.team, options.difficulty ?? 1);
    const lobbyId = getLobbyId(lobby);
    bot.lobbyId = lobbyId ?? '';
    lobby.players.push(bot);
    if (lobby.gameStarted && lobby.mapData) {
        setBotSpawnState(bot, lobby);
    }
    return bot;
}

export function removeBotFromLobby(lobby: Lobby, botId?: string): WebSocket | null {
    const index = lobby.players.findIndex((p) => p.isBot && (!botId || p.id === botId));
    if (index === -1) return null;
    const [bot] = lobby.players.splice(index, 1);
    return bot ?? null;
}

export function startAiTick(wss: WebSocketServer, lobby: Lobby): void {
    if (lobby.aiTickHandle || !hasBots(lobby)) return;
    lobby.aiTickHandle = setInterval(() => {
        try {
            if (!lobby.gameStarted) {
                stopAiTick(lobby);
                return;
            }
            if (!hasBots(lobby)) {
                stopAiTick(lobby);
                return;
            }
            const dtSec = BOT_TICK_MS / 1000;
            stepBotBullets(wss, lobby, dtSec);
            lobby.players
                .filter(isBotPlayer)
                .forEach((bot) => updateBot(wss, lobby, bot, dtSec));
        } catch (error) {
            log.error('bot_tick_failed', error);
            stopAiTick(lobby);
        }
    }, BOT_TICK_MS);
}

export function stopAiTick(lobby: Lobby): void {
    if (!lobby.aiTickHandle) return;
    clearInterval(lobby.aiTickHandle);
    lobby.aiTickHandle = null;
}

export function initBotsForStart(lobby: Lobby): void {
    lobby.players.filter(isBotPlayer).forEach((bot) => {
        setBotSpawnState(bot, lobby);
        bot.isInGame = true;
        bot.ready = true;
    });
}

export function onLobbyCleanup(lobby: Lobby): void {
    stopAiTick(lobby);
    lobby.aiBullets = [];
}

export function shouldDeleteLobbyAfterClose(lobby: Lobby): boolean {
    return !lobby.players.some((p) => !p.isBot);
}
