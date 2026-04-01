import { ServerMsg } from '#shared/protocol.js';
import { BRICK_SIZE, DETECTION_MEMORY_MS, DETECTION_RADIUS, DETECTION_RADIUS_SMALL, FOREST_SECTION_SIZE, MAX_SCORE, SMOKE_CLOUD_RADIUS, SPAWN_IMMUNITY_TIME, } from '../../constants.js';
import { buildBotPathGrid } from '../../game/pathfinding.js';
import { triggerMine } from '../../game/mine.js';
import { broadcastGame, broadcastScores } from '../broadcast.js';
import { obbIntersectsObb } from '../../game/collision.js';
import { lobbies } from '../lobbyStore.js';
function pruneExpiredSmokes(lobby, now) {
    lobby.smokes = lobby.smokes.filter((s) => s.expiresAt > now);
}
function pointInsideAnySmoke(lobby, x, y, now) {
    for (const s of lobby.smokes) {
        if (s.expiresAt <= now)
            continue;
        if (Math.hypot(x - s.x, y - s.y) < SMOKE_CLOUD_RADIUS)
            return true;
    }
    return false;
}
function pointInsideAnyForest(lobby, x, y) {
    const forests = lobby.mapData?.forests || [];
    return forests.some((f) => x >= f.x && x <= f.x + FOREST_SECTION_SIZE && y >= f.y && y <= f.y + FOREST_SECTION_SIZE);
}
/** Сегмент обзора пересекает диск облака дыма (игроки могут быть снаружи, дым между ними). */
function lineCrossesSmokeCloud(lobby, x1, y1, x2, y2, now) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 40));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        for (const s of lobby.smokes) {
            if (s.expiresAt <= now)
                continue;
            if (Math.hypot(px - s.x, py - s.y) < SMOKE_CLOUD_RADIUS)
                return true;
        }
    }
    return false;
}
function lineCrossesForest(lobby, x1, y1, x2, y2) {
    const forests = lobby.mapData?.forests || [];
    if (forests.length === 0)
        return false;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / 40));
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        for (const f of forests) {
            if (px >= f.x && px <= f.x + FOREST_SECTION_SIZE && py >= f.y && py <= f.y + FOREST_SECTION_SIZE)
                return true;
        }
    }
    return false;
}
function lineBlockedByBricks(lobby, x1, y1, x2, y2) {
    if (!lobby.mapData?.bricks?.length)
        return false;
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
function canObserverDetectTarget(lobby, observer, target, now) {
    if (!observer.lastPos || !target.lastPos)
        return false;
    if (observer.lastPos.hp <= 0 || target.lastPos.hp <= 0)
        return false;
    const ox = observer.lastPos.x;
    const oy = observer.lastPos.y;
    const tx = target.lastPos.x;
    const ty = target.lastPos.y;
    const dist = Math.hypot(tx - ox, ty - oy);
    if (dist > DETECTION_RADIUS)
        return false;
    if (lineBlockedByBricks(lobby, ox, oy, tx, ty))
        return false;
    const smokeBetween = lineCrossesSmokeCloud(lobby, ox, oy, tx, ty, now);
    const observerInSmoke = pointInsideAnySmoke(lobby, ox, oy, now);
    const targetInSmoke = pointInsideAnySmoke(lobby, tx, ty, now);
    const forestBetween = lineCrossesForest(lobby, ox, oy, tx, ty);
    const observerInForest = pointInsideAnyForest(lobby, ox, oy);
    const targetInForest = pointInsideAnyForest(lobby, tx, ty);
    if (smokeBetween || observerInSmoke || targetInSmoke || forestBetween || observerInForest || targetInForest) {
        if (dist > DETECTION_RADIUS_SMALL)
            return false;
    }
    return true;
}
export function isTargetVisibleToTeam(lobby, target, team, now) {
    const key = `${team}:${target.id}`;
    /** Союзники того же `team`, включая ботов: боты тоже «засекают» врагов для команды. */
    const teamCanSeeNow = lobby.players.some((p) => p.team === team && canObserverDetectTarget(lobby, p, target, now));
    if (teamCanSeeNow) {
        lobby.detectionVisibleUntil[key] = now + DETECTION_MEMORY_MS;
        return true;
    }
    return (lobby.detectionVisibleUntil[key] ?? 0) >= now;
}
/** Толкает остовы от танка. Возвращает массив сдвинутых hull. */
function pushHullsFromTank(lobby, tx, ty, tAngle, tw, th) {
    const pushed = [];
    const thw = tw / 2;
    const thh = th / 2;
    const map = lobby.mapData;
    for (const hull of lobby.hulls) {
        if (!obbIntersectsObb(tx, ty, tAngle, thw, thh, hull.x, hull.y, hull.angle, hull.w / 2, hull.h / 2))
            continue;
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
                if (!pushed.includes(ha))
                    pushed.push(ha);
                if (!pushed.includes(hb))
                    pushed.push(hb);
            }
        }
    }
    return pushed;
}
export function handleState(_wss, ws, data) {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        const now = Date.now();
        if (!lobby.smokes)
            lobby.smokes = [];
        pruneExpiredSmokes(lobby, now);
        ws.x = data.x;
        ws.y = data.y;
        ws.angle = data.angle;
        ws.turretAngle = data.turretAngle;
        ws.vx = data.vx;
        ws.vy = data.vy;
        ws.hp = data.hp;
        ws.lastPos = {
            x: data.x,
            y: data.y,
            hp: data.hp,
            team: ws.team,
        };
        ws.lastPosAt = Date.now();
        // Толкаем остовы
        if (lobby.hulls && lobby.hulls.length > 0 && ws.hp > 0) {
            const pushed = pushHullsFromTank(lobby, ws.x, ws.y, ws.angle ?? 0, ws.w ?? 75, ws.h ?? 45);
            for (const h of pushed) {
                broadcastGame(lobby, { type: ServerMsg.HULL_UPDATE, id: h.id, x: h.x, y: h.y, angle: h.angle });
            }
        }
        if (lobby.mines) {
            lobby.mines.forEach((mine) => {
                if (mine.triggered)
                    return;
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
            if (recipient === ws || recipient.readyState !== 1)
                return;
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
export function handleRestartMatch(_wss, ws, _data) {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby && ws.id === lobby.hostId) {
        lobby.scores = { 1: 0, 2: 0 };
        lobby.mines = [];
        lobby.boosts = [];
        lobby.rockets = [];
        lobby.aiBullets = [];
        lobby.hulls = [];
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
export function handleDeath(_wss, ws, _data) {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        ws.hp = 0;
        if (ws.lastPos)
            ws.lastPos.hp = 0;
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
        const enemyTeam = ws.team === 1 ? 2 : 1;
        lobby.scores[enemyTeam]++;
        broadcastScores(lobby);
        const limit = lobby.scoreLimit ?? MAX_SCORE;
        if (lobby.scores[1] >= limit && lobby.scores[2] >= limit) {
            broadcastGame(lobby, { type: ServerMsg.GAME_OVER, winner: 0 });
        }
        else if (lobby.scores[enemyTeam] >= limit) {
            broadcastGame(lobby, { type: ServerMsg.GAME_OVER, winner: enemyTeam });
        }
        else {
            broadcastGame(lobby, { type: ServerMsg.PLAYER_DIED, playerId: ws.id, x: hullX, y: hullY });
        }
    }
}
//# sourceMappingURL=gameState.js.map