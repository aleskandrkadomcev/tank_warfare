/**
 * Состояние клиента: мир (массивы), бой, сессия лобби, параметры карты.
 * Импортируется там, где нужны ссылки на одни и те же объекты.
 */
import { MAP_HEIGHT, MAP_WIDTH } from '../config/constants.js';
import { getTankDef } from '../../../shared/dist/tankDefs.js';

/** Сущности на карте и эффекты (2.2a). */
export const world = {
    bricks: [],
    forests: [],
    stones: [],
    /** Счётчик для инвалидации offscreen-кэша кирпичей в `drawBricks`. */
    bricksDrawRevision: 0,
    bullets: [],
    particles: [],
    tracks: [],
    boosts: [],
    smokes: [],
    mines: [],
    rockets: [],
    explosions: [],
    explosionMarks: [],
    hulls: [],
};

/** Вызывать при любой мутации `world.bricks` (загрузка карты, splice, очистка). */
export function bumpBricksDrawRevision() {
    world.bricksDrawRevision++;
}

const defaultDef = getTankDef('medium');

/** Локальный танк игрока, враги, счёт (2.2b). */
export const battle = {
    /** Определение текущего типа танка. */
    tankDef: defaultDef,
    tank: {
        x: 100,
        y: 100,
        angle: 0,
        turretAngle: 0,
        vx: 0,
        vy: 0,
        hp: defaultDef.hp,
        reload: 0,
        w: defaultDef.w,
        h: defaultDef.h,
        color: '#4CAF50',
        turretColor: '#388E3C',
        trackColor: '#1B5E20',
        camo: 'none',
        tankType: 'medium',
        damageBoostTimer: 0,
        speedBoostTimer: 0,
        collisionTimer: 0,
        smokeCount: defaultDef.startInventory.smokeCount,
        mineCount: defaultDef.startInventory.mineCount,
        rocketCount: defaultDef.startInventory.rocketCount,
        healCount: defaultDef.startInventory.healCount,
        healCooldown: 0,
        aimDist: 200,
        isDead: false,
        spawnImmunityTimer: 0,
    },
    enemyTanks: {},
    myScore: 0,
    enemyScore: 0,
    scoreLimit: 5,
    bulletCounter: 0,
    liveStats: [],
};

/** Лобби, сеть, движки звука (2.2c). */
export const session = {
    gameStarted: false,
    isHost: false,
    myId: null,
    myTeam: 1,
    myColor: '#4CAF50',
    myCamo: 'none',
    myTankType: 'medium',
    playerData: {},
    myNickname: 'Игрок',
    currentLobbyId: null,
    myEngine: null,
    enemyEngine: null,
    spawnSlot: 0,
    roundOver: false,
};

/** Размеры и биом текущей карты + вспомогательный счётчик для следов. */
export const level = {
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    biome: 0,
    trackSpawnDist: 0,
    /** Направление ветра (радианы), задаётся сервером. */
    windAngle: 0,
    /** Скорость ветра для дыма/частиц (px/сек). */
    windSpeed: 20,
};
