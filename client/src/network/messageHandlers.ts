/**
 * Входящие сообщения сервера: реестр по type (фаза 2.1 + 4).
 */
import {
    ClientMsg,
    ServerMsg,
    type ServerMessageType,
} from '../../../shared/dist/protocol.js';
import {
    BRICK_SIZE,
    BULLET_DAMAGE_BASE,
    COLLISION_DAMAGE,
    DETECTION_MEMORY_MS,
    ROCKET_FLIGHT_TIME,
    SPAWN_IMMUNITY_TIME,
} from '../config/constants.js';
import { battle, bumpBricksDrawRevision, level, session, world } from '../game/gameState.js';

type WsMineLocal = { mineId: string; x: number; y: number };
import {
    audioCtx,
    initAudio,
    playAlert,
    playBombBeep,
    playRocketFlyBy,
    playSound_Explosion,
    playSound_Hit,
    playSound_Shot,
    playSound_Victory,
    TankEngine,
} from '../lib/audio.js';
import { triggerShake } from '../game/cameraShake.js';

type SendPayload = Record<string, unknown>;

type WsBullet = { bulletId: string };
type WsMine = { mineId: string };
type WsBoost = { id: string };

let sendFn: (d: SendPayload) => void = () => { };

/** Колбэки, остающиеся в gameClient (DOM, симуляция, эффекты). */
export const gameMessageHooks = {
    updateLobbyListUI: (_lobbies: unknown[]) => { },
    showLobby: (_lobbyId: string, _name: string | null, _isHost: boolean) => { },
    updateLobbyPlayers: (_players: unknown[]) => { },
    startGameClient: () => { },
    resetMatch: () => { },
    spawnMyTank: () => { },
    updateUI: () => { },
    spawnParticles: (_x: number, _y: number, _c: string, _n: number) => { },
    createExplosion: (_x: number, _y: number, _r: number) => { },
    createSmokeCloud: (_x: number, _y: number) => { },
    addTrack: (_x: number, _y: number, _a: number) => { },
};

export function configureServerMessages(api: { send: (d: SendPayload) => void }) {
    sendFn = api.send;
}

function getVolumeByDistance(tx: number, ty: number) {
    const d = Math.hypot(battle.tank.x - tx, battle.tank.y - ty);
    return Math.max(0, 1 - d / 1920);
}

function handleLobbyList(d: Record<string, unknown>) {
    gameMessageHooks.updateLobbyListUI(Array.isArray(d.lobbies) ? d.lobbies : []);
}

function handleLobbyCreated(d: Record<string, unknown>) {
    session.myId = d.playerId as string;
    session.myNickname = d.nickname as string;
    session.myColor = d.color as string;
    session.myTeam = d.team as number;
    session.isHost = Boolean(d.isHost);
    session.currentLobbyId = d.lobbyId as string;
    gameMessageHooks.showLobby(d.lobbyId as string, (d.name as string) || 'Лобби', Boolean(d.isHost));
    session.playerData[session.myId] = {
        nick: session.myNickname,
        team: session.myTeam,
        color: session.myColor,
        isBot: false,
    };
}

function handleLobbyJoined(d: Record<string, unknown>) {
    session.myId = d.playerId as string;
    session.myNickname = d.nickname as string;
    session.myColor = d.color as string;
    session.myTeam = d.team as number;
    session.isHost = Boolean(d.isHost);
    session.currentLobbyId = d.lobbyId as string;
    gameMessageHooks.showLobby(d.lobbyId as string, null, Boolean(d.isHost));
    session.playerData[session.myId] = {
        nick: session.myNickname,
        team: session.myTeam,
        color: session.myColor,
        isBot: false,
    };
}

function handleLobbyState(d: Record<string, unknown>) {
    const players = Array.isArray(d.players) ? d.players : [];
    gameMessageHooks.updateLobbyPlayers(players);
    const nameEl = document.getElementById('lobbyNameDisplay');
    if (nameEl) nameEl.innerText = (d.name as string) || 'Лобби';
    const me = (players as { id: string; ready?: boolean }[]).find((p) => p.id === session.myId);
    if (me) {
        const btn = document.getElementById('btnReady');
        if (btn) {
            btn.innerText = me.ready ? 'Не готов' : 'Готов';
            btn.classList.toggle('ready', Boolean(me.ready));
        }
    }
}

