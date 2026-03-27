import { PLAYER_TANK_COLORS } from '#shared/colors.js';
import { ClientMsg, ServerMsg } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { BRICK_SIZE, FOREST_DETECTION_RADIUS_FACTOR, FOREST_SECTION_SIZE, SMOKE_CLOUD_RADIUS, SPAWN_BOX_SIZE, SPAWN_CELL_SIZE, SPAWN_ORDER, TANK_MAX_HP } from '../constants.js';
import { getTankDef } from '#shared/tankDefs.js';
import { log } from '../logger.js';
import { broadcastGame } from './broadcast.js';
import { handleDealDamage } from './handlers/combat.js';
import { handleState, isTargetVisibleToTeam } from './handlers/gameState.js';
import {
    checkBulletStoneCollision,
    clampTankCenterToMap,
    getTankHullHalfExtents,
    lineBlockedByStones,
    obbIntersectsObb,
    pointInsideObb,
    separateTankFromBricks,
    separateTankFromStones,
    tankBrickCollisionIndex,
    tankStoneCollision,
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

function pickSpawnPoint(lobby: Lobby, team: number, slotIndex?: number): { x: number; y: number; angle: number } {
    const { w, h } = getMapSize(lobby);
    const slot = slotIndex ?? 0;
    const cell = SPAWN_ORDER[slot % SPAWN_ORDER.length];
    const cellCenterX = cell.col * SPAWN_CELL_SIZE + SPAWN_CELL_SIZE / 2;
    const cellCenterY = cell.row * SPAWN_CELL_SIZE + SPAWN_CELL_SIZE / 2;

    let x: number, y: number;
    if (team === 1) {
        // Top-left spawn box
        x = cellCenterX;
        y = cellCenterY;
    } else {
        // Bottom-right spawn box — зеркалим
        x = w - SPAWN_BOX_SIZE + cellCenterX;
        y = h - SPAWN_BOX_SIZE + cellCenterY;
    }
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
        color: PLAYER_TANK_COLORS[Math.floor(Math.random() * PLAYER_TANK_COLORS.length)],
        camo: Math.random() < 0.5 ? 'camouflage1' : 'none',
        tankType: 'medium',
        isInGame: false,
        isBot: true,
        lastPos: { x: 0, y: 0, hp: getTankDef('medium').hp, team: botTeam },
        lastPosAt: 0,
        x: 0,
        y: 0,
        w: getTankDef('medium').w,
        h: getTankDef('medium').h,
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

function getPlayerTeamIndex(lobby: Lobby, player: WebSocket): number {
    let idx = 0;
    for (const p of lobby.players) {
        if (p.team === player.team) {
            if (p.id === player.id) return idx;
            idx++;
        }
    }
    return 0;
}

function setBotSpawnState(bot: WebSocket, lobby: Lobby): void {
    const slot = getPlayerTeamIndex(lobby, bot);
    const spawn = pickSpawnPoint(lobby, bot.team, slot);
    bot.x = spawn.x;
    bot.y = spawn.y;
    bot.angle = spawn.angle;
    bot.turretAngle = spawn.angle;
    bot.vx = 0;
    bot.vy = 0;
    const botDef = getTankDef(bot.tankType);
    bot.hp = botDef.hp;
    bot.spawnTime = Date.now();
    bot.w = botDef.w;
    bot.h = botDef.h;
    bot.lastPos = {
        x: bot.x,
        y: bot.y,
        hp: bot.hp,
        team: bot.team,
    };
    bot.lastPosAt = Date.now();
    clearBotPath(bot);
}

function pointInsideAnyForest(lobby: Lobby, x: number, y: number): boolean {
    const forests = lobby.mapData?.forests || [];
    return forests.some((f) => x >= f.x && x <= f.x + FOREST_SECTION_SIZE && y >= f.y && y <= f.y + FOREST_SECTION_SIZE);
}

function lineCrossesForest(lobby: Lobby, x1: number, y1: number, x2: number, y2: number): boolean {
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

function pointInsideAnySmoke(lobby: Lobby, x: number, y: number, now: number): boolean {
    if (!lobby.smokes) return false;
    for (const s of lobby.smokes) {
        if (s.expiresAt <= now) continue;
        if (Math.hypot(x - s.x, y - s.y) < SMOKE_CLOUD_RADIUS) return true;
    }
    return false;
}

function lineCrossesSmoke(lobby: Lobby, x1: number, y1: number, x2: number, y2: number, now: number): boolean {
    if (!lobby.smokes || lobby.smokes.length === 0) return false;
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

/** Может ли бот видеть цель с учётом леса и дыма. */
function botCanSeeTarget(lobby: Lobby, botX: number, botY: number, targetX: number, targetY: number, dist: number, botTankType?: string): boolean {
    const now = Date.now();
    const forestBetween = lineCrossesForest(lobby, botX, botY, targetX, targetY);
    const botInForest = pointInsideAnyForest(lobby, botX, botY);
    const targetInForest = pointInsideAnyForest(lobby, targetX, targetY);
    const smokeBetween = lineCrossesSmoke(lobby, botX, botY, targetX, targetY, now);
    const botInSmoke = pointInsideAnySmoke(lobby, botX, botY, now);
    const targetInSmoke = pointInsideAnySmoke(lobby, targetX, targetY, now);
    const smallRadius = getTankDef(botTankType).detectionRadius * FOREST_DETECTION_RADIUS_FACTOR;
    if (forestBetween || botInForest || targetInForest || smokeBetween || botInSmoke || targetInSmoke) {
        return dist <= smallRadius;
    }
    return true;
}

function lineBlocked(lobby: Lobby, x1: number, y1: number, x2: number, y2: number): boolean {
    if (!lobby.mapData) return false;
    const bricks = lobby.mapData.bricks;
    if (bricks.length) {
        const distance = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.max(1, Math.ceil(distance / (BRICK_SIZE / 3)));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;
            for (const brick of bricks) {
                if (px >= brick.x && px <= brick.x + BRICK_SIZE && py >= brick.y && py <= brick.y + BRICK_SIZE) {
                    return true;
                }
            }
        }
    }
    const stones = lobby.mapData.stones;
    if (stones?.length && lineBlockedByStones(x1, y1, x2, y2, stones)) return true;
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
    const stones = map.stones || [];
    if (tankBrickCollisionIndex(nextX, bot.y, bot.angle, hw, hh, map.bricks, map.w, map.h) === -1
        && !tankStoneCollision(nextX, bot.y, bot.angle, hw, hh, stones)) {
        bot.x = nextX;
        bot.vx = moveX / dtSec;
        moved = true;
    } else {
        bot.vx = 0;
    }
    if (tankBrickCollisionIndex(bot.x, nextY, bot.angle, hw, hh, map.bricks, map.w, map.h) === -1
        && !tankStoneCollision(bot.x, nextY, bot.angle, hw, hh, stones)) {
        bot.y = nextY;
        bot.vy = moveY / dtSec;
        moved = true;
    } else {
        bot.vy = 0;
    }
    // Боты толкают остовы
    const hulls = lobby.hulls || [];
    const pushedHulls: typeof hulls = [];
    let hitHull = false;
    for (const h of hulls) {
        if (obbIntersectsObb(bot.x, bot.y, bot.angle, hw, hh, h.x, h.y, h.angle, h.w / 2, h.h / 2)) {
            const dx = h.x - bot.x;
            const dy = h.y - bot.y;
            const d = Math.hypot(dx, dy) || 1;
            h.x += (dx / d) * 4;
            h.y += (dy / d) * 4;
            bot.x -= (dx / d) * 2;
            bot.y -= (dy / d) * 2;
            h.x = Math.max(h.w / 2, Math.min(map.w - h.w / 2, h.x));
            h.y = Math.max(h.h / 2, Math.min(map.h - h.h / 2, h.y));
            pushedHulls.push(h);
            hitHull = true;
        }
    }
    if (hitHull) {
        bot.vx *= 0.4;
        bot.vy *= 0.4;
    }
    // Остовы не стакаются
    for (let a = 0; a < hulls.length; a++) {
        for (let b = a + 1; b < hulls.length; b++) {
            if (obbIntersectsObb(hulls[a].x, hulls[a].y, hulls[a].angle, hulls[a].w / 2, hulls[a].h / 2,
                hulls[b].x, hulls[b].y, hulls[b].angle, hulls[b].w / 2, hulls[b].h / 2)) {
                const dx = hulls[b].x - hulls[a].x;
                const dy = hulls[b].y - hulls[a].y;
                const d = Math.hypot(dx, dy) || 1;
                hulls[b].x += (dx / d) * 4;
                hulls[b].y += (dy / d) * 4;
                hulls[a].x -= (dx / d) * 4;
                hulls[a].y -= (dy / d) * 4;
                if (!pushedHulls.includes(hulls[a])) pushedHulls.push(hulls[a]);
                if (!pushedHulls.includes(hulls[b])) pushedHulls.push(hulls[b]);
            }
        }
    }
    for (const h of pushedHulls) {
        broadcastGame(lobby, { type: ServerMsg.HULL_UPDATE, id: h.id, x: h.x, y: h.y, angle: h.angle });
    }

    separateTankFromBricks(bot, map.bricks, map.w, map.h);
    if (map.stones?.length) separateTankFromStones(bot, map.stones);
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
    const isPlayerBullet = bullet.ownerId.startsWith('p_');
    const now = Date.now();
    let hit: WebSocket | null = null;
    lobby.players.forEach((player) => {
        if (hit) return;
        if (player.id === bullet.ownerId || player.team === bullet.ownerTeam || !isAlivePlayer(player)) return;
        const pos = getActorPosition(player);
        if (pos.hp <= 0) return;
        // Для пуль игроков: сервер обрабатывает только попадания по НЕвидимым врагам,
        // видимых обрабатывает клиент через DEAL_DAMAGE
        if (isPlayerBullet && isTargetVisibleToTeam(lobby, player, bullet.ownerTeam, now)) return;
        const hw = (player.w || 75) / 2;
        const hh = (player.h || 45) / 2;
        if (pointInsideObb(bullet.x, bullet.y, pos.x, pos.y, player.angle, hw, hh)) {
            hit = player;
        }
    });
    return hit;
}

function stepBotBullets(wss: WebSocketServer, lobby: Lobby, dtSec: number): void {
    const now = Date.now();
    const bricks = lobby.mapData?.bricks || [];
    for (let i = lobby.aiBullets.length - 1; i >= 0; i--) {
        const bullet = lobby.aiBullets[i];
        bullet.x += bullet.vx * dtSec;
        bullet.y += bullet.vy * dtSec;
        const isPlayerBullet = bullet.ownerId.startsWith('p_');
        if (now - bullet.createdAt >= bullet.ttl) {
            removeBotBullet(lobby, bullet.bulletId);
            continue;
        }
        // Пуля вылетела за карту
        const map = lobby.mapData;
        if (map && (bullet.x < 0 || bullet.x > map.w || bullet.y < 0 || bullet.y > map.h)) {
            if (isPlayerBullet) {
                // Тихо убираем серверную копию — клиент сам обработает
                lobby.aiBullets.splice(i, 1);
            } else {
                removeBotBullet(lobby, bullet.bulletId);
            }
            continue;
        }
        // Пуля попала в кирпич
        const hitBrick = bricks.some((b) =>
            bullet.x >= b.x && bullet.x <= b.x + BRICK_SIZE && bullet.y >= b.y && bullet.y <= b.y + BRICK_SIZE,
        );
        if (hitBrick) {
            if (isPlayerBullet) {
                lobby.aiBullets.splice(i, 1);
            } else {
                removeBotBullet(lobby, bullet.bulletId);
            }
            continue;
        }
        // Пуля попала в камень
        const stones = lobby.mapData?.stones || [];
        if (stones.length && checkBulletStoneCollision(bullet.x, bullet.y, stones)) {
            if (isPlayerBullet) {
                lobby.aiBullets.splice(i, 1);
            } else {
                removeBotBullet(lobby, bullet.bulletId);
            }
            continue;
        }
        // Пуля попала в остов
        const hitHull = (lobby.hulls || []).some((h) =>
            pointInsideObb(bullet.x, bullet.y, h.x, h.y, h.angle, h.w / 2, h.h / 2),
        );
        if (hitHull) {
            if (isPlayerBullet) {
                lobby.aiBullets.splice(i, 1);
            } else {
                removeBotBullet(lobby, bullet.bulletId);
            }
            continue;
        }
        const target = findBulletHitTarget(lobby, bullet);
        if (target) {
            const shooter = lobby.players.find((p) => p.id === bullet.ownerId);
            // Удаляем пулю и оповещаем клиентов
            lobby.aiBullets.splice(i, 1);
            broadcastBulletRemoval(lobby, bullet.bulletId);
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
        if (dist > BOT_VIEW_DISTANCE) return;
        if (!botCanSeeTarget(lobby, bot.x, bot.y, x, y, dist, bot.tankType)) return;
        if (dist < bestDist) {
            best = player;
            bestDist = dist;
        }
    });
    return best;
}

function aimAndMove(bot: WebSocket, target: WebSocket | null, dtSec: number, lobby: Lobby): void {
    const goal = getMovementGoal(bot, lobby, target);
    if (target) {
        const tp = getActorPosition(target);
        const dist = Math.hypot(tp.x - bot.x, tp.y - bot.y);
        const tvx = target.vx ?? 0;
        const tvy = target.vy ?? 0;
        const t = dist / BOT_BULLET_SPEED;
        bot.turretAngle = Math.atan2(tp.y + tvy * t - bot.y, tp.x + tvx * t - bot.x);
    } else {
        bot.turretAngle = Math.atan2(goal.y - bot.y, goal.x - bot.x);
    }
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
    const tx = target.lastPos.x;
    const ty = target.lastPos.y;
    const distance = Math.hypot(tx - bot.x, ty - bot.y);

    // Упреждение: предсказываем позицию врага
    const tvx = target.vx ?? 0;
    const tvy = target.vy ?? 0;
    const flightTime = distance / BOT_BULLET_SPEED;
    const leadX = tx + tvx * flightTime;
    const leadY = ty + tvy * flightTime;

    const aimError = normalizeAngle(Math.atan2(leadY - bot.y, leadX - bot.x) - bot.turretAngle);
    const canSee = !lineBlocked(lobby, bot.x, bot.y, tx, ty)
        && botCanSeeTarget(lobby, bot.x, bot.y, tx, ty, distance, bot.tankType);
    const botDef = getTankDef(bot.tankType);
    const baseReloadMs = botDef.reloadTime * 1000;
    const shotCooldown = Math.max(400, baseReloadMs - difficulty * 120);
    if (distance > BOT_FIRE_DISTANCE || Math.abs(aimError) > BOT_AIM_THRESHOLD || !canSee) return;
    if (now - brain.lastShotAt < shotCooldown) return;

    const bulletId = `bot_b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ownerId = bot.id ?? `bot_${Date.now()}`;
    const leadAngle = Math.atan2(leadY - bot.y, leadX - bot.x);
    const aimAngle = leadAngle + (Math.random() - 0.5) * ((3 - difficulty) * 0.06);
    const vx = Math.cos(aimAngle) * BOT_BULLET_SPEED;
    const vy = Math.sin(aimAngle) * BOT_BULLET_SPEED;
    const botBulletDmg = botDef.bulletDamage;

    brain.lastShotAt = now;
    lobby.aiBullets.push({
        bulletId,
        x: bot.x,
        y: bot.y,
        vx,
        vy,
        ownerId,
        ownerTeam: bot.team,
        damage: botBulletDmg,
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
            damage: botBulletDmg,
            ownerId,
            ownerTeam: bot.team,
            tankType: bot.tankType || 'medium',
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
    if (lobby.aiTickHandle) return;
    lobby.aiTickHandle = setInterval(() => {
        try {
            if (!lobby.gameStarted) {
                stopAiTick(lobby);
                return;
            }
            const dtSec = BOT_TICK_MS / 1000;
            stepBotBullets(wss, lobby, dtSec);
            if (hasBots(lobby)) {
                lobby.players
                    .filter(isBotPlayer)
                    .forEach((bot) => updateBot(wss, lobby, bot, dtSec));
            }
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
    if (lobby.idleTickHandle) { clearInterval(lobby.idleTickHandle); lobby.idleTickHandle = null; }
    if (lobby.botsOnlyCleanupHandle) { clearTimeout(lobby.botsOnlyCleanupHandle); lobby.botsOnlyCleanupHandle = null; }
    lobby.aiBullets = [];
}

export function shouldDeleteLobbyAfterClose(lobby: Lobby): boolean {
    // Есть хотя бы один подключённый (не бот, не призрак) игрок?
    const hasConnected = lobby.players.some((p) => !p.isBot && !p.disconnectedAt);
    if (hasConnected) return false;
    // Если в игре и есть призраки — даём 60 сек на реконнект
    if (lobby.gameStarted) {
        const hasGhost = lobby.players.some((p) => !p.isBot && p.disconnectedAt);
        if (hasGhost) {
            const oldest = Math.min(...lobby.players.filter((p) => !p.isBot && p.disconnectedAt).map((p) => p.disconnectedAt!));
            if (Date.now() - oldest < 60_000) return false;
        }
    }
    return true;
}
