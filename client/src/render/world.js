/**
 * Фон карты (без серой разметки), кирпичи, лес и бусты на земле.
 */
import { BOOST_ICON_SCALE, BRICK_SIZE } from '../config/constants.js';
import { assets } from '../lib/assets.js';

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

/**
 * Отрисовка леса как оверлей-текстуры секций (каждая секция: 97px, шаг 89px задаётся генератором).
 * Лес рисуется поверх карты/танков и ниже дыма абилки.
 */
/**
 * Тени леса — рисуются ПОД лесом, НАД танками/кирпичами.
 */
export function drawForestShadows(ctx, forests, shadowForestImg) {
    if (!Array.isArray(forests) || forests.length === 0) return;
    const imageOk = shadowForestImg?.complete && shadowForestImg.naturalWidth > 0;
    if (!imageOk) return;
    for (const f of forests) {
        ctx.drawImage(shadowForestImg, f.x, f.y);
    }
}

export function drawForests(ctx, forests, forestImg) {
    if (!Array.isArray(forests) || forests.length === 0) return;
    const imageOk = forestImg?.complete && forestImg.naturalWidth > 0;
    for (const f of forests) {
        if (imageOk) {
            ctx.drawImage(forestImg, f.x, f.y);
            continue;
        }
        // Fallback: полупрозрачный патч леса до загрузки спрайта.
        ctx.fillStyle = 'rgba(36, 92, 42, 0.45)';
        ctx.fillRect(f.x, f.y, 97, 97);
    }
}

export function drawBoostIcon(ctx, x, y, type) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(BOOST_ICON_SCALE, BOOST_ICON_SCALE);
    const r = 12;
    if (type === 0) {
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-5, 2);
        ctx.lineTo(0, 7);
        ctx.lineTo(5, -3);
        ctx.moveTo(0, 7);
        ctx.lineTo(0, -5);
        ctx.stroke();
    } else if (type === 1) {
        ctx.fillStyle = '#f44336';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.moveTo(6, -4);
        ctx.lineTo(6, 4);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();
    } else if (type === 2) {
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-6, -5);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-6, 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, -5);
        ctx.lineTo(6, 0);
        ctx.lineTo(1, 5);
        ctx.fill();
    } else if (type === 3) {
        ctx.fillStyle = '#888';
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-3, 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -1, 4, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 4) {
        ctx.fillStyle = '#2e4634';
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f44336';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 5) {
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.strokeStyle = '#f44336';
        ctx.lineWidth = 2;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.moveTo(-8, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}