function handleStart(d: Record<string, unknown>) {
    initAudio();
    if (!session.myEngine) {
        session.myEngine = new TankEngine(audioCtx, false);
        session.myEngine.start();
    }
    if (!session.enemyEngine) {
        session.enemyEngine = new TankEngine(audioCtx, true);
        session.enemyEngine.start();
    }
    session.myTeam = d.team as number;
    session.myColor = d.color as string;
    ((d.allPlayers as { id: string; nick: string; team: number; color: string; isBot?: boolean }[]) || []).forEach((p) => {
        session.playerData[p.id] = { nick: p.nick, team: p.team, color: p.color, isBot: Boolean(p.isBot) };
    });
    if (d.map) {
        const map = d.map as {
            bricks: { x: number; y: number }[];
            forests?: { x: number; y: number }[];
            biome: number;
            w: number;
            h: number;
        };
        world.bricks.length = 0;
        map.bricks.forEach((b) => world.bricks.push(b));
        world.forests.length = 0;
        (map.forests || []).forEach((f) => world.forests.push(f));
        level.biome = map.biome;
        level.mapWidth = map.w;
        level.mapHeight = map.h;
        bumpBricksDrawRevision();
    }
    gameMessageHooks.startGameClient();
}

function handleScoreUpdate(d: Record<string, unknown>) {
    const scores = d.scores as Record<number, number>;
    battle.myScore = scores[session.myTeam] || 0;
    battle.enemyScore = scores[session.myTeam === 1 ? 2 : 1] || 0;
    gameMessageHooks.updateUI();
}

function handleGameOver(d: Record<string, unknown>) {
    const win = d.winner === session.myTeam;
    const draw = d.winner === 0;
    session.gameStarted = false;
    const deathEl = document.getElementById('death-screen');
    const victoryEl = document.getElementById('victory-screen');
    if (deathEl) deathEl.style.display = 'none';
    if (victoryEl) {
        victoryEl.innerText = draw ? 'НИЧЬЯ!' : win ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
        victoryEl.style.color = draw ? '#ffeb3b' : win ? '#ffeb3b' : '#f44336';
        victoryEl.style.display = 'block';
    }
    if (win) playSound_Victory();
}

function handlePlayerDied(d: Record<string, unknown>) {
    if (d.playerId !== session.myId) {
        const et = battle.enemyTanks[d.playerId as string];
        // Координаты смерти — из врага или из серверного сообщения
        const deathX = et ? et.x : (d.x as number);
        const deathY = et ? et.y : (d.y as number);
        if (et) {
            et.hp = 0;
            et.spawnImmunityTimer = SPAWN_IMMUNITY_TIME;
        }
        if (deathX != null && deathY != null) {
            gameMessageHooks.spawnParticles(deathX, deathY, '#ffeb3b', 20);
            const vol = getVolumeByDistance(deathX, deathY);
            playSound_Explosion(vol);
        }
    } else {
        const deathEl = document.getElementById('death-screen');
        if (deathEl) deathEl.style.display = 'block';
        battle.tank.hp = 0;
        battle.tank.isDead = true;
        gameMessageHooks.spawnParticles(battle.tank.x, battle.tank.y, '#f44336', 20);
        playSound_Explosion(1);
        setTimeout(() => gameMessageHooks.spawnMyTank(), 2000);
    }
}

function handleCollisionHit(_d: Record<string, unknown>) {
    if (battle.tank.collisionTimer <= 0.2) {
        if (battle.tank.spawnImmunityTimer <= 0) {
            battle.tank.hp -= COLLISION_DAMAGE;
        }
        gameMessageHooks.spawnParticles(battle.tank.x, battle.tank.y, '#fff', 10);
        playSound_Hit();
        triggerShake('hit');
        battle.tank.collisionTimer = 1;
        if (battle.tank.hp <= 0 && !battle.tank.isDead) {
            sendFn({ type: ClientMsg.DEATH });
            battle.tank.isDead = true;
        }
    }
}

function handleBulletHitMe(d: Record<string, unknown>) {
    if (battle.tank.spawnImmunityTimer <= 0) {
        battle.tank.hp -= d.damage as number;
    }
    gameMessageHooks.spawnParticles(battle.tank.x, battle.tank.y, '#f44336', 5);
    playSound_Hit();
    triggerShake('hit');
    if (d.bulletId) {
        const bi = world.bullets.findIndex((b: WsBullet) => b.bulletId === d.bulletId);
        if (bi !== -1) world.bullets.splice(bi, 1);
    }
    if (battle.tank.hp <= 0 && !battle.tank.isDead) {
        sendFn({ type: ClientMsg.DEATH });
        battle.tank.isDead = true;
    }
}

