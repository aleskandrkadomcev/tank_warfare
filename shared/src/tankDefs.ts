/**
 * Определения типов танков (shared между сервером и клиентом).
 * Добавлять новые — просто дописать в TANK_DEFS.
 */

export type TankType = 'light' | 'medium' | 'heavy';

export interface TankDef {
    type: TankType;
    label: string;
    /** Здоровье */
    hp: number;
    /** Ширина хитбокса (px) */
    w: number;
    /** Высота хитбокса (px) */
    h: number;
    /** Макс. скорость вперёд (px/s) */
    maxSpeedForward: number;
    /** Макс. скорость назад (px/s) */
    maxSpeedReverse: number;
    /** Ускорение вперёд */
    accelForward: number;
    /** Ускорение назад */
    accelReverse: number;
    /** Сила торможения */
    brakePower: number;
    /** Скорость поворота корпуса (рад/с) */
    turnSpeed: number;
    /** Скорость поворота башни (рад/с) */
    turretRotationSpeed: number;
    /** Время перезарядки (с) */
    reloadTime: number;
    /** Множитель перезарядки с бонусом атаки */
    reloadBoostMult: number;
    /** Урон снаряда */
    bulletDamage: number;
    /** Множитель сопротивления взрывам (1 = нет резиста, 0.75 = -25%) */
    explosionResist: number;
    /** Сцепление (боковой занос), меньше = больше заносит */
    grip: number;
    /** Урон от тарана */
    collisionDamage: number;
    /** Торможение без ввода */
    naturalDrag: number;
    /** Радиус обнаружения (px) */
    detectionRadius: number;
    /** Условная масса танка (коэффициент для столкновений). Средний = 1.0 */
    mass: number;
    /** Начальный инвентарь */
    startInventory: {
        healCount: number;
        smokeCount: number;
        mineCount: number;
        rocketCount: number;
    };
}

const DEG = Math.PI / 180;

export const TANK_DEFS: Record<TankType, TankDef> = {
    light: {
        type: 'light',
        label: 'Лёгкий танк',
        hp: 70,
        w: 87,
        h: 43,
        maxSpeedForward: 270,
        maxSpeedReverse: 135,
        accelForward: 110,
        accelReverse: 110,
        brakePower: 400,
        turnSpeed: 140 * DEG,
        turretRotationSpeed: 120 * DEG,
        reloadTime: 2.0,
        reloadBoostMult: 0.8,
        bulletDamage: 20,
        explosionResist: 1.0,
        grip: 0.85,
        collisionDamage: 35,
        naturalDrag: 50,
        detectionRadius: 1125,
        mass: 0.5,
        startInventory: {
            healCount: 0,
            smokeCount: 1,
            mineCount: 0,
            rocketCount: 0,
        },
    },
    medium: {
        type: 'medium',
        label: 'Средний танк',
        hp: 100,
        w: 96,
        h: 48,
        maxSpeedForward: 225,
        maxSpeedReverse: 112.5,
        accelForward: 112.5,
        accelReverse: 112.5,
        brakePower: 400,
        turnSpeed: 100 * DEG,
        turretRotationSpeed: 120 * DEG,
        reloadTime: 3.0,
        reloadBoostMult: 0.8,
        bulletDamage: 35,
        explosionResist: 1.0,
        grip: 0.85,
        collisionDamage: 35,
        naturalDrag: 60,
        detectionRadius: 900,
        mass: 1.0,
        startInventory: {
            healCount: 1,
            smokeCount: 0,
            mineCount: 0,
            rocketCount: 0,
        },
    },
    heavy: {
        type: 'heavy',
        label: 'Тяжёлый танк',
        hp: 150,
        w: 112,
        h: 54,
        maxSpeedForward: 160,
        maxSpeedReverse: 80,
        accelForward: 80,
        accelReverse: 80,
        brakePower: 300,
        turnSpeed: 90 * DEG,
        turretRotationSpeed: 100 * DEG,
        reloadTime: 5.0,
        reloadBoostMult: 0.8,
        bulletDamage: 50,
        explosionResist: 0.75,
        grip: 0.85,
        collisionDamage: 35,
        naturalDrag: 60,
        detectionRadius: 765,
        mass: 1.8,
        startInventory: {
            healCount: 0,
            smokeCount: 0,
            mineCount: 0,
            rocketCount: 1,
        },
    },
};

/** Общие характеристики для всех танков. */
export const TANK_COMMON = {
    spawnImmunityTime: 3.0,
} as const;

/** Получить определение танка по типу (с фоллбэком на medium). */
export function getTankDef(type?: TankType | string): TankDef {
    return TANK_DEFS[type as TankType] ?? TANK_DEFS.medium;
}
