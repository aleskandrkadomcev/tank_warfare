export { PLAYER_TANK_COLORS as TANK_COLORS } from '../../../shared/dist/colors.js';
export { BRICK_SIZE, MAP_HEIGHT, MAP_WIDTH, MAX_SCORE } from '../../../shared/dist/map.js';

export const TRACK_LIFETIME = 15000;
/** Верхняя граница числа следов в памяти — иначе drawTracks линейно просаживает FPS при длинной езде / мультиплеере. */
export const MAX_TRACKS_IN_WORLD = 512;
export const VIRTUAL_HEIGHT = 1080;

export const MAX_SPEED_FORWARD = 225;
export const MAX_SPEED_REVERSE = 112.5;
export const ACCEL_FORWARD = 112.5;
export const ACCEL_REVERSE = 112.5;
export const BRAKE_POWER = 400;
export const NATURAL_DRAG = 60;
export const TURN_SPEED = 2.5;
export const GRIP = 0.85;
export const BASE_RELOAD_TIME = 1.0;
export const BOOST_RELOAD_TIME = 0.7;
export const BULLET_DAMAGE_BASE = 35;
export const BULLET_DAMAGE_BOOST = 50;
export const COLLISION_DAMAGE = 35;
export const TURRET_ROTATION_SPEED = 120 * (Math.PI / 180);
export const MINE_DAMAGE = 50;
export const MINE_RADIUS = 90;
export const ROCKET_DAMAGE = 50;
export const ROCKET_RADIUS = 90;
export const ROCKET_FLIGHT_TIME = 2.0;
export const TANK_MAX_HP = 100;
export const BOOST_DURATION = 10.0;
export const BOOST_SPEED_DURATION = 20.0;
/** Дистанция танк ↔ бонус для подбора (под размер иконки после `BOOST_ICON_SCALE`). */
export const BOOST_PICKUP_RADIUS = 32;
/** Только отрисовка иконки бонуса/абилки; `BRICK_SIZE` и кирпичи не меняются. */
export const BOOST_ICON_SCALE = 1.55;
export const SPAWN_IMMUNITY_TIME = 3.0;
