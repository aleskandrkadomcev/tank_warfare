/** Типы для импорта `gameState.js` из TypeScript-модулей (фаза 4). */

import type { TankDef } from '../../../shared/src/tankDefs.js';

export interface WorldBrick {
    x: number;
    y: number;
}

export interface WorldForest {
    x: number;
    y: number;
}

export interface WorldBullet {
    bulletId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
    ownerTeam: number;
    damage: number;
}

export interface WorldBoost {
    x: number;
    y: number;
    type: number;
    id: string;
}

export interface WorldMine {
    x: number;
    y: number;
    owner: string;
    ownerTeam: number;
    mineId: string;
    triggered: boolean;
}

export interface WorldRocket {
    x: number;
    y: number;
    sx: number;
    sy: number;
    tx: number;
    ty: number;
    owner: string;
    ownerTeam: number;
    startTime: number;
    duration: number;
}

export interface LocalTank {
    x: number;
    y: number;
    angle: number;
    turretAngle: number;
    vx: number;
    vy: number;
    hp: number;
    reload: number;
    w: number;
    h: number;
    color: string;
    turretColor: string;
    trackColor: string;
    camo: string;
    tankType: string;
    damageBoostTimer: number;
    speedBoostTimer: number;
    collisionTimer: number;
    smokeCount: number;
    mineCount: number;
    rocketCount: number;
    healCount: number;
    healCooldown: number;
    aimDist: number;
    isDead: boolean;
    spawnImmunityTimer: number;
    _respawnTimer?: number;
    maxHp?: number;
}

export interface EnemyTank extends LocalTank {
    id: string;
    team: number;
    lastSeenAt?: number;
    maxHp: number;
    _trackDist?: number;
}

/** Минимум для движков в `session` (реализация — `TankEngine` в audio). */
export type TankEngineHandle = {
    start: () => void;
    update: (dt: number, speedRatio: number, distFactor: number, pan?: number) => void;
};

export interface WorldHull {
    id: string;
    x: number;
    y: number;
    angle: number;
    w: number;
    h: number;
}

export function bumpBricksDrawRevision(): void;

export let zoomLevel: number;
export function setZoomLevel(v: number): void;

export const world: {
    bricks: WorldBrick[];
    forests: WorldForest[];
    bricksDrawRevision: number;
    bullets: WorldBullet[];
    particles: unknown[];
    tracks: unknown[];
    boosts: WorldBoost[];
    smokes: unknown[];
    mines: WorldMine[];
    rockets: WorldRocket[];
    explosions: unknown[];
    stones: unknown[];
    explosionMarks: unknown[];
    hulls: WorldHull[];
};

export const battle: {
    tank: LocalTank;
    enemyTanks: Record<string, EnemyTank>;
    myScore: number;
    enemyScore: number;
    bulletCounter: number;
    tankDef: TankDef;
    scoreLimit: number;
    liveStats: unknown[];
};

export const session: {
    gameStarted: boolean;
    isHost: boolean;
    myId: string | null;
    myTeam: number;
    myColor: string;
    playerData: Record<string, { nick: string; team: number; color: string; camo?: string; isBot?: boolean }>;
    myNickname: string;
    currentLobbyId: string | null;
    myEngine: TankEngineHandle | null;
    enemyEngine: TankEngineHandle | null;
    myCamo: string;
    myTankType: string;
    spawnSlot: number;
    roundOver?: boolean;
};

export const level: {
    mapWidth: number;
    mapHeight: number;
    biome: number;
    trackSpawnDist: number;
    windAngle: number;
    windSpeed: number;
};