function handleBulletHitOther(d: Record<string, unknown>) {
    const hx = (d.hitX as number) ?? battle.tank.x;
    const hy = (d.hitY as number) ?? battle.tank.y;
    playSound_Hit(getVolumeByDistance(hx, hy));
}

function handleBulletRemove(d: Record<string, unknown>) {
    const bi = world.bullets.findIndex((b: WsBullet) => b.bulletId === d.bulletId);
    if (bi !== -1) world.bullets.splice(bi, 1);
}

function handleBulletHitVisual(d: Record<string, unknown>) {
    gameMessageHooks.spawnParticles(d.hitX as number, d.hitY as number, '#ffeb3b', 3);
    const vol = getVolumeByDistance(d.hitX as number, d.hitY as number);
    if (vol > 0.05) playSound_Hit(vol);
}

function handleExplosionEvent(d: Record<string, unknown>) {
    gameMessageHooks.createExplosion(d.x as number, d.y as number, d.radius as number);
    const distToExplosion = Math.hypot(battle.tank.x - (d.x as number), battle.tank.y - (d.y as number));
    if (distToExplosion < 500) triggerShake('explosionNear');
    const destroyedBricks = d.destroyedBricks as { x: number; y: number }[] | undefined;
    if (destroyedBricks && destroyedBricks.length > 0) {
        let bricksRemoved = false;
        destroyedBricks.forEach((brick) => {
            const i = world.bricks.findIndex((b) => b.x === brick.x && b.y === brick.y);
            if (i !== -1) {
                world.bricks.splice(i, 1);
                bricksRemoved = true;
                gameMessageHooks.spawnParticles(
                    brick.x + BRICK_SIZE / 2,
                    brick.y + BRICK_SIZE / 2,
                    '#8b4513',
                    3,
                );
            }
        });
        if (bricksRemoved) bumpBricksDrawRevision();
    }
    const spawnedBoosts = d.spawnedBoosts as { x: number; y: number; type: number; id: string }[] | undefined;
    if (spawnedBoosts && spawnedBoosts.length > 0) {
        spawnedBoosts.forEach((boost) => {
            world.boosts.push({
                x: boost.x,
                y: boost.y,
                type: boost.type,
                id: boost.id,
            });
        });
    }
}

function handleExplosionDamage(d: Record<string, unknown>) {
    if (battle.tank.spawnImmunityTimer <= 0) {
        battle.tank.hp -= d.damage as number;
    }
    gameMessageHooks.spawnParticles(battle.tank.x, battle.tank.y, '#f44336', 10);
    playSound_Hit();
    triggerShake('explosionDamage');
    if (battle.tank.hp <= 0 && !battle.tank.isDead) {
        sendFn({ type: ClientMsg.DEATH });
        battle.tank.isDead = true;
    }
}

function handleDeploySmoke(d: Record<string, unknown>) {
    gameMessageHooks.createSmokeCloud(d.x as number, d.y as number);
}

function handleDeployMine(d: Record<string, unknown>) {
    world.mines.push({
        x: d.x as number,
        y: d.y as number,
        owner: d.ownerId as string,
        ownerTeam: d.ownerTeam as number,
        mineId: d.mineId as string,
        triggered: false,
    });
}

function handleMineTriggered(d: Record<string, unknown>) {
    const mine = world.mines.find((x: WsMineLocal) => x.mineId === d.mineId);
    const mineVol = mine ? getVolumeByDistance(mine.x, mine.y) : 1;
    playBombBeep(mineVol);
    const m = world.mines.find((x: WsMine) => x.mineId === d.mineId);
    if (m) m.triggered = true;
}

function handleMineRemoved(d: Record<string, unknown>) {
    const i = world.mines.findIndex((x: WsMine) => x.mineId === d.mineId);
    if (i !== -1) world.mines.splice(i, 1);
}

