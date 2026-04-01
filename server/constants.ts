export { PLAYER_TANK_COLORS as VALID_TANK_COLORS } from '#shared/colors.js';
export { BRICK_SIZE, MAX_PLAYERS, MAX_SCORE } from '#shared/map.js';

export const COLLISION_DAMAGE = 35;
export const TANK_MAX_HP = 100;
export const SPAWN_IMMUNITY_TIME = 3.0;
/** Базовый радиус обнаружения (обычный рельеф, без леса). */
export const DETECTION_RADIUS = 900;
/** Время "памяти" обнаружения после потери линии видимости. */
export const DETECTION_MEMORY_MS = 2000;
/** Множитель радиуса для леса/дыма (вторичный круг обзора). */
export const FOREST_DETECTION_RADIUS_FACTOR = 0.7;
/** Эффективный «малый» радиус обнаружения (лес, дым, сквозь дым). */
export const DETECTION_RADIUS_SMALL = DETECTION_RADIUS * FOREST_DETECTION_RADIUS_FACTOR;
/**
 * Радиус облака дыма на сервере (примерно как разлёт частиц в createSmokeCloud: до ~150 + размер).
 * Линия обзора, пересекающая диск, считается заслонённой дымом.
 */
export const SMOKE_CLOUD_RADIUS = 170;
/** Время жизни облака дыма (синхронно с клиентом simulation.js: 10 с). */
export const SMOKE_LIFETIME_MS = 10_000;
/** Радиус куста для обнаружения/коллизии (диаметр 75). */
export const BUSH_RADIUS = 37.5;

/** Размер спавн-бокса каждой команды (400×400). */
export const SPAWN_BOX_SIZE = 400;
/** Размер одной ячейки спавна (100×100). */
export const SPAWN_CELL_SIZE = 100;
/**
 * Порядок спавн-ячеек (индекс игрока → позиция в сетке 4×4).
 * Нумерация: row 0–3, col 0–3 (сверху-вниз, слева-направо).
 */
export const SPAWN_ORDER: { row: number; col: number }[] = [
    { row: 1, col: 1 }, // 1
    { row: 2, col: 2 }, // 2
    { row: 3, col: 1 }, // 3
    { row: 1, col: 3 }, // 4
    { row: 0, col: 2 }, // 5
    { row: 3, col: 3 }, // 6
    { row: 2, col: 0 }, // 7
    { row: 0, col: 0 }, // 8
    { row: 1, col: 2 }, // 9
    { row: 2, col: 3 }, // 10
    { row: 3, col: 2 }, // 11
    { row: 0, col: 1 }, // 12
    { row: 2, col: 1 }, // 13
    { row: 1, col: 0 }, // 14
    { row: 3, col: 0 }, // 15
    { row: 0, col: 3 }, // 16
];
