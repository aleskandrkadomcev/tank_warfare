import { describe, expect, it } from 'vitest';
import { BRICK_SIZE } from '#shared/map.js';
import { buildBotPathGrid, findBotPath } from './pathfinding.js';

describe('bot pathfinding', () => {
    it('обходит сплошную стену кирпичей', () => {
        const map = {
            w: 320,
            h: 320,
            biome: 0,
            bricks: [
                { x: 80, y: 0 },
                { x: 80, y: 80 },
                { x: 80, y: 240 },
            ],
        };
        const grid = buildBotPathGrid(map, BRICK_SIZE / 2);
        const path = findBotPath(grid, { x: 40, y: 40 }, { x: 280, y: 280 });

        expect(path.length).toBeGreaterThan(0);
        expect(path.some((p) => p.x > 120)).toBe(true);
        expect(
            path.every(
                (p) =>
                    !(
                        (p.x >= 80 && p.x <= 160 && p.y >= 0 && p.y <= 80) ||
                        (p.x >= 80 && p.x <= 160 && p.y >= 80 && p.y <= 160) ||
                        (p.x >= 80 && p.x <= 160 && p.y >= 240 && p.y <= 320)
                    ),
            ),
        ).toBe(true);
    });
});
