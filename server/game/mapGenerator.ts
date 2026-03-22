import { BRICK_SIZE, MAP_HEIGHT, MAP_WIDTH } from '#shared/map.js';
import { FOREST_SECTION_SIZE, FOREST_SECTION_STEP } from '../constants.js';
import type { MapData } from '../ws/lobbyStore.js';

const FOREST_GROUP_SIZE_MIN = 3;
const FOREST_GROUP_SIZE_MAX = 12;

function overlapsBrick(bricks: { x: number; y: number }[], fx: number, fy: number): boolean {
    const fx2 = fx + FOREST_SECTION_SIZE;
    const fy2 = fy + FOREST_SECTION_SIZE;
    return bricks.some((b) => {
        const bx2 = b.x + BRICK_SIZE;
        const by2 = b.y + BRICK_SIZE;
        return fx < bx2 && fx2 > b.x && fy < by2 && fy2 > b.y;
    });
}

function isInsideMap(x: number, y: number, w: number, h: number): boolean {
    return x >= 0 && y >= 0 && x + FOREST_SECTION_SIZE <= w && y + FOREST_SECTION_SIZE <= h;
}

function forestKey(x: number, y: number): string {
    return `${x}:${y}`;
}

function tryGenerateForestGroups(bricks: { x: number; y: number }[], mapW: number, mapH: number, forestGroupsMax: number): { x: number; y: number }[] {
    const forests: { x: number; y: number }[] = [];
    const used = new Set<string>();
    const groupsCount = Math.floor(Math.random() * (forestGroupsMax - 1 + 1)) + 1;

    for (let groupIndex = 0; groupIndex < groupsCount; groupIndex++) {
        const groupSize =
            Math.floor(Math.random() * (FOREST_GROUP_SIZE_MAX - FOREST_GROUP_SIZE_MIN + 1)) + FOREST_GROUP_SIZE_MIN;
        let placed = false;

        for (let attempts = 0; attempts < 120 && !placed; attempts++) {
            const startX = Math.floor(Math.random() * (mapW - FOREST_SECTION_SIZE));
            const startY = Math.floor(Math.random() * (mapH - FOREST_SECTION_SIZE));
            const sx = Math.floor(startX / FOREST_SECTION_STEP) * FOREST_SECTION_STEP;
            const sy = Math.floor(startY / FOREST_SECTION_STEP) * FOREST_SECTION_STEP;
            if (!isInsideMap(sx, sy, mapW, mapH) || overlapsBrick(bricks, sx, sy)) continue;
            if (used.has(forestKey(sx, sy))) continue;

            const group: { x: number; y: number }[] = [{ x: sx, y: sy }];
            const local = new Set<string>([forestKey(sx, sy)]);
            const frontier: { x: number; y: number }[] = [{ x: sx, y: sy }];

            while (group.length < groupSize && frontier.length > 0) {
                const base = frontier[Math.floor(Math.random() * frontier.length)];
                const dirs = [
                    { x: FOREST_SECTION_STEP, y: 0 },
                    { x: -FOREST_SECTION_STEP, y: 0 },
                    { x: 0, y: FOREST_SECTION_STEP },
                    { x: 0, y: -FOREST_SECTION_STEP },
                ];
                const dir = dirs[Math.floor(Math.random() * dirs.length)];
                const nx = base.x + dir.x;
                const ny = base.y + dir.y;
                const key = forestKey(nx, ny);
                if (!isInsideMap(nx, ny, mapW, mapH)) continue;
                if (local.has(key) || used.has(key)) continue;
                if (overlapsBrick(bricks, nx, ny)) continue;
                group.push({ x: nx, y: ny });
                local.add(key);
                frontier.push({ x: nx, y: ny });
            }

            if (group.length >= FOREST_GROUP_SIZE_MIN) {
                group.forEach((cell) => {
                    forests.push(cell);
                    used.add(forestKey(cell.x, cell.y));
                });
                placed = true;
            }
        }
    }
    return forests;
}

export function generateMapData(mapSize?: string): MapData {
    let mapW = MAP_WIDTH;
    let mapH = MAP_HEIGHT;
    if (mapSize === 'medium') { mapW = Math.round(MAP_WIDTH * 1.3); mapH = Math.round(MAP_HEIGHT * 1.3); }
    else if (mapSize === 'large') { mapW = Math.round(MAP_WIDTH * 1.6); mapH = Math.round(MAP_HEIGHT * 1.6); }

    const bricks: { x: number; y: number }[] = [];
    const biome = 0;
    const buildings: { x: number; y: number; w: number; h: number }[] = [];
    const buildingCount = mapSize === 'large' ? 24 : mapSize === 'medium' ? 20 : 15;
    const forestGroupsMax = mapSize === 'large' ? 7 : mapSize === 'medium' ? 5 : 4;

    for (let i = 0; i < buildingCount; i++) {
        const w = (Math.floor(Math.random() * 6) + 3) * BRICK_SIZE;
        const h = (Math.floor(Math.random() * 3) + 3) * BRICK_SIZE;
        let valid = false;
        let attempts = 0;
        let b: { x: number; y: number; w: number; h: number } | null = null;

        while (!valid && attempts < 50) {
            b = { x: Math.random() * (mapW - w), y: Math.random() * (mapH - h), w, h };
            valid = true;
            for (const other of buildings) {
                if (
                    b.x < other.x + other.w + BRICK_SIZE &&
                    b.x + b.w + BRICK_SIZE > other.x &&
                    b.y < other.y + other.h + BRICK_SIZE &&
                    b.y + b.h + BRICK_SIZE > other.y
                ) {
                    valid = false;
                    break;
                }
            }
            attempts++;
        }

        if (valid && b) {
            buildings.push(b);
            for (let r = 0; r < b.h / BRICK_SIZE; r++) {
                for (let c = 0; c < b.w / BRICK_SIZE; c++) {
                    bricks.push({ x: b.x + c * BRICK_SIZE, y: b.y + r * BRICK_SIZE });
                }
            }
        }
    }

    const forests = tryGenerateForestGroups(bricks, mapW, mapH, forestGroupsMax);
    return { bricks, forests, biome, w: mapW, h: mapH };
}