function handleLaunchRocket(d: Record<string, unknown>) {
    world.rockets.push({
        x: d.tx as number,
        y: (d.ty as number) - 2000,
        sx: d.tx as number,
        sy: (d.ty as number) - 2000,
        tx: d.tx as number,
        ty: d.ty as number,
        owner: d.ownerId as string,
        ownerTeam: d.ownerTeam as number,
        startTime: performance.now(),
        duration: ROCKET_FLIGHT_TIME * 1000,
    });
    playAlert();
    if (d.ownerId !== session.myId) playRocketFlyBy();
}

function handleBricksDestroyBatch(d: Record<string, unknown>) {
    const list = d.list as { x: number; y: number }[] | undefined;
    if (!list) return;
    let bricksRemoved = false;
    list.forEach((brick) => {
        const i = world.bricks.findIndex((b) => b.x === brick.x && b.y === brick.y);
        if (i !== -1) {
            world.bricks.splice(i, 1);
            bricksRemoved = true;
            gameMessageHooks.spawnParticles(
                brick.x + BRICK_SIZE / 2,
                brick.y + BRICK_SIZE / 2,
                '#8b4513',
                3,
            );
        }
    });
    if (bricksRemoved) bumpBricksDrawRevision();
    if (d.bulletId) {
        const bi = world.bullets.findIndex((b: WsBullet) => b.bulletId === d.bulletId);
        if (bi !== -1) world.bullets.splice(bi, 1);
    }
    const spawnedBoosts = d.spawnedBoosts as { x: number; y: number; type: number; id: string }[] | undefined;
    if (spawnedBoosts && spawnedBoosts.length > 0) {
        spawnedBoosts.forEach((boost) => {
            world.boosts.push({
                x: boost.x,
                y: boost.y,
                type: boost.type,
                id: boost.id,
            });
        });
    }
}

function handleRestartMatch(d: Record<string, unknown>) {
    if (d.map) {
        const map = d.map as { bricks: { x: number; y: number }[]; forests?: { x: number; y: number }[]; biome: number };
        world.bricks.length = 0;
        map.bricks.forEach((b) => world.bricks.push(b));
        world.forests.length = 0;
        (map.forests || []).forEach((f) => world.forests.push(f));
        level.biome = map.biome;
        bumpBricksDrawRevision();
    }
    (world as any).hulls.length = 0;
    gameMessageHooks.resetMatch();
}

function handleHullUpdate(d: Record<string, unknown>) {
    const hull = (world as any).hulls.find((h: any) => h.id === d.id);
    if (hull) {
        hull.x = d.x as number;
        hull.y = d.y as number;
        hull.angle = d.angle as number;
    }
}

function handleBoostSpawn(d: Record<string, unknown>) {
    world.boosts.push({
        x: d.x as number,
        y: d.y as number,
        type: d.bType as number,
        id: d.id as string,
    });
}

function handleHullSpawn(d: Record<string, unknown>) {
    (world as any).hulls.push({
        id: d.id as string,
        x: d.x as number,
        y: d.y as number,
        angle: d.angle as number,
        w: d.w as number,
        h: d.h as number,
    });
}

function handleBoostPickup(d: Record<string, unknown>) {
    const i = world.boosts.findIndex((b: WsBoost) => b.id === d.boostId);
    if (i !== -1) world.boosts.splice(i, 1);
}

function handleRemoteState(d: Record<string, unknown>) {
    if (d.id === session.myId) return;
    const now = performance.now();
    Object.keys(battle.enemyTanks).forEach((id) => {
        const enemy = battle.enemyTanks[id];
        if (!enemy) return;
        if ((enemy.lastSeenAt ?? 0) + DETECTION_MEMORY_MS < now) {
            delete battle.enemyTanks[id];
        }
    });
    if (!battle.enemyTanks[d.id as string]) {
        battle.enemyTanks[d.id as string] = {
            ...battle.tank,
            x: d.x as number,
            y: d.y as number,
            id: d.id as string,
            team: d.team as number,
            color: session.playerData[d.id as string]?.color || '#f44336',
            spawnImmunityTimer: (d.spawnImmunityTimer as number) || SPAWN_IMMUNITY_TIME,
            lastSeenAt: now,
        };
    }
    const et = battle.enemyTanks[d.id as string];
    if (d.vx !== undefined) et.vx = d.vx as number;
    if (d.vy !== undefined) et.vy = d.vy as number;
    if (d.hp !== undefined) et.hp = d.hp as number;
    if (d.spawnImmunityTimer !== undefined) et.spawnImmunityTimer = d.spawnImmunityTimer as number;
    et.team = d.team as number;
    const dx = (d.x as number) - et.x;
    const dy = (d.y as number) - et.y;
    const dist = Math.hypot(dx, dy);
    level.trackSpawnDist += dist;
    if (level.trackSpawnDist > 8 && et.hp > 0) {
        const off = 18;
        const a = d.angle as number;
        gameMessageHooks.addTrack(
            (d.x as number) - Math.cos(a + Math.PI / 2) * off,
            (d.y as number) - Math.sin(a + Math.PI / 2) * off,
            a,
        );
        gameMessageHooks.addTrack(
            (d.x as number) - Math.cos(a - Math.PI / 2) * off,
            (d.y as number) - Math.sin(a - Math.PI / 2) * off,
            a,
        );
        level.trackSpawnDist = 0;
    }
    et.x = d.x as number;
    et.y = d.y as number;
    et.angle = d.angle as number;
    et.turretAngle = d.turretAngle as number;
    et.lastSeenAt = now;
}

