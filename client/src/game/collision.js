/**
 * Геометрия столкновений: SAT OBB↔AABB кирпича, кламп танка по карте, AABB пули.
 */
import { BRICK_SIZE } from '../config/constants.js';

export const SAT_EPS = 1e-4;

/** Полуоси корпуса вдоль/поперёк танка (совпадают с drawTank w×h). */
export function getTankHullHalfExtents(tank) {
    return { hw: tank.w / 2, hh: tank.h / 2 };
}

/** Полуоси мирового AABB, в который вписан повёрнутый OBB корпуса. */
export function getTankObbWorldAabbHalfExtents(angle, w, h) {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    const hw0 = w / 2;
    const hh0 = h / 2;
    return { hw: hw0 * c + hh0 * s, hh: hw0 * s + hh0 * c };
}

/** OBB (центр tx,ty, угол angle, полуоси hw/hh) пересекает AABB кирпича. */
export function obbIntersectsBrick(tx, ty, angle, hw, hh, brick, brickSize = BRICK_SIZE) {
    const bcx = brick.x + brickSize / 2;
    const bcy = brick.y + brickSize / 2;
    const bhw = brickSize / 2;
    const bhh = brickSize / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const axes = [
        [cos, sin],
        [-sin, cos],
        [1, 0],
        [0, 1],
    ];
    for (let i = 0; i < 4; i++) {
        let ux = axes[i][0];
        let uy = axes[i][1];
        const len = Math.hypot(ux, uy);
        ux /= len;
        uy /= len;
        const tC = tx * ux + ty * uy;
        const tR = hw * Math.abs(cos * ux + sin * uy) + hh * Math.abs(-sin * ux + cos * uy);
        const bC = bcx * ux + bcy * uy;
        const bR = bhw * Math.abs(ux) + bhh * Math.abs(uy);
        if (tC + tR < bC - bR - SAT_EPS) return false;
        if (tC - tR > bC + bR + SAT_EPS) return false;
    }
    return true;
}

/** Хотя бы один угол OBB вне прямоугольника карты. */
export function tankObbOutOfMap(tx, ty, angle, hw, hh, mapWidth, mapHeight) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const pairs = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
    ];
    for (let k = 0; k < 4; k++) {
        const sx = pairs[k][0];
        const sy = pairs[k][1];
        const x = tx + sx * hw * cos - sy * hh * sin;
        const y = ty + sx * hw * sin + sy * hh * cos;
        if (x < 0 || x > mapWidth || y < 0 || y > mapHeight) return true;
    }
    return false;
}

/** -2 вне карты (OBB), >=0 индекс кирпича, -1 свободно. */
export function tankBrickCollisionIndex(tx, ty, angle, hw, hh, bricks, mapWidth, mapHeight) {
    if (tankObbOutOfMap(tx, ty, angle, hw, hh, mapWidth, mapHeight)) return -2;
    for (let i = 0; i < bricks.length; i++) {
        if (obbIntersectsBrick(tx, ty, angle, hw, hh, bricks[i])) return i;
    }
    return -1;
}

/**
 * AABB (центр x,y, полуоси hw,hh) vs границы карты и кирпичи (ось параллельна осям мира).
 * Возвращает -2 если вне карты, иначе индекс кирпича или -1.
 */
export function checkCollisionRect(x, y, hw, hh, mapWidth, mapHeight, bricks, brickSize = BRICK_SIZE) {
    if (x - hw < 0 || x + hw > mapWidth || y - hh < 0 || y + hh > mapHeight) return -2;
    for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (x + hw > b.x && x - hw < b.x + brickSize && y + hh > b.y && y - hh < b.y + brickSize) {
            return i;
        }
    }
    return -1;
}

/** Круговой запас для снарядов (квадратный AABB radius×radius). */
export function checkBulletBrickCollision(x, y, radius, mapWidth, mapHeight, bricks, brickSize = BRICK_SIZE) {
    return checkCollisionRect(x, y, radius, radius, mapWidth, mapHeight, bricks, brickSize);
}

