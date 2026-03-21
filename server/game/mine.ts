import { BRICK_SIZE } from '../constants.js';
import type { Lobby, LobbyMine } from '../ws/lobbyStore.js';
import { broadcastGame } from '../ws/broadcast.js';
import { ServerMsg } from '#shared/protocol.js';
import { handleDeath } from '../ws/handlers/gameState.js';
import type { WebSocketServer } from 'ws';

export function triggerMine(lobby: Lobby, mine: LobbyMine): void {
    mine.triggered = true;
    broadcastGame(lobby, { type: ServerMsg.MINE_TRIGGERED, mineId: mine.mineId });

    setTimeout(() => {
        const destroyedBricks: { x: number; y: number }[] = [];
        const spawnedBoosts: { x: number; y: number; type: number; id: string }[] = [];

        if (lobby.mapData?.bricks) {
            for (let i = lobby.mapData.bricks.length - 1; i >= 0; i--) {
                const b = lobby.mapData.bricks[i];
                const cx = b.x + BRICK_SIZE / 2;
                const cy = b.y + BRICK_SIZE / 2;
                if (Math.hypot(cx - mine.x, cy - mine.y) < 90) {
                    destroyedBricks.push({ x: b.x, y: b.y });
                    lobby.mapData.bricks.splice(i, 1);
                    if (Math.random() < 0.5) {
                        const bType = Math.floor(Math.random() * 6);
                        const boost = {
                            x: b.x + BRICK_SIZE / 2,
                            y: b.y + BRICK_SIZE / 2,
                            type: bType,
                            id: `b_${Date.now()}${Math.random()}`,
                        };
                        lobby.boosts.push(boost);
                        spawnedBoosts.push(boost);
                    }
                }
            }
        }

        broadcastGame(lobby, {
            type: ServerMsg.EXPLOSION_EVENT,
            x: mine.x,
            y: mine.y,
            radius: 90,
            damage: 50,
            ownerId: mine.owner,
            ownerTeam: mine.ownerTeam,
            destroyedBricks,
            spawnedBoosts,
        });

        lobby.players.forEach((p) => {
            if (p.lastPos && p.lastPos.hp > 0) {
                const dist = Math.hypot(p.lastPos.x - mine.x, p.lastPos.y - mine.y);
                if (dist < 90) {
                    const damage = 50;
                    const nextHp = Math.max(0, p.lastPos.hp - damage);
                    p.lastPos.hp = nextHp;
                    if (p.isBot) {
                        p.hp = nextHp;
                        if (nextHp <= 0) {
                            handleDeath({} as WebSocketServer, p, {});
                        }
                    } else if (p.readyState === 1) {
                        p.send(
                            JSON.stringify({
                                type: ServerMsg.EXPLOSION_DAMAGE,
                                damage,
                                x: mine.x,
                                y: mine.y,
                            }),
                        );
                    }
                }
            }
        });

        broadcastGame(lobby, { type: ServerMsg.MINE_REMOVED, mineId: mine.mineId });
        lobby.mines = lobby.mines.filter((m) => m.mineId !== mine.mineId);
    }, 500);
}
