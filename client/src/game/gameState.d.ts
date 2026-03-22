/** Типы для импорта `gameState.js` из TypeScript-модулей (фаза 4). */

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
    damageBoostTimer: number;
    speedBoostTimer: number;
    collisionTimer: number;
    smokeCount: number;
    mineCount: number;
    rocketCount: number;
    isDead: boolean;
    spawnImmunityTimer: number;
}

export interface EnemyTank extends LocalTank {
    id: string;
    team: number;
    lastSeenAt?: number;
}

/** Минимум для движков в `session` (реализация — `TankEngine` в audio). */
export type TankEngineHandle = {
    start: () => void;
    update: (dt: number, throttle: number, brake: number) => void;
};

export function bumpBricksDrawRevision(): void;

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
};

export const battle: {
    tank: LocalTank;
    enemyTanks: Record<string, EnemyTank>;
    myScore: number;
    enemyScore: number;
    bulletCounter: number;
};

export const session: {
    gameStarted: boolean;
    isHost: boolean;
    myId: string | null;
    myTeam: number;
    myColor: string;
    playerData: Record<string, { nick: string; team: number; color: string; isBot?: boolean }>;
    myNickname: string;
    currentLobbyId: string | null;
    myEngine: TankEngineHandle | null;
    enemyEngine: TankEngineHandle | null;
};

export const level: {
    mapWidth: number;
    mapHeight: number;
    biome: number;
    trackSpawnDist: number;
};
