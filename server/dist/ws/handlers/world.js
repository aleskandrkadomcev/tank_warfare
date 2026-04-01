import { ServerMsg } from '#shared/protocol.js';
import { BRICK_SIZE, SMOKE_LIFETIME_MS } from '../../constants.js';
import { buildBotPathGrid } from '../../game/pathfinding.js';
import { broadcastGame } from '../broadcast.js';
import { lobbies } from '../lobbyStore.js';
import { handleDeath } from './gameState.js';
function runRocketExplosion(lobby, rocket) {
    if (!lobby.gameStarted || rocket.exploded)
        return;
    rocket.exploded = true;
    lobby.rockets = lobby.rockets.filter((r) => r.id !== rocket.id);
    const destroyedBricks = [];
    const spawnedBoosts = [];
    if (lobby.mapData?.bricks) {
        for (let i = lobby.mapData.bricks.length - 1; i >= 0; i--) {
            const b = lobby.mapData.bricks[i];
            const cx = b.x + BRICK_SIZE / 2;
            const cy = b.y + BRICK_SIZE / 2;
            if (Math.hypot(cx - rocket.tx, cy - rocket.ty) < 90) {
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
    lobby.aiGrid = lobby.mapData ? buildBotPathGrid(lobby.mapData) : null;
    broadcastGame(lobby, {
        type: ServerMsg.EXPLOSION_EVENT,
        x: rocket.tx,
        y: rocket.ty,
        radius: 90,
        damage: 50,
        ownerId: rocket.ownerId,
        ownerTeam: rocket.ownerTeam,
        rocketId: rocket.id,
        destroyedBricks,
        spawnedBoosts,
    });
    lobby.players.forEach((p) => {
        if (p.lastPos && p.lastPos.hp > 0) {
            const dist = Math.hypot(p.lastPos.x - rocket.tx, p.lastPos.y - rocket.ty);
            if (dist < 90) {
                const damage = 50;
                const nextHp = Math.max(0, p.lastPos.hp - damage);
                p.lastPos.hp = nextHp;
                if (p.isBot) {
                    p.hp = nextHp;
                    if (nextHp <= 0) {
                        handleDeath({}, p, {});
                    }
                }
                else if (p.readyState === 1) {
                    p.send(JSON.stringify({
                        type: ServerMsg.EXPLOSION_DAMAGE,
                        damage,
                        x: rocket.tx,
                        y: rocket.ty,
                        rocketId: rocket.id,
                    }));
                }
            }
        }
    });
}
export function handleDeployMine(_wss, ws, data) {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        const mine = {
            mineId: Date.now() + Math.random(),
            x: data.x,
            y: data.y,
            owner: ws.id,
            ownerTeam: ws.team,
            triggered: false,
        };
        lobby.mines.push(mine);
        broadcastGame(lobby, {
            type: ServerMsg.DEPLOY_MINE,
            x: data.x,
            y: data.y,
            ownerId: ws.id,
            ownerTeam: ws.team,
            mineId: mine.mineId,
        });
    }
}
export function handleLaunchRocket(_wss, ws, data) {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        const rocket = {
            id: `r_${Date.now()}${Math.random()}`,
            tx: data.tx,
            ty: data.ty,
            ownerId: ws.id,
            ownerTeam: ws.team,
            startTime: Date.now(),
            exploded: false,
        };
        lobby.rockets.push(rocket);
        broadcastGame(lobby, {
            type: ServerMsg.LAUNCH_ROCKET,
            tx: data.tx,
            ty: data.ty,
            ownerId: ws.id,
            ownerTeam: ws.team,
            rocketId: rocket.id,
        });
        setTimeout(() => {
            runRocketExplosion(lobby, rocket);
        }, 2000);
    }
}
export function handleBoostPickup(_wss, ws, data) {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        const idx = lobby.boosts.findIndex((b) => b.id === data.boostId);
        if (idx !== -1) {
            const boost = lobby.boosts[idx];
            lobby.boosts.splice(idx, 1);
            broadcastGame(lobby, {
                type: ServerMsg.BOOST_PICKUP,
                boostId: data.boostId,
                x: boost.x,
                y: boost.y,
                playerId: ws.id,
            });
        }
    }
}
export function handleBricksDestroyBatch(_wss, ws, data) {
    if (!data.list || !Array.isArray(data.list))
        return;
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted && lobby.mapData) {
        const spawnedBoosts = [];
        const validBricks = [];
        data.list.forEach((brick) => {
            const brickIndex = lobby.mapData.bricks.findIndex((b) => b.x === brick.x && b.y === brick.y);
            if (brickIndex !== -1) {
                validBricks.push(brick);
                lobby.mapData.bricks.splice(brickIndex, 1);
                if (Math.random() < 0.5) {
                    const bType = Math.floor(Math.random() * 6);
                    const boost = {
                        x: brick.x + BRICK_SIZE / 2,
                        y: brick.y + BRICK_SIZE / 2,
                        type: bType,
                        id: `b_${Date.now()}${Math.random()}`,
                    };
                    lobby.boosts.push(boost);
                    spawnedBoosts.push(boost);
                }
            }
        });
        if (validBricks.length > 0) {
            broadcastGame(lobby, {
                type: ServerMsg.BRICKS_DESTROY_BATCH,
                list: validBricks,
                ownerId: ws.id,
                ownerTeam: ws.team,
                spawnedBoosts,
                bulletId: data.bulletId,
            });
            lobby.aiGrid = buildBotPathGrid(lobby.mapData);
        }
    }
}
export function handleDeploySmoke(_wss, ws, data) {
    const lobby = ws.lobbyId ? lobbies[ws.lobbyId] : undefined;
    if (lobby?.gameStarted) {
        const now = Date.now();
        lobby.smokes = lobby.smokes.filter((s) => s.expiresAt > now);
        lobby.smokes.push({
            x: data.x,
            y: data.y,
            expiresAt: now + SMOKE_LIFETIME_MS,
        });
        broadcastGame(lobby, {
            type: ServerMsg.DEPLOY_SMOKE,
            x: data.x,
            y: data.y,
            ownerId: ws.id,
            ownerTeam: ws.team,
        });
    }
}
//# sourceMappingURL=world.js.map