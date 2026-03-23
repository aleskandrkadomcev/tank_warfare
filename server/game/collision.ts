import { BRICK_SIZE } from '#shared/map.js';
import type { BrickPos } from '../ws/lobbyStore.js';

export const SAT_EPS = 1e-4;

export type TankLike = {
    x: number;
    y: number;
    angle: number;
    w: number;
    h: number;
};

export function getTankHullHalfExtents(tank: TankLike): { hw: number; hh: number } {
    return { hw: tank.w / 2, hh: tank.h / 2 };
}

export function getTankObbWorldAabbHalfExtents(angle: number, w: number, h: number): { hw: number; hh: number } {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    const hw0 = w / 2;
    const hh0 = h / 2;
    return { hw: hw0 * c + hh0 * s, hh: hw0 * s + hh0 * c };
}

export function obbIntersectsBrick(
    tx: number,
    ty: number,
    angle: number,
    hw: number,
    hh: number,
    brick: BrickPos,
    brickSize = BRICK_SIZE,
): boolean {
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

export function tankObbOutOfMap(
    tx: number,
    ty: number,
    angle: number,
    hw: number,
    hh: number,
    mapWidth: number,
    mapHeight: number,
): boolean {
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

export function tankBrickCollisionIndex(
    tx: number,
    ty: number,
    angle: number,
    hw: number,
    hh: number,
    bricks: BrickPos[],
    mapWidth: number,
    mapHeight: number,
): number {
    if (tankObbOutOfMap(tx, ty, angle, hw, hh, mapWidth, mapHeight)) return -2;
    for (let i = 0; i < bricks.length; i++) {
        if (obbIntersectsBrick(tx, ty, angle, hw, hh, bricks[i])) return i;
    }
    return -1;
}

export function checkBulletBrickCollision(
    x: number,
    y: number,
    radius: number,
    mapWidth: number,
    mapHeight: number,
    bricks: BrickPos[],
    brickSize = BRICK_SIZE,
): number {
    if (x - radius < 0 || x + radius > mapWidth || y - radius < 0 || y + radius > mapHeight) return -2;
    for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (x + radius > b.x && x - radius < b.x + brickSize && y + radius > b.y && y - radius < b.y + brickSize) {
            return i;
        }
    }
    return -1;
}

/** Точка (px,py) внутри OBB (центр cx,cy, угол angle, полуоси hw,hh). */
export function pointInsideObb(
    px: number, py: number,
    cx: number, cy: number, angle: number,
    hw: number, hh: number,
): boolean {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = px - cx;
    const dy = py - cy;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    return Math.abs(localX) <= hw && Math.abs(localY) <= hh;
}

/** OBB-vs-OBB (SAT, 4 оси). */
export function obbIntersectsObb(
    ax: number, ay: number, aAngle: number, ahw: number, ahh: number,
    bx: number, by: number, bAngle: number, bhw: number, bhh: number,
): boolean {
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

export function clampTankCenterToMap(tank: TankLike, mapWidth: number, mapHeight: number): void {
    const { hw, hh } = getTankObbWorldAabbHalfExtents(tank.angle, tank.w, tank.h);
    tank.x = Math.max(hw, Math.min(mapWidth - hw, tank.x));
    tank.y = Math.max(hh, Math.min(mapHeight - hh, tank.y));
}

export function separateTankFromBricks(
    tank: TankLike,
    bricks: BrickPos[],
    mapWidth: number,
    mapHeight: number,
    brickSize = BRICK_SIZE,
): void {
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
