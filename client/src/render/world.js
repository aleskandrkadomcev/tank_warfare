/**
 * Фон карты (без серой разметки), кирпичи, лес и бусты на земле.
 */
import { BOOST_ICON_SCALE, BRICK_SIZE } from '../config/constants.js';
import { assets } from '../lib/assets.js';
import { bakeLitSprite, renderFlashOverlay } from './lightingRenderer.js';

let bricksCanvas = null;
let bricksCtx = null;
let bricksCacheKey = '';

let brickShadowCanvas = null;
let brickShadowCtx = null;
let brickShadowCacheKey = '';

/** Кэш «земля + сетка» целиком — не перерисовывать 2× fillRect паттерном на 3200×1800 каждый кадр. */
let landCanvas = null;
let landCtx = null;
let landCacheKey = '';

function ensureLandCanvas(w, h) {
    if (!landCanvas) {
        landCanvas = document.createElement('canvas');
        landCtx = landCanvas.getContext('2d');
    }
    if (landCanvas.width !== w || landCanvas.height !== h) {
        landCanvas.width = w;
        landCanvas.height = h;
    }
}

/**
 * Собирает подложку в offscreen; ключ сбрасывается при смене карты/биома/готовности текстур.
 */
function rebuildLandCache(mapWidth, mapHeight, biome, cachedPatterns, grassImg, perlinImg) {
    if (grassImg.complete && grassImg.naturalWidth === 0) {
        cachedPatterns.grassBase = null;
        cachedPatterns.perlinMask = null;
    }
    ensureLandCanvas(mapWidth, mapHeight);

    let grassPat = null;
    let perlinPat = null;
    if (grassImg.complete && grassImg.naturalWidth > 0) {
        grassPat = landCtx.createPattern(grassImg, 'repeat');
        cachedPatterns.grassBase = grassPat || null;
    } else {
        cachedPatterns.grassBase = null;
    }
    if (perlinImg.complete && perlinImg.naturalWidth > 0) {
        perlinPat = landCtx.createPattern(perlinImg, 'repeat');
        cachedPatterns.perlinMask = perlinPat || null;
    } else {
        cachedPatterns.perlinMask = null;
    }

    if (grassPat) {
        landCtx.fillStyle = grassPat;
        landCtx.fillRect(0, 0, mapWidth, mapHeight);
        if (perlinPat) {
            landCtx.save();
            landCtx.globalCompositeOperation = 'overlay';
            landCtx.globalAlpha = 0.3;
            landCtx.fillStyle = perlinPat;
            landCtx.fillRect(0, 0, mapWidth, mapHeight);
            landCtx.restore();
        }
    } else {
        landCtx.fillStyle = ['#888', '#eee', '#deb887'][biome];
        landCtx.fillRect(0, 0, mapWidth, mapHeight);
    }
    landCtx.globalAlpha = 1;
    landCtx.globalCompositeOperation = 'source-over';
}

/**
 * @param {CanvasRenderingContext2D} ctx — уже в мировых координатах (после translate/scale)
 * @param {object} o
 */
export function drawMapBackground(ctx, o) {
    const { mapWidth, mapHeight, biome, cachedPatterns, grassImg, perlinImg } = o;
    const grassOk = grassImg.complete && grassImg.naturalWidth > 0;
    const perlinOk = perlinImg.complete && perlinImg.naturalWidth > 0;
    const key = `${mapWidth}|${mapHeight}|${biome}|${grassOk}|${perlinOk}`;
    if (key !== landCacheKey || landCanvas?.width !== mapWidth || landCanvas?.height !== mapHeight) {
        landCacheKey = key;
        rebuildLandCache(mapWidth, mapHeight, biome, cachedPatterns, grassImg, perlinImg);
    }
    ctx.drawImage(landCanvas, 0, 0);
}

function ensureBricksCanvas(w, h) {
    if (!bricksCanvas) {
        bricksCanvas = document.createElement('canvas');
        bricksCtx = bricksCanvas.getContext('2d');
    }
    if (bricksCanvas.width !== w || bricksCanvas.height !== h) {
        bricksCanvas.width = w;
        bricksCanvas.height = h;
    }
}

/**
 * Кирпичи рисуются в offscreen при неизменном `revision` (размер карты, биом, набор кирпичей).
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @param {number} bricksDrawRevision — `world.bricksDrawRevision`, инкремент при мутации массива
 */
