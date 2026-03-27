/**
 * Запекание скинов танков: белый спрайт → multiply цветом → overlay камуфляж.
 * Создаёт offscreen-канвасы для корпуса и башни — по одному на комбинацию (color + camo).
 */
import { assets } from '../lib/assets.js';

/** Кэш запечённых скинов: ключ "color|camo" → { base: HTMLCanvasElement, turret: HTMLCanvasElement } */
const skinCache = new Map();

/**
 * Запекает один спрайт: tint цветом через multiply + камуфляж через overlay.
 * Белый спрайт × multiply(цвет) = нужный цвет. Чёрные части остаются чёрными.
 */
function bakeSprite(spriteImg, color, camoImg) {
    const w = spriteImg.naturalWidth;
    const h = spriteImg.naturalHeight;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // 1. Рисуем белый спрайт
    ctx.drawImage(spriteImg, 0, 0);

    // 2. Multiply с выбранным цветом — белый → цвет, чёрный → чёрный
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);

    // 3. Восстанавливаем альфа-канал из оригинала (multiply затрагивает альфу)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(spriteImg, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // 4. Камуфляж: overlay поверх, обрезанный по форме спрайта
    if (camoImg?.complete && camoImg.naturalWidth > 0) {
        const camoCanvas = document.createElement('canvas');
        camoCanvas.width = w;
        camoCanvas.height = h;
        const camoCtx = camoCanvas.getContext('2d');

        // Маска из формы спрайта
        camoCtx.drawImage(spriteImg, 0, 0);
        camoCtx.globalCompositeOperation = 'source-in';
        // Центрируем камуфляж (может быть больше спрайта)
        const cx = w / 2 - camoImg.naturalWidth / 2;
        const cy = h / 2 - camoImg.naturalHeight / 2;
        camoCtx.drawImage(camoImg, cx, cy);
        camoCtx.globalCompositeOperation = 'source-over';

        // Overlay поверх окрашенного танка
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(camoCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';

        // Восстанавливаем альфу снова
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(spriteImg, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
    }

    return canvas;
}

/**
 * Получает (или создаёт) запечённый скин для танка.
 * @param {string} color — hex-цвет (#4CAF50)
 * @param {string} camoId — id камуфляжа ('none' | 'camouflage1' | ...)
 * @returns {{ base: HTMLCanvasElement, turret: HTMLCanvasElement } | null}
 */
export function getTankSkin(color, camoId, tankType) {
    const baseImg = tankType === 'heavy' ? assets.images.tankHeavyBase
        : tankType === 'light' ? assets.images.tankLightBase
        : assets.images.tankBase;
    const turImg = tankType === 'heavy' ? assets.images.tankHeavyTurret
        : tankType === 'light' ? assets.images.tankLightTurret
        : assets.images.tankTurret;
    if (!baseImg?.complete || !baseImg.naturalWidth || !turImg?.complete || !turImg.naturalWidth) {
        return null;
    }

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

/** Очищает кэш скинов (при смене ассетов и т.п.). */
export function clearSkinCache() {
    skinCache.clear();
}
