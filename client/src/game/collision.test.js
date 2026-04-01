import { describe, expect, it } from 'vitest';
import { BRICK_SIZE } from '../config/constants.js';
import {
    checkBulletBrickCollision,
    checkCollisionRect,
    clampCamera,
    clampTankCenterToMap,
    getTankObbWorldAabbHalfExtents,
    obbIntersectsBrick,
    SAT_EPS,
    tankBrickCollisionIndex,
    tankObbOutOfMap,
} from './collision.js';

describe('collision', () => {
    it('obbIntersectsBrick: танк над кирпичом пересекает', () => {
        const brick = { x: 100, y: 100 };
        const tx = 100 + BRICK_SIZE / 2;
        const ty = 100 + BRICK_SIZE / 2;
        expect(obbIntersectsBrick(tx, ty, 0, 37.5, 22.5, brick)).toBe(true);
    });

    it('obbIntersectsBrick: далеко слева не пересекает', () => {
        const brick = { x: 500, y: 500 };
        expect(obbIntersectsBrick(50, 50, 0, 37.5, 22.5, brick)).toBe(false);
    });

    it('tankObbOutOfMap: центр внутри — false', () => {
        expect(tankObbOutOfMap(400, 300, 0, 40, 25, 2000, 2000)).toBe(false);
    });

    it('tankObbOutOfMap: угол OBB за правой границей — true', () => {
        const mapW = 800;
        const angle = 0;
        const hw = 37.5;
        const hh = 22.5;
        const tx = mapW - hw + 5;
        expect(tankObbOutOfMap(tx, 400, angle, hw, hh, mapW, 2000)).toBe(true);
    });

    it('checkCollisionRect: пуля внутри кирпича', () => {
        const bricks = [{ x: 100, y: 100 }];
        const idx = checkCollisionRect(
            100 + BRICK_SIZE / 2,
            100 + BRICK_SIZE / 2,
            2,
            2,
            2000,
            2000,
            bricks,
        );
        expect(idx).toBe(0);
    });

    it('checkBulletBrickCollision совпадает с радиусом 2', () => {
        const bricks = [{ x: 0, y: 0 }];
        const a = checkCollisionRect(5, 5, 2, 2, 2000, 2000, bricks);
        const b = checkBulletBrickCollision(5, 5, 2, 2000, 2000, bricks);
        expect(a).toBe(b);
    });

    it('tankBrickCollisionIndex: -1 на пустом поле', () => {
        const tank = { w: 75, h: 45, angle: 0 };
        const { hw, hh } = { hw: tank.w / 2, hh: tank.h / 2 };
        expect(tankBrickCollisionIndex(200, 200, 0, hw, hh, [], 2000, 2000)).toBe(-1);
    });

    it('clampTankCenterToMap не выталкивает валидный центр', () => {
        const tank = { x: 500, y: 400, angle: 0, w: 75, h: 45 };
        const copy = { ...tank };
        clampTankCenterToMap(copy, 2000, 2000);
        expect(copy.x).toBe(500);
        expect(copy.y).toBe(400);
    });

    it('clampTankCenterToMap ограничивает у левого края', () => {
        const tank = { x: 0, y: 500, angle: 0, w: 75, h: 45 };
        clampTankCenterToMap(tank, 2000, 2000);
        const { hw } = getTankObbWorldAabbHalfExtents(0, 75, 45);
        expect(tank.x).toBeGreaterThanOrEqual(hw);
    });

    it('clampCamera центрирует при узкой карте', () => {
        const c = clampCamera(100, 100, 1920, 1080, 1, 800, 600);
        expect(c.x).toBe(400);
        expect(c.y).toBe(300);
    });

    it('SAT_EPS используется для стабильности осей', () => {
        expect(SAT_EPS).toBeGreaterThan(0);
        expect(SAT_EPS).toBeLessThan(1e-2);
    });
});
