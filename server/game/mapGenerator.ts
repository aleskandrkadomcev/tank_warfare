import { BRICK_SIZE, MAP_HEIGHT, MAP_WIDTH } from '#shared/map.js';
import { STONE_HITBOXES, STONE_TYPE_COUNT, getStoneWorldCircles } from '#shared/stoneData.js';
import type { StonePos } from '#shared/stoneData.js';
import { FOREST_SECTION_SIZE, FOREST_SECTION_STEP, SPAWN_BOX_SIZE } from '../constants.js';
import type { MapData } from '../ws/lobbyStore.js';

/** Проверяет, пересекается ли AABB (x,y,w,h) со спавн-боксами. */
function overlapsSpawnBox(rx: number, ry: number, rw: number, rh: number, mapW: number, mapH: number): boolean {
    // Team 1: top-left (0,0)→(SPAWN_BOX_SIZE, SPAWN_BOX_SIZE)
    if (rx < SPAWN_BOX_SIZE && ry < SPAWN_BOX_SIZE && rx + rw > 0 && ry + rh > 0) return true;
    // Team 2: bottom-right
    if (rx + rw > mapW - SPAWN_BOX_SIZE && ry + rh > mapH - SPAWN_BOX_SIZE && rx < mapW && ry < mapH) return true;
    return false;
}

function pointInSpawnBox(px: number, py: number, mapW: number, mapH: number): boolean {
    if (px < SPAWN_BOX_SIZE && py < SPAWN_BOX_SIZE) return true;
    if (px > mapW - SPAWN_BOX_SIZE && py > mapH - SPAWN_BOX_SIZE) return true;
    return false;
}

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
        const w = (Math.floor(Math.random() * 4) + 3) * BRICK_SIZE;
        const h = (Math.floor(Math.random() * 3) + 2) * BRICK_SIZE;
        let valid = false;
        let attempts = 0;
        let b: { x: number; y: number; w: number; h: number } | null = null;

        while (!valid && attempts < 50) {
            b = { x: Math.random() * (mapW - w), y: Math.random() * (mapH - h), w, h };
            valid = true;
            if (overlapsSpawnBox(b.x, b.y, b.w, b.h, mapW, mapH)) {
                valid = false;
                attempts++;
                continue;
            }
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
    const stones = generateStoneClusters(bricks, mapW, mapH, mapSize);
    return { bricks, forests, stones, biome, w: mapW, h: mapH };
}

// --- Генерация камней (одиночные + кластеры) ---

const STONE_SPAWN_MARGIN = 250;
const STONE_CLUSTER_DIAMETER = 250; // все камни кластера внутри этого круга
const STONE_MIN_DIST_IN_CLUSTER = 90; // мин расстояние между центрами камней в кластере
const STONE_MIN_DIST_BETWEEN_SPAWNS = 500; // мин расстояние между кластерами/одиночными
const STONE_SCALE_MIN = 0.9;
const STONE_SCALE_MAX = 1.1;

