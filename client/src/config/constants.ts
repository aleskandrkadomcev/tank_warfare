export { PLAYER_TANK_COLORS as TANK_COLORS } from '../../../shared/dist/colors.js';
export { BRICK_SIZE, MAP_HEIGHT, MAP_WIDTH, MAX_SCORE } from '../../../shared/dist/map.js';
export { TANK_DEFS, TANK_COMMON, getTankDef } from '../../../shared/dist/tankDefs.js';
export type { TankType, TankDef } from '../../../shared/dist/tankDefs.js';

export const TRACK_LIFETIME = 20000;
/** Верхняя граница числа следов в памяти. */
export const MAX_TRACKS_IN_WORLD = 4096;
export const VIRTUAL_HEIGHT = 1080;

// --- Общие (не зависят от типа танка) ---
export const NATURAL_DRAG = 60;
export const GRIP = 0.85;
export const COLLISION_DAMAGE = 35;
export const SPAWN_IMMUNITY_TIME = 3.0;

// --- Боеприпасы / взрывы ---
export const MINE_DAMAGE = 50;
export const MINE_RADIUS = 90;
export const ROCKET_DAMAGE = 50;
export const ROCKET_RADIUS = 117;
export const ROCKET_FLIGHT_TIME = 2.0;

// --- Бонусы ---
export const BOOST_DURATION = 10.0;
export const BOOST_SPEED_DURATION = 20.0;
/** Дистанция танк <-> бонус для подбора (под размер иконки после `BOOST_ICON_SCALE`). */
export const BOOST_PICKUP_RADIUS = 64;
/** Только отрисовка иконки бонуса/абилки; `BRICK_SIZE` и кирпичи не меняются. */
export const BOOST_ICON_SCALE = 1.55;

// --- Обнаружение ---
/** Радиус отображаемого круга обнаружения игрока. */
export const DETECTION_RADIUS = 900;
/** Как долго держим последнюю видимую позицию врага, если сервер перестал слать его стейт.
 *  Сервер сам держит 2с памяти — на клиенте добавляем лишь маленький буфер на случай джиттера. */
export const DETECTION_MEMORY_MS = 300;
/** В лесу / дыму вторичный радиус обзора = 0.7 от основного. */
export const FOREST_DETECTION_RADIUS_FACTOR = 0.7;

// --- Legacy-алиасы для файлов, которые ещё импортируют старые имена ---
// (будут убраны постепенно при рефакторинге)
import { TANK_DEFS, TANK_COMMON } from '../../../shared/dist/tankDefs.js';
const _med = TANK_DEFS.medium;
export const TANK_MAX_HP = _med.hp;
export const MAX_SPEED_FORWARD = _med.maxSpeedForward;
export const MAX_SPEED_REVERSE = _med.maxSpeedReverse;
export const ACCEL_FORWARD = _med.accelForward;
export const ACCEL_REVERSE = _med.accelReverse;
export const BRAKE_POWER = _med.brakePower;
export const TURN_SPEED = _med.turnSpeed;
export const TURRET_ROTATION_SPEED = _med.turretRotationSpeed;
export const BASE_RELOAD_TIME = _med.reloadTime;
export const BOOST_RELOAD_TIME = _med.reloadTime * _med.reloadBoostMult;
export const BULLET_DAMAGE_BASE = _med.bulletDamage;
export const BULLET_DAMAGE_BOOST = _med.bulletDamage; // бонус атаки теперь только скорострельность
