/**
 * Определения типов танков (shared между сервером и клиентом).
 * Добавлять новые — просто дописать в TANK_DEFS.
 */
const DEG = Math.PI / 180;
export const TANK_DEFS = {
    light: {
        type: 'light',
        label: 'Лёгкий танк',
        hp: 70,
        w: 62,
        h: 40,
        maxSpeedForward: 270,
        maxSpeedReverse: 135,
        accelForward: 110,
        accelReverse: 110,
        brakePower: 400,
        turnSpeed: 140 * DEG,
        turretRotationSpeed: 120 * DEG,
        reloadTime: 1.0,
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
        reloadTime: 1.5,
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
        w: 81,
        h: 58,
        maxSpeedForward: 160,
        maxSpeedReverse: 80,
        accelForward: 80,
        accelReverse: 80,
        brakePower: 300,
        turnSpeed: 90 * DEG,
        turretRotationSpeed: 100 * DEG,
        reloadTime: 2.5,
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
};
/** Получить определение танка по типу (с фоллбэком на medium). */
export function getTankDef(type) {
    return TANK_DEFS[type] ?? TANK_DEFS.medium;
}
//# sourceMappingURL=tankDefs.js.map