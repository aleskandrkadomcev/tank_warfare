import { describe, expect, it } from 'vitest';
import { BRICK_SIZE, MAP_HEIGHT, MAP_WIDTH } from '#shared/map.js';
import { generateMapData } from './mapGenerator.js';

describe('generateMapData', () => {
    it('инварианты размеров и биома (несколько прогонов)', () => {
        for (let i = 0; i < 5; i++) {
            const map = generateMapData();
            expect(map.w).toBe(MAP_WIDTH);
            expect(map.h).toBe(MAP_HEIGHT);
            expect(map.biome).toBeGreaterThanOrEqual(0);
            expect(map.biome).toBeLessThanOrEqual(2);

            for (const b of map.bricks) {
                expect(Number.isFinite(b.x) && Number.isFinite(b.y)).toBe(true);
                expect(b.x).toBeGreaterThanOrEqual(0);
                expect(b.y).toBeGreaterThanOrEqual(0);
                expect(b.x + BRICK_SIZE).toBeLessThanOrEqual(MAP_WIDTH + 1e-6);
                expect(b.y + BRICK_SIZE).toBeLessThanOrEqual(MAP_HEIGHT + 1e-6);
            }
        }
    });

    it('обычно появляются кирпичи (15 попыток построить здания)', () => {
        const map = generateMapData();
        expect(map.bricks.length).toBeGreaterThan(0);
    });
});