export function drawBricks(ctx, bricks, mapWidth, mapHeight, bricksDrawRevision) {
    const key = `${bricksDrawRevision}|${mapWidth}|${mapHeight}|${bricks.length}`;
    if (key !== bricksCacheKey || bricksCanvas?.width !== mapWidth || bricksCanvas?.height !== mapHeight) {
        bricksCacheKey = key;
        ensureBricksCanvas(mapWidth, mapHeight);
        bricksCtx.clearRect(0, 0, mapWidth, mapHeight);
        const brickImg = assets.images.brick;
        const brickImgOk = brickImg?.complete && brickImg.naturalWidth > 0;
        for (const b of bricks) {
            if (brickImgOk) {
                bricksCtx.drawImage(brickImg, b.x, b.y);
            } else {
                bricksCtx.fillStyle = '#8b4513';
                bricksCtx.fillRect(b.x, b.y, BRICK_SIZE - 1, BRICK_SIZE - 1);
            }
        }
    }
    ctx.drawImage(bricksCanvas, 0, 0);
}

function ensureBrickShadowCanvas(w, h) {
    if (!brickShadowCanvas) {
        brickShadowCanvas = document.createElement('canvas');
        brickShadowCtx = brickShadowCanvas.getContext('2d');
    }
    if (brickShadowCanvas.width !== w || brickShadowCanvas.height !== h) {
        brickShadowCanvas.width = w;
        brickShadowCanvas.height = h;
    }
}

/** Тени кирпичей — отдельный слой, рисуется ВЫШЕ танков. */
export function drawBrickShadows(ctx, bricks, mapWidth, mapHeight, bricksDrawRevision) {
    const key = `${bricksDrawRevision}|${mapWidth}|${mapHeight}|${bricks.length}`;
    if (key !== brickShadowCacheKey || brickShadowCanvas?.width !== mapWidth || brickShadowCanvas?.height !== mapHeight) {
        brickShadowCacheKey = key;
        ensureBrickShadowCanvas(mapWidth, mapHeight);
        brickShadowCtx.clearRect(0, 0, mapWidth, mapHeight);
        const shadowImg = assets.images.shadowBrick;
        const shadowOk = shadowImg?.complete && shadowImg.naturalWidth > 0;
        for (const b of bricks) {
            if (shadowOk) {
                brickShadowCtx.drawImage(shadowImg, b.x, b.y);
            } else {
                brickShadowCtx.fillStyle = 'rgba(0,0,0,0.18)';
                brickShadowCtx.fillRect(b.x + 20, b.y + 20, BRICK_SIZE - 1, BRICK_SIZE - 1);
            }
        }
    }
    ctx.drawImage(brickShadowCanvas, 0, 0);
}

/* ── Кусты (bush2, bush3) — отдельные спрайты с рандомным углом ── */
const BUSH_SHADOW_OFFSET = 8;

function getBushImg(type) {
    return assets.images['bush' + type];
}
function getBushShadowImg(type) {
    return assets.images['bush' + type + 'Shadow'];
}

/**
 * Тени кустов — рисуются ПОД кустами, НАД танками/кирпичами.
 */