/** Круг (cx,cy,r) пересекает кирпич (AABB). */
function circleOverlapsBrick(cx: number, cy: number, r: number, bricks: { x: number; y: number }[]): boolean {
    for (const b of bricks) {
        const closestX = Math.max(b.x, Math.min(cx, b.x + BRICK_SIZE));
        const closestY = Math.max(b.y, Math.min(cy, b.y + BRICK_SIZE));
        const dx = cx - closestX;
        const dy = cy - closestY;
        if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
}

function randomScale(): number {
    return STONE_SCALE_MIN + Math.random() * (STONE_SCALE_MAX - STONE_SCALE_MIN);
}

/** Проверяет что камень не на кирпичах и не за картой (в зонах спавна не ставим). */
function isStonePositionValid(sx: number, sy: number, type: number, angle: number, scale: number, bricks: { x: number; y: number }[], mapW: number, mapH: number): boolean {
    if (sx < 100 || sx > mapW - 100 || sy < 100 || sy > mapH - 100) return false;
    if (sx < mapW * 0.15 || sx > mapW * 0.85) return false;
    if (pointInSpawnBox(sx, sy, mapW, mapH)) return false;
    const candidate: StonePos = { x: sx, y: sy, type, angle, scale };
    const circles = getStoneWorldCircles(candidate);
    for (const c of circles) {
        if (c.cx - c.r < 0 || c.cx + c.r > mapW || c.cy - c.r < 0 || c.cy + c.r > mapH) return false;
        if (circleOverlapsBrick(c.cx, c.cy, c.r + 10, bricks)) return false;
    }
    return true;
}

/** Перемешать массив (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function generateStoneClusters(bricks: { x: number; y: number }[], mapW: number, mapH: number, mapSize?: string): StonePos[] {
    const stones: StonePos[] = [];
    const totalSpawns = mapSize === 'large' ? 30 : mapSize === 'medium' ? 21 : 15;
    // Центры всех спавнов (кластеров и одиночных) для проверки минимального расстояния
    const spawnCenters: { x: number; y: number }[] = [];

    for (let si = 0; si < totalSpawns; si++) {
        const isCluster = Math.random() < 0.5;

        // Выбираем центр с учётом мин. расстояния до других спавнов
        let centerX = 0, centerY = 0, found = false;
        for (let att = 0; att < 60 && !found; att++) {
            centerX = STONE_SPAWN_MARGIN + Math.random() * (mapW - STONE_SPAWN_MARGIN * 2);
            centerY = STONE_SPAWN_MARGIN + Math.random() * (mapH - STONE_SPAWN_MARGIN * 2);
            if (centerX < mapW * 0.15 || centerX > mapW * 0.85) continue;
            // Проверяем расстояние до всех уже размещённых спавнов
            let tooClose = false;
            for (const sc of spawnCenters) {
                if (Math.hypot(centerX - sc.x, centerY - sc.y) < STONE_MIN_DIST_BETWEEN_SPAWNS) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) found = true;
        }
        if (!found) continue;

        if (isCluster) {
            // Кластер: 3–5 камней, все разных типов, внутри круга диаметром 200px
            const count = 3 + Math.floor(Math.random() * 3); // 3, 4 или 5
            // Берём случайные типы без повторений
            const availableTypes = shuffle([1, 2, 3, 4, 5]);
            const clusterStones: { x: number; y: number }[] = [];
            const clusterRadius = STONE_CLUSTER_DIAMETER / 2; // 100px

            for (let ci = 0; ci < count; ci++) {
                const type = availableTypes[ci];
                const angle = Math.random() * Math.PI * 2;
                const scale = randomScale();
                let placed = false;
                for (let att = 0; att < 40 && !placed; att++) {
                    // Случайная позиция внутри круга кластера
                    const da = Math.random() * Math.PI * 2;
                    const dr = Math.random() * clusterRadius;
                    const sx = centerX + Math.cos(da) * dr;
                    const sy = centerY + Math.sin(da) * dr;

                    // Проверяем мин. расстояние до других камней в кластере
                    let distOk = true;
                    for (const cs of clusterStones) {
                        if (Math.hypot(sx - cs.x, sy - cs.y) < STONE_MIN_DIST_IN_CLUSTER) {
                            distOk = false;
                            break;
                        }
                    }
                    if (!distOk) continue;

                    if (isStonePositionValid(sx, sy, type, angle, scale, bricks, mapW, mapH)) {
                        stones.push({ x: sx, y: sy, type, angle, scale });
                        clusterStones.push({ x: sx, y: sy });
                        placed = true;
                    }
                }
            }
            if (clusterStones.length > 0) {
                spawnCenters.push({ x: centerX, y: centerY });
            }
        } else {
            // Одиночный камень
            const type = 1 + Math.floor(Math.random() * STONE_TYPE_COUNT);
            const angle = Math.random() * Math.PI * 2;
            const scale = randomScale();
            if (isStonePositionValid(centerX, centerY, type, angle, scale, bricks, mapW, mapH)) {
                stones.push({ x: centerX, y: centerY, type, angle, scale });
                spawnCenters.push({ x: centerX, y: centerY });
            }
        }
    }
    return stones;
}

