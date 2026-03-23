/**
 * Состояние клиента: мир (массивы), бой, сессия лобби, параметры карты.
 * Импортируется там, где нужны ссылки на одни и те же объекты.
 */
import { MAP_HEIGHT, MAP_WIDTH, TANK_MAX_HP } from '../config/constants.js';

/** Сущности на карте и эффекты (2.2a). */
export const world = {
    bricks: [],
    forests: [],
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

/** Локальный танк игрока, враги, счёт (2.2b). */
export const battle = {
    tank: {
        x: 100,
        y: 100,
        angle: 0,
        turretAngle: 0,
        vx: 0,
        vy: 0,
        hp: TANK_MAX_HP,
        reload: 0,
        w: 75,
        h: 45,
        color: '#4CAF50',
        turretColor: '#388E3C',
        trackColor: '#1B5E20',
        damageBoostTimer: 0,
        speedBoostTimer: 0,
        collisionTimer: 0,
        smokeCount: 0,
        mineCount: 0,
        rocketCount: 0,
        isDead: false,
        spawnImmunityTimer: 0,
    },
    enemyTanks: {},
    myScore: 0,
    enemyScore: 0,
    bulletCounter: 0,
};

/** Лобби, сеть, движки звука (2.2c). */
export const session = {
    gameStarted: false,
    isHost: false,
    myId: null,
    myTeam: 1,
    myColor: '#4CAF50',
    playerData: {},
    myNickname: 'Игрок',
    currentLobbyId: null,
    myEngine: null,
    enemyEngine: null,
};

/** Размеры и биом текущей карты + вспомогательный счётчик для следов. */
export const level = {
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    biome: 0,
    trackSpawnDist: 0,
};