export function drawForestShadows(ctx, forests) {
    if (!Array.isArray(forests) || forests.length === 0) return;
    for (const f of forests) {
        const img = getBushShadowImg(f.type);
        if (!img?.complete || !img.naturalWidth) continue;
        const sc = f.scale || 0.25;
        const w = img.naturalWidth * sc;
        const h = img.naturalHeight * sc;
        ctx.save();
        ctx.translate(f.x + BUSH_SHADOW_OFFSET, f.y + BUSH_SHADOW_OFFSET);
        ctx.rotate(f.angle);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
}

export function drawForests(ctx, forests) {
    if (!Array.isArray(forests) || forests.length === 0) return;
    for (const f of forests) {
        const img = getBushImg(f.type);
        const sc = f.scale || 0.25;
        if (!img?.complete || !img.naturalWidth) {
            // Fallback
            ctx.fillStyle = 'rgba(36, 92, 42, 0.45)';
            ctx.beginPath();
            ctx.arc(f.x, f.y, 37.5 * (sc / 0.25), 0, Math.PI * 2);
            ctx.fill();
            continue;
        }
        const w = img.naturalWidth * sc;
        const h = img.naturalHeight * sc;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
}

const STONE_SPRITE_HALF = 75; // 150 / 2
const STONE_SHADOW_OFFSET = 12; // ~17px по диагонали 45° (12*√2 ≈ 17)

let stoneShadowCanvas = null;
let stoneShadowCtx = null;
let stoneShadowCacheKey = '';

let stoneBodyCanvas = null;
let stoneBodyCtx = null;
let stoneBodyCacheKey = '';

function ensureStoneShadowCanvas(w, h) {
    if (!stoneShadowCanvas) {
        stoneShadowCanvas = document.createElement('canvas');
        stoneShadowCtx = stoneShadowCanvas.getContext('2d');
    }
    if (stoneShadowCanvas.width !== w || stoneShadowCanvas.height !== h) {
        stoneShadowCanvas.width = w;
        stoneShadowCanvas.height = h;
    }
}

function ensureStoneBodyCanvas(w, h) {
    if (!stoneBodyCanvas) {
        stoneBodyCanvas = document.createElement('canvas');
        stoneBodyCtx = stoneBodyCanvas.getContext('2d');
    }
    if (stoneBodyCanvas.width !== w || stoneBodyCanvas.height !== h) {
        stoneBodyCanvas.width = w;
        stoneBodyCanvas.height = h;
    }
}

/** Запекает тени камней в offscreen-канвас (раз за раунд).
 *  Рисуем каждый спрайт далеко за экраном, используя canvas shadow для получения
 *  чёрного размытого силуэта со смещением. Сам спрайт уходит за clip и не виден. */
function rebuildStoneShadowCache(stones, mapWidth, mapHeight) {
    ensureStoneShadowCanvas(mapWidth, mapHeight);
    stoneShadowCtx.clearRect(0, 0, mapWidth, mapHeight);

    stoneShadowCtx.save();
    stoneShadowCtx.shadowColor = 'rgba(0,0,0,0.4)';
    stoneShadowCtx.shadowBlur = 5;
    // Рисуем спрайт смещённым на -10000, а тень с shadowOffset попадёт на нужное место
    const FAR = 10000;
    for (const s of stones) {
        const img = assets.images['stone' + s.type];
        const imgOk = img?.complete && img.naturalWidth > 0;
        if (!imgOk) continue;
        const sc = s.scale ?? 1;
        // Тень должна быть на (s.x + offset, s.y + offset), а спрайт рисуем на (s.x - FAR, s.y - FAR)
        stoneShadowCtx.shadowOffsetX = FAR + STONE_SHADOW_OFFSET;
        stoneShadowCtx.shadowOffsetY = FAR + STONE_SHADOW_OFFSET;
        stoneShadowCtx.save();
        stoneShadowCtx.translate(s.x - FAR, s.y - FAR);
        stoneShadowCtx.rotate(s.angle);
        stoneShadowCtx.scale(sc * 1.05, sc * 1.05);
        stoneShadowCtx.drawImage(img, -STONE_SPRITE_HALF, -STONE_SPRITE_HALF);
        stoneShadowCtx.restore();
    }
    stoneShadowCtx.restore();
    // Очищаем область где нарисовались сами спрайты (далеко за экраном) — не нужно, они вне канваса
}

/** Запекает тела камней в offscreen-канвас (раз за раунд), с нормал-мап освещением. */
function rebuildStoneBodyCache(stones, mapWidth, mapHeight) {
    ensureStoneBodyCanvas(mapWidth, mapHeight);
    stoneBodyCtx.clearRect(0, 0, mapWidth, mapHeight);
    for (const s of stones) {
        const img = assets.images['stone' + s.type];
        const nmImg = assets.images['stone' + s.type + 'NM'];
        const imgOk = img?.complete && img.naturalWidth > 0;
        const nmOk = nmImg?.complete && nmImg.naturalWidth > 0;
        const sc = s.scale ?? 1;

        if (imgOk && nmOk) {
            // Запекаем с солнечным освещением через WebGL
            const litCanvas = bakeLitSprite(img, nmImg, 1, s.angle);
            if (litCanvas) {
                stoneBodyCtx.save();
                stoneBodyCtx.translate(s.x, s.y);
                stoneBodyCtx.rotate(s.angle);
                stoneBodyCtx.scale(sc, sc);
                stoneBodyCtx.drawImage(litCanvas, -litCanvas.width / 2, -litCanvas.height / 2);
                stoneBodyCtx.restore();
                continue;
            }
        }

        // Fallback — без освещения
        stoneBodyCtx.save();
        stoneBodyCtx.translate(s.x, s.y);
        stoneBodyCtx.rotate(s.angle);
        stoneBodyCtx.scale(sc, sc);
        if (imgOk) {
            stoneBodyCtx.drawImage(img, -STONE_SPRITE_HALF, -STONE_SPRITE_HALF);
        } else {
            stoneBodyCtx.fillStyle = '#777';
            stoneBodyCtx.beginPath();
            stoneBodyCtx.arc(0, 0, 60, 0, Math.PI * 2);
            stoneBodyCtx.fill();
        }
        stoneBodyCtx.restore();
    }
}

/** Отрисовка теней камней (вызывать до танков или вместе с тенями кирпичей). */
export function drawStoneShadows(ctx, stones, mapWidth, mapHeight) {
    if (!Array.isArray(stones) || stones.length === 0) return;
    const key = `${stones.length}|${mapWidth}|${mapHeight}`;
    if (key !== stoneShadowCacheKey || stoneShadowCanvas?.width !== mapWidth || stoneShadowCanvas?.height !== mapHeight) {
        stoneShadowCacheKey = key;
        rebuildStoneShadowCache(stones, mapWidth, mapHeight);
    }
    ctx.drawImage(stoneShadowCanvas, 0, 0);
}

/** Отрисовка тел камней. */
export function drawStones(ctx, stones, mapWidth, mapHeight) {
    if (!Array.isArray(stones) || stones.length === 0) return;
    const key = `${stones.length}|${mapWidth}|${mapHeight}`;
    if (key !== stoneBodyCacheKey || stoneBodyCanvas?.width !== mapWidth || stoneBodyCanvas?.height !== mapHeight) {
        stoneBodyCacheKey = key;
        rebuildStoneBodyCache(stones, mapWidth, mapHeight);
    }
    ctx.drawImage(stoneBodyCanvas, 0, 0);
}

const STONE_FLASH_RADIUS = 300; // макс дистанция вспышки для камней

/**
 * Подсветка камней вспышками выстрелов (normal map point light).
 * Вызывается после drawStones, рисуется additive поверх.
 */
export function drawStoneFlashLighting(ctx, particles, stones) {
    if (!Array.isArray(stones) || stones.length === 0) return;

    // Собираем активные вспышки
    const flashes = [];
    for (const p of particles) {
        if (p.type === 'muzzle_flash' && p.life > 0.01) {
            flashes.push(p);
        }
    }
    if (flashes.length === 0) return;

    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    for (const flash of flashes) {
        const intensity = Math.min(flash.life / (flash.maxLife || 0.14), 1) * 2.0;

        for (const s of stones) {
            const dx = flash.x - s.x;
            const dy = flash.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist >= STONE_FLASH_RADIUS) continue;

            const img = assets.images['stone' + s.type];
            const nmImg = assets.images['stone' + s.type + 'NM'];
            if (!img?.complete || !nmImg?.complete) continue;

            const sc = s.scale ?? 1;
            // Мировые координаты вспышки → локальные координаты спрайта камня
            const cosA = Math.cos(-s.angle);
            const sinA = Math.sin(-s.angle);
            const localX = (cosA * dx - sinA * dy);
            const localY = (sinA * dx + cosA * dy);

            const overlay = renderFlashOverlay(img, nmImg, 1, localX, localY, intensity);
            if (overlay) {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(s.angle);
                ctx.scale(sc, sc);
                ctx.drawImage(overlay, -overlay.width / 2, -overlay.height / 2);
                ctx.restore();
            }
        }
    }

    ctx.globalCompositeOperation = prevComp;
}

/** Маппинг type → ключ в assets.images */
const BOOST_TYPE_TO_IMAGE = [
    'repairBox',   // 0 — хилка
    'atackSpeed',  // 1 — урон
    'speedBoost',  // 2 — скорость
    'smokeBox',    // 3 — дым
    'mineBox',     // 4 — мина
    'rocketBox',   // 5 — ракета
];

export function drawBoostIcon(ctx, x, y, type) {
    const key = BOOST_TYPE_TO_IMAGE[type];
    const img = key && assets.images[key];
    if (img && img.complete && img.naturalWidth > 0) {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    } else {
        // Фолбэк — простой цветной круг
        const colors = ['#4CAF50', '#f44336', '#2196F3', '#888', '#2e4634', '#ffeb3b'];
        ctx.fillStyle = colors[type] || '#888';
        ctx.beginPath();
        ctx.arc(x, y, 12 * BOOST_ICON_SCALE, 0, Math.PI * 2);
        ctx.fill();
    }
}
