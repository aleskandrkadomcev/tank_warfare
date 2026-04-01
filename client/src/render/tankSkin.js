/**
 * Запекание скинов танков.
 * Старые танки: белый спрайт → multiply цветом → overlay камуфляж.
 * Реалистичные танки: WebGL normal map, свет повёрнут в локальное пространство.
 * Все спрайты рисуются обычным ctx.rotate() — без preRotated.
 */
import { assets } from '../lib/assets.js';
import { bakeLitSprite } from './lightingRenderer.js';

/** Кэш скинов для старых танков: "type|color|camo" → { base, turret } */
const skinCache = new Map();

/** Кэш освещённых спрайтов: "part|angleDeg" → HTMLCanvasElement */
const litCache = new Map();

/** Шаг квантования угла (градусы) */
const ANGLE_STEP_DEG = 10;

/**
 * Запекает один спрайт: tint цветом через multiply + камуфляж через overlay.
 */
function bakeSprite(spriteImg, color, camoImg) {
    const w = spriteImg.naturalWidth;
    const h = spriteImg.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(spriteImg, 0, 0);

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(spriteImg, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    if (camoImg?.complete && camoImg.naturalWidth > 0) {
        const camoCanvas = document.createElement('canvas');
        camoCanvas.width = w;
        camoCanvas.height = h;
        const camoCtx = camoCanvas.getContext('2d');

        camoCtx.drawImage(spriteImg, 0, 0);
        camoCtx.globalCompositeOperation = 'source-in';
        const cx = w / 2 - camoImg.naturalWidth / 2;
        const cy = h / 2 - camoImg.naturalHeight / 2;
        camoCtx.drawImage(camoImg, cx, cy);
        camoCtx.globalCompositeOperation = 'source-over';

        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(camoCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';

        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(spriteImg, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
    }

    return canvas;
}

/** Масштабирует спрайт (fallback без normal map) */
function scaleSprite(spriteImg, scale, rotate180 = false) {
    const w = Math.round(spriteImg.naturalWidth * scale);
    const h = Math.round(spriteImg.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (rotate180) {
        ctx.translate(w / 2, h / 2);
        ctx.rotate(Math.PI);
        ctx.drawImage(spriteImg, -w / 2, -h / 2, w, h);
    } else {
        ctx.drawImage(spriteImg, 0, 0, w, h);
    }
    return canvas;
}

/** Типы танков с реалистичными спрайтами */
const REALISTIC_TYPES = new Set(['medium']);

/** Масштаб реалистичных спрайтов */
const REALISTIC_SCALE = 1 / 2.5;

/** Квантует угол (рад → градусы, шаг ANGLE_STEP_DEG) */
function quantizeAngle(rad) {
    let deg = ((rad * 180 / Math.PI) % 360 + 360) % 360;
    return Math.round(deg / ANGLE_STEP_DEG) * ANGLE_STEP_DEG;
}

/**
 * Получает освещённый спрайт для конкретного мирового угла.
 * Спрайт в локальной ориентации, свет повёрнут на -angle.
 */
function getLitPart(partKey, colorImg, normalImg, angleDeg) {
    const cacheKey = `${partKey}|${angleDeg}`;
    if (litCache.has(cacheKey)) return litCache.get(cacheKey);

    const worldAngle = angleDeg * Math.PI / 180;
    const canvas = bakeLitSprite(colorImg, normalImg, REALISTIC_SCALE, worldAngle);
    if (!canvas) return null;

    litCache.set(cacheKey, canvas);
    return canvas;
}

/**
 * Получает скин танка.
 * Для реалистичных — динамический свет через normal map, кеш по углу.
 * Для старых — статичный multiply + камуфляж.
 * Все спрайты рисуются обычным ctx.rotate().
 */
export function getTankSkin(color, camoId, tankType, bodyAngle, turretAngle) {
    const baseImg = tankType === 'heavy' ? assets.images.tankHeavyBase
        : tankType === 'light' ? assets.images.tankLightBase
        : assets.images.tankBase;
    const turImg = tankType === 'heavy' ? assets.images.tankHeavyTurret
        : tankType === 'light' ? assets.images.tankLightTurret
        : assets.images.tankTurret;
    if (!baseImg?.complete || !baseImg.naturalWidth || !turImg?.complete || !turImg.naturalWidth) {
        return null;
    }

    if (REALISTIC_TYPES.has(tankType || 'medium')) {
        const baseNM = assets.images.tankBaseNM;
        const turNM = assets.images.tankTurretNM;
        const hasNM = baseNM?.complete && baseNM.naturalWidth && turNM?.complete && turNM.naturalWidth;

        if (hasNM) {
            const bodyDeg = quantizeAngle(bodyAngle || 0);
            const turDeg = quantizeAngle(turretAngle || 0);

            const litBase = getLitPart('base', baseImg, baseNM, bodyDeg);
            const litTurret = getLitPart('turret', turImg, turNM, turDeg);

            return {
                base: litBase || scaleSprite(baseImg, REALISTIC_SCALE),
                turret: litTurret || scaleSprite(turImg, REALISTIC_SCALE),
            };
        }
        // Fallback без normal map
        const fallbackKey = `${tankType}|fallback`;
        if (!skinCache.has(fallbackKey)) {
            skinCache.set(fallbackKey, {
                base: scaleSprite(baseImg, REALISTIC_SCALE),
                turret: scaleSprite(turImg, REALISTIC_SCALE),
            });
        }
        return skinCache.get(fallbackKey);
    }

    // Старые танки
    const key = `${tankType || 'medium'}|${color}|${camoId || 'none'}`;
    if (skinCache.has(key)) return skinCache.get(key);

    const camoImg = (camoId && camoId !== 'none') ? assets.images[camoId] : null;
    const skin = {
        base: bakeSprite(baseImg, color, camoImg),
        turret: bakeSprite(turImg, color, camoImg),
    };
    skinCache.set(key, skin);
    return skin;
}

/** Очищает все кэши скинов. */
export function clearSkinCache() {
    skinCache.clear();
    litCache.clear();
}