function handleBullet(d: Record<string, unknown>) {
    world.bullets.push({
        bulletId: d.bulletId as string,
        x: d.x as number,
        y: d.y as number,
        vx: d.vx as number,
        vy: d.vy as number,
        ownerId: d.ownerId as string,
        ownerTeam: d.ownerTeam as number,
        damage: (d.damage as number) || BULLET_DAMAGE_BASE,
    });
    if (d.ownerId !== session.myId) {
        playSound_Shot(getVolumeByDistance(d.x as number, d.y as number));
    }
    gameMessageHooks.spawnParticles(d.x as number, d.y as number, '#ffeb3b', 5);
}

type ServerHandler = (d: Record<string, unknown>) => void;

const handlers: Partial<Record<(typeof ServerMsg)[keyof typeof ServerMsg], ServerHandler>> = {
    [ServerMsg.LOBBY_LIST]: handleLobbyList,
    [ServerMsg.LOBBY_CREATED]: handleLobbyCreated,
    [ServerMsg.LOBBY_JOINED]: handleLobbyJoined,
    [ServerMsg.LOBBY_STATE]: handleLobbyState,
    [ServerMsg.START]: handleStart,
    [ServerMsg.SCORE_UPDATE]: handleScoreUpdate,
    [ServerMsg.GAME_OVER]: handleGameOver,
    [ServerMsg.PLAYER_DIED]: handlePlayerDied,
    [ServerMsg.COLLISION_HIT]: handleCollisionHit,
    [ServerMsg.BULLET_REMOVE]: handleBulletRemove,
    [ServerMsg.BULLET_HIT_VISUAL]: handleBulletHitVisual,
    [ServerMsg.EXPLOSION_EVENT]: handleExplosionEvent,
    [ServerMsg.EXPLOSION_DAMAGE]: handleExplosionDamage,
    [ServerMsg.DEPLOY_SMOKE]: handleDeploySmoke,
    [ServerMsg.DEPLOY_MINE]: handleDeployMine,
    [ServerMsg.MINE_TRIGGERED]: handleMineTriggered,
    [ServerMsg.MINE_REMOVED]: handleMineRemoved,
    [ServerMsg.LAUNCH_ROCKET]: handleLaunchRocket,
    [ServerMsg.BRICKS_DESTROY_BATCH]: handleBricksDestroyBatch,
    [ServerMsg.RESTART_MATCH]: handleRestartMatch,
    [ServerMsg.BOOST_SPAWN]: handleBoostSpawn,
    [ServerMsg.HULL_SPAWN]: handleHullSpawn,
    [ServerMsg.HULL_UPDATE]: handleHullUpdate,
    [ServerMsg.BOOST_PICKUP]: handleBoostPickup,
    [ServerMsg.STATE]: handleRemoteState,
    [ServerMsg.BULLET]: handleBullet,
};

export function handleServerMessage(d: Record<string, unknown>) {
    if (!d || typeof d.type !== 'string') return;
    if (d.type === ServerMsg.BULLET_HIT) {
        if (d.targetId === session.myId) handleBulletHitMe(d);
        else handleBulletHitOther(d);
        return;
    }
    const fn = handlers[d.type as ServerMessageType];
    if (fn) fn(d);
}
