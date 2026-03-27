import { ServerMsg } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { getTankDef } from '#shared/tankDefs.js';
import { broadcastGame } from '../broadcast.js';
import { lobbies } from '../lobbyStore.js';
import { handleDeath } from './gameState.js';

function ensureStats(lobby: (typeof lobbies)[string], id: string) {
    if (!lobby.stats[id]) lobby.stats[id] = { kills: 0, deaths: 0, damageDealt: 0, damageReceived: 0 };
}

export function handleBullet(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        const bulletId = data.bulletId as string;
        const damage = typeof data.damage === 'number' ? data.damage : 35;
        broadcastGame(
            lobby,
            {
                type: ServerMsg.BULLET,
                bulletId,
                x: data.x,
                y: data.y,
                vx: data.vx,
                vy: data.vy,
                damage,
                ownerId: ws.id,
                ownerTeam: ws.team,
                tankType: ws.tankType || 'medium',
            },
            ws,
        );
        // Серверная копия пули — для попаданий по невидимым врагам
        lobby.aiBullets.push({
            bulletId,
            x: data.x as number,
            y: data.y as number,
            vx: data.vx as number,
            vy: data.vy as number,
            ownerId: ws.id ?? '',
            ownerTeam: ws.team,
            damage,
            createdAt: Date.now(),
            ttl: 2400,
        });
    }
}

export function handleBulletRemove(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        // Удаляем серверную копию пули, чтобы сервер больше не отслеживал её
        const bulletId = data.bulletId as string;
        const idx = lobby.aiBullets.findIndex((b) => b.bulletId === bulletId);
        if (idx !== -1) lobby.aiBullets.splice(idx, 1);
        broadcastGame(lobby, { type: ServerMsg.BULLET_REMOVE, bulletId });
    }
}

export function handleDealDamage(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        // Удаляем серверную копию пули — клиент уже обработал попадание.
        // НЕ шлём BULLET_REMOVE — каждый клиент сам обрабатывает пулю в своей симуляции.
        if (data.bulletId) {
            const bulletId = data.bulletId as string;
            const idx = lobby.aiBullets.findIndex((b) => b.bulletId === bulletId);
            if (idx !== -1) lobby.aiBullets.splice(idx, 1);
        }
        const shooter = lobby.players.find((p) => p.id === ws.id);
        const target = lobby.players.find((p) => p.id === data.targetId);
        if (shooter && target && shooter.team !== target.team && target.readyState === 1) {
            const damage = typeof data.damage === 'number' ? data.damage : 0;
            const currentHp = target.lastPos?.hp ?? target.hp ?? 0;
            const nextHp = Math.max(0, currentHp - damage);
            if (target.lastPos) target.lastPos.hp = nextHp;
            if (target.isBot) target.hp = nextHp;
            // Трекинг урона
            const actualDamage = Math.min(damage, currentHp);
            ensureStats(lobby, ws.id!);
            ensureStats(lobby, target.id!);
            lobby.stats[ws.id!].damageDealt += actualDamage;
            lobby.stats[target.id!].damageReceived += actualDamage;
            target._lastAttackerId = ws.id ?? undefined;
            target.send(
                JSON.stringify({
                    type: ServerMsg.BULLET_HIT,
                    damage,
                    hitX: data.hitX,
                    hitY: data.hitY,
                    attackerId: ws.id,
                    targetId: target.id,
                    bulletId: data.bulletId,
                }),
            );
            if (target.isBot && currentHp > 0 && nextHp <= 0) {
                handleDeath(_wss, target, {});
            }
        }
        broadcastGame(lobby, {
            type: ServerMsg.BULLET_HIT_VISUAL,
            hitX: data.hitX,
            hitY: data.hitY,
            targetId: data.targetId,
        });
    }
}

export function handleCollisionDamage(_wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    if (!data.otherId) return;
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        const wsDmg = getTankDef(ws.tankType).collisionDamage;
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: ServerMsg.COLLISION_HIT, damage: wsDmg }));
        }
        const other = lobby.players.find((p) => p.id === data.otherId);
        const otherDmg = other ? getTankDef(other.tankType).collisionDamage : wsDmg;
        if (other && other.readyState === 1) {
            other.send(JSON.stringify({ type: ServerMsg.COLLISION_HIT, damage: otherDmg }));
        }
        // Трекинг урона от столкновения
        ensureStats(lobby, ws.id!);
        lobby.stats[ws.id!].damageReceived += wsDmg;
        if (other) {
            ensureStats(lobby, other.id!);
            lobby.stats[other.id!].damageReceived += otherDmg;
        }
    }
}
