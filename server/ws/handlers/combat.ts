import { ServerMsg } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { COLLISION_DAMAGE } from '../../constants.js';
import { broadcastGame } from '../broadcast.js';
import { lobbies } from '../lobbyStore.js';
import { handleDeath } from './gameState.js';

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
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: ServerMsg.COLLISION_HIT, damage: COLLISION_DAMAGE }));
        }
        const other = lobby.players.find((p) => p.id === data.otherId);
        if (other && other.readyState === 1) {
            other.send(JSON.stringify({ type: ServerMsg.COLLISION_HIT, damage: COLLISION_DAMAGE }));
        }
    }
}
