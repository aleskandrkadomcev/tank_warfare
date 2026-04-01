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
export declare const TANK_DEFS: Record<TankType, TankDef>;
/** Общие характеристики для всех танков. */
export declare const TANK_COMMON: {
    readonly spawnImmunityTime: 3;
};
/** Получить определение танка по типу (с фоллбэком на medium). */
export declare function getTankDef(type?: TankType | string): TankDef;
//# sourceMappingURL=tankDefs.d.ts.map