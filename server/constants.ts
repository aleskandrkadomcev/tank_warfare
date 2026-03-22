export { PLAYER_TANK_COLORS as VALID_TANK_COLORS } from '#shared/colors.js';
export { BRICK_SIZE, MAX_PLAYERS, MAX_SCORE } from '#shared/map.js';

export const COLLISION_DAMAGE = 35;
export const TANK_MAX_HP = 100;
export const SPAWN_IMMUNITY_TIME = 3.0;
/** Базовый радиус обнаружения (обычный рельеф, без леса). */
export const DETECTION_RADIUS = 900;
/** Время "памяти" обнаружения после потери линии видимости. */
export const DETECTION_MEMORY_MS = 2000;
/** Множитель радиуса для леса (резерв под будущую механику). */
export const FOREST_DETECTION_RADIUS_FACTOR = 0.5;
/** Эффективный «малый» радиус обнаружения (лес, дым, сквозь дым). */
export const DETECTION_RADIUS_SMALL = DETECTION_RADIUS * FOREST_DETECTION_RADIUS_FACTOR;
/**
 * Радиус облака дыма на сервере (примерно как разлёт частиц в createSmokeCloud: до ~150 + размер).
 * Линия обзора, пересекающая диск, считается заслонённой дымом.
 */
export const SMOKE_CLOUD_RADIUS = 200;
/** Время жизни облака дыма (синхронно с клиентом simulation.js: 10 с). */
export const SMOKE_LIFETIME_MS = 10_000;
/** Размер спрайта секции леса (PNG). */
export const FOREST_SECTION_SIZE = 97;
/** Шаг повторения секций леса (перекрытие 8px). */
export const FOREST_SECTION_STEP = 89;