export function clampTankCenterToMap(tank, mapWidth, mapHeight) {
    const { hw, hh } = getTankObbWorldAabbHalfExtents(tank.angle, tank.w, tank.h);
    tank.x = Math.max(hw, Math.min(mapWidth - hw, tank.x));
    tank.y = Math.max(hh, Math.min(mapHeight - hh, tank.y));
}

/** Мягкое выталкивание OBB из кирпича. */
export function separateTankFromBricks(tank, bricks, mapWidth, mapHeight, brickSize = BRICK_SIZE) {
    const { hw, hh } = getTankHullHalfExtents(tank);
    for (let iter = 0; iter < 20; iter++) {
        const idx = tankBrickCollisionIndex(tank.x, tank.y, tank.angle, hw, hh, bricks, mapWidth, mapHeight);
        if (idx < 0) return;
        if (idx === -2) {
            clampTankCenterToMap(tank, mapWidth, mapHeight);
            continue;
        }
        const b = bricks[idx];
        const bcx = b.x + brickSize / 2;
        const bcy = b.y + brickSize / 2;
        const dx = tank.x - bcx;
        const dy = tank.y - bcy;
        const d = Math.hypot(dx, dy) || 1;
        tank.x += (dx / d) * 1.25;
        tank.y += (dy / d) * 1.25;
    }
}

/** Поиск свободной точки спавна рядом с (x,y). */
export function findSpawnSpot(x, y, tank, bricks, mapWidth, mapHeight, stones) {
    const { hw, hh } = getTankHullHalfExtents(tank);
    const stoneArr = stones || [];
    const isFree = (px, py) =>
        tankBrickCollisionIndex(px, py, tank.angle, hw, hh, bricks, mapWidth, mapHeight) === -1
        && !tankStoneCollision(px, py, tank.angle, hw, hh, stoneArr);
    if (isFree(x, y)) return { x, y };
    for (let r = 50; r < 300; r += 50) {
        for (let a = 0; a < Math.PI * 2; a += 0.5) {
            const nx = x + Math.cos(a) * r;
            const ny = y + Math.sin(a) * r;
            if (isFree(nx, ny)) return { x: nx, y: ny };
        }
    }
    return { x, y };
}

/** Точка (px,py) внутри OBB (центр cx,cy, угол angle, полуоси hw,hh). */
export function pointInsideObb(px, py, cx, cy, angle, hw, hh) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = px - cx;
    const dy = py - cy;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    return Math.abs(localX) <= hw && Math.abs(localY) <= hh;
}

/** OBB-vs-OBB (SAT, 4 оси). */
export function obbIntersectsObb(ax, ay, aAngle, ahw, ahh, bx, by, bAngle, bhw, bhh) {
    const cosA = Math.cos(aAngle);
    const sinA = Math.sin(aAngle);
    const cosB = Math.cos(bAngle);
    const sinB = Math.sin(bAngle);
    const axes = [
        [cosA, sinA],
        [-sinA, cosA],
        [cosB, sinB],
        [-sinB, cosB],
    ];
    for (let i = 0; i < 4; i++) {
        const ux = axes[i][0];
        const uy = axes[i][1];
        const aC = ax * ux + ay * uy;
        const aR = ahw * Math.abs(cosA * ux + sinA * uy) + ahh * Math.abs(-sinA * ux + cosA * uy);
        const bC = bx * ux + by * uy;
        const bR = bhw * Math.abs(cosB * ux + sinB * uy) + bhh * Math.abs(-sinB * ux + cosB * uy);
        if (aC + aR < bC - bR - SAT_EPS) return false;
        if (aC - aR > bC + bR + SAT_EPS) return false;
    }
    return true;
}

// --- Камни (круглые хитбоксы) ---

const STONE_HITBOXES = {
    1: [{ dx: 3, dy: 25, r: 49.5 }, { dx: -7, dy: -37, r: 36.5 }],
    2: [{ dx: 0, dy: 0, r: 73.5 }],
    3: [{ dx: 0, dy: 0, r: 73.5 }],
    4: [{ dx: -27, dy: 8, r: 47 }, { dx: 17, dy: 1, r: 57 }],
    5: [{ dx: -32, dy: 0, r: 42.5 }, { dx: 40, dy: 7, r: 34.5 }],
};

/** Мировые круги хитбоксов камня с учётом поворота и масштаба. */
export function getStoneWorldCircles(stone) {
    const circles = STONE_HITBOXES[stone.type];
    if (!circles) return [];
    const cos = Math.cos(stone.angle);
    const sin = Math.sin(stone.angle);
    const s = stone.scale ?? 1;
    return circles.map((c) => ({
        cx: stone.x + (c.dx * cos - c.dy * sin) * s,
        cy: stone.y + (c.dx * sin + c.dy * cos) * s,
        r: c.r * s,
    }));
}

/** OBB (танк) vs Circle. */
export function obbIntersectsCircle(tx, ty, angle, hw, hh, cx, cy, r) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = cx - tx;
    const dy = cy - ty;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    const closestX = Math.max(-hw, Math.min(hw, localX));
    const closestY = Math.max(-hh, Math.min(hh, localY));
    const distX = localX - closestX;
    const distY = localY - closestY;
    return distX * distX + distY * distY < r * r;
}

/** Точка внутри круга (пуля vs камень). */
export function pointInCircle(px, py, cx, cy, r) {
    const dx = px - cx;
    const dy = py - cy;
    return dx * dx + dy * dy <= r * r;
}

/** Проверяет пулю (точка) против всех камней. */
export function checkBulletStoneCollision(bx, by, stones) {
    for (const stone of stones) {
        const circles = getStoneWorldCircles(stone);
        for (const c of circles) {
            if (pointInCircle(bx, by, c.cx, c.cy, c.r)) return true;
        }
    }
    return false;
}

/** Проверяет танк (OBB) против всех камней. */
export function tankStoneCollision(tx, ty, angle, hw, hh, stones) {
    for (const stone of stones) {
        const circles = getStoneWorldCircles(stone);
        for (const c of circles) {
            if (obbIntersectsCircle(tx, ty, angle, hw, hh, c.cx, c.cy, c.r)) return true;
        }
    }
    return false;
}

/** Выталкивание танка из камней. */
export function separateTankFromStones(tank, stones) {
    const { hw, hh } = getTankHullHalfExtents(tank);
    for (let iter = 0; iter < 20; iter++) {
        let pushed = false;
        for (const stone of stones) {
            const circles = getStoneWorldCircles(stone);
            for (const c of circles) {
                if (obbIntersectsCircle(tank.x, tank.y, tank.angle, hw, hh, c.cx, c.cy, c.r)) {
                    const dx = tank.x - c.cx;
                    const dy = tank.y - c.cy;
                    const d = Math.hypot(dx, dy) || 1;
                    tank.x += (dx / d) * 1.5;
                    tank.y += (dy / d) * 1.5;
                    pushed = true;
                }
            }
        }
        if (!pushed) return;
    }
}

/** Камера: центр вида в пределах карты (мировые координаты). */
export function clampCamera(cx, cy, viewWidth, viewHeight, scaleFactor, mapWidth, mapHeight) {
    const halfW = viewWidth / (2 * scaleFactor);
    const halfH = viewHeight / (2 * scaleFactor);
    if (halfW * 2 >= mapWidth) cx = mapWidth / 2;
    else cx = Math.max(halfW, Math.min(mapWidth - halfW, cx));
    if (halfH * 2 >= mapHeight) cy = mapHeight / 2;
    else cy = Math.max(halfH, Math.min(mapHeight - halfH, cy));
    return { x: cx, y: cy };
}
