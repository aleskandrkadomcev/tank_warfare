/**
 * Отрисовка танка (запечённый скин или fallback-геометрия) + полоска HP.
 */
import { assets } from '../lib/assets.js';
import { getTankSkin } from './tankSkin.js';
import { renderFlashOverlay } from './lightingRenderer.js';

const FLASH_RADIUS = 250;          // макс дистанция вспышки
const REALISTIC_SCALE = 1 / 2.5;
const REALISTIC_TYPES = new Set(['medium', 'heavy', 'light']);

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} t — танк с x,y,angle,turretAngle,w,h,color,...
 */
export function drawTankShadow(ctx, t) {
    const isHeavy = (t.tankType || 'medium') === 'heavy';
    const shadowOff = isHeavy ? 8 : 5;
    ctx.save();
    ctx.translate(t.x + shadowOff, t.y + shadowOff);
    ctx.rotate(t.angle);
    // Тяж: сдвиг центра тени на 20px вперёд + длина +10px
    const isMedium = (t.tankType || 'medium') === 'medium';
    if (isHeavy) ctx.translate(7, 0);
    if (isMedium) ctx.translate(-4, 0);
    ctx.globalAlpha = isHeavy ? 0.55 : 0.50;
    ctx.filter = 'blur(3px)';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    const hw = ((t.w || 75) + (isHeavy ? 5 : isMedium ? 8 : 0)) / 2;
    const hh = ((t.h || 45) + (isMedium ? 4 : 0)) / 2;
    const r = 4;
    ctx.moveTo(-hw + r, -hh);
    ctx.lineTo(hw - r, -hh);
    ctx.quadraticCurveTo(hw, -hh, hw, -hh + r);
    ctx.lineTo(hw, hh - r);
    ctx.quadraticCurveTo(hw, hh, hw - r, hh);
    ctx.lineTo(-hw + r, hh);
    ctx.quadraticCurveTo(-hw, hh, -hw, hh - r);
    ctx.lineTo(-hw, -hh + r);
    ctx.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
}

export function drawTank(ctx, t) {
    const skin = getTankSkin(t.color, t.camo || 'none', t.tankType || 'medium', t.angle, t.turretAngle);

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    if (t.spawnImmunityTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    if (skin) {
        ctx.drawImage(skin.base, -skin.base.width / 2, -skin.base.height / 2);
    } else {
        const fbSkin = assets.tankSkins[(t.tankType || 'medium')]?.['1'];
        const baseImg = fbSkin?.base;
        if (baseImg?.complete && baseImg.naturalWidth > 0) {
            ctx.drawImage(baseImg, -baseImg.naturalWidth / 2, -baseImg.naturalHeight / 2);
        } else {
            ctx.fillStyle = t.color;
            ctx.fillRect(-t.w / 2, -t.h / 2, t.w, t.h);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.moveTo(t.w / 2, -t.h / 2);
            ctx.lineTo(t.w / 2 + 5, 0);
            ctx.lineTo(t.w / 2, t.h / 2);
            ctx.fill();
            ctx.fillStyle = t.trackColor;
            ctx.fillRect(-t.w / 2, -t.h / 2, t.w, 5);
            ctx.fillRect(-t.w / 2, t.h / 2 - 5, t.w, 5);
        }
    }
    ctx.restore();

    // ── Тень башни (между корпусом и башней) ──
    const ttype = t.tankType || 'medium';
    const turretOff = ttype === 'light' ? 1 : ttype === 'heavy' ? 17 : 4;
    const turX = t.x + Math.cos(t.angle) * turretOff;
    const turY = t.y + Math.sin(t.angle) * turretOff;

    if (ttype === 'medium' || ttype === 'heavy' || ttype === 'light') {
        const shadowImg = ttype === 'heavy' ? assets.images.tankHeavyTurretShadow
            : ttype === 'light' ? assets.images.tankLightTurretShadow
            : assets.images.tankTurretShadow;
        if (shadowImg?.complete && shadowImg.naturalWidth) {
            const shOff = ttype === 'heavy' ? 8 : ttype === 'light' ? 4 : 6;
            ctx.save();
            ctx.translate(turX + shOff, turY + shOff);
            ctx.rotate(t.turretAngle);
            if (ttype === 'medium') {
                ctx.drawImage(shadowImg, -shadowImg.naturalWidth / 2, -shadowImg.naturalHeight / 2);
            } else {
                const sc = REALISTIC_SCALE;
                ctx.drawImage(shadowImg, -shadowImg.naturalWidth * sc / 2, -shadowImg.naturalHeight * sc / 2, shadowImg.naturalWidth * sc, shadowImg.naturalHeight * sc);
            }
            ctx.restore();
        }
    }

    // ── Башня ──
    ctx.save();
    ctx.translate(turX, turY);
    ctx.rotate(t.turretAngle);

    if (skin) {
        ctx.drawImage(skin.turret, -skin.turret.width / 2, -skin.turret.height / 2);
    } else {
        const fbTurSkin = assets.tankSkins[(t.tankType || 'medium')]?.['1'];
        const turImg = fbTurSkin?.turret;
        if (turImg?.complete && turImg.naturalWidth > 0) {
            ctx.drawImage(turImg, -turImg.naturalWidth / 2, -turImg.naturalHeight / 2);
        } else {
            ctx.fillStyle = t.turretColor;
            ctx.fillRect(10, -3, 22, 6);
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    const maxHp = t.maxHp || 100;
    if (t.hp < maxHp && t.hp > 0 && !t._isHull) {
        ctx.fillStyle = '#333';
        ctx.fillRect(t.x - 20, t.y - 30, 40, 5);
        const isAlly = t._isAlly !== undefined ? t._isAlly : true;
        ctx.fillStyle = isAlly ? '#4CAF50' : '#f44336';
        ctx.fillRect(t.x - 20, t.y - 30, (t.hp / maxHp) * 40, 5);
    }
}

/**
 * Рисует подсветку вспышки на танках через normal map.
 * Вызывать ПОСЛЕ отрисовки всех танков.
 */
export function drawTankFlashLighting(ctx, particles, tank, enemyTanks) {
    // Собираем активные вспышки
    const flashes = [];
    for (const p of particles) {
        if (p.type === 'muzzle_flash' && p.life > 0.01) {
            flashes.push(p);
        }
    }
    if (flashes.length === 0) return;

    const allTanks = [tank];
    for (const id in enemyTanks) {
        if (enemyTanks[id].hp > 0) allTanks.push(enemyTanks[id]);
    }

    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    for (const flash of flashes) {
        const intensity = Math.min(flash.life / (flash.maxLife || 0.14), 1) * 2.0; // яркость затухает (макс 2.0)

        for (const t of allTanks) {
            if (t.hp <= 0) continue;
            if (!REALISTIC_TYPES.has(t.tankType || 'medium')) continue;

            const tt = t.tankType || 'medium';
            const skinId = t.camo || '1';
            const baseNM = tt === 'heavy' ? assets.images.tankHeavyBaseNM
                : tt === 'light' ? assets.images.tankLightBaseNM : assets.images.tankBaseNM;
            const turNM = tt === 'heavy' ? assets.images.tankHeavyTurretNM
                : tt === 'light' ? assets.images.tankLightTurretNM : assets.images.tankTurretNM;
            const skinEntry = assets.tankSkins[tt]?.[skinId] || assets.tankSkins[tt]?.['1'];
            const baseImg = skinEntry?.base;
            const turImg = skinEntry?.turret;
            if (!baseNM?.complete || !turNM?.complete) continue;

            // ── Корпус ──
            const dx = flash.x - t.x;
            const dy = flash.y - t.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < FLASH_RADIUS) {
                const cosA = Math.cos(-t.angle);
                const sinA = Math.sin(-t.angle);
                const localX = (cosA * dx - sinA * dy) * REALISTIC_SCALE;
                const localY = (sinA * dx + cosA * dy) * REALISTIC_SCALE;

                const overlay = renderFlashOverlay(baseImg, baseNM, REALISTIC_SCALE, localX, localY, intensity);
                if (overlay) {
                    ctx.save();
                    ctx.translate(t.x, t.y);
                    ctx.rotate(t.angle);
                    ctx.drawImage(overlay, -overlay.width / 2, -overlay.height / 2);
                    ctx.restore();
                }
            }

            // ── Башня ──
            const ttype = t.tankType || 'medium';
            const turretOff = ttype === 'light' ? 1 : ttype === 'heavy' ? 17 : 4;
            const turCX = t.x + Math.cos(t.angle) * turretOff;
            const turCY = t.y + Math.sin(t.angle) * turretOff;
            const tdx = flash.x - turCX;
            const tdy = flash.y - turCY;
            const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (tdist < FLASH_RADIUS) {
                const cosT = Math.cos(-t.turretAngle);
                const sinT = Math.sin(-t.turretAngle);
                const tlocalX = (cosT * tdx - sinT * tdy) * REALISTIC_SCALE;
                const tlocalY = (sinT * tdx + cosT * tdy) * REALISTIC_SCALE;

                const tOverlay = renderFlashOverlay(turImg, turNM, REALISTIC_SCALE, tlocalX, tlocalY, intensity);
                if (tOverlay) {
                    ctx.save();
                    ctx.translate(turCX, turCY);
                    ctx.rotate(t.turretAngle);
                    ctx.drawImage(tOverlay, -tOverlay.width / 2, -tOverlay.height / 2);
                    ctx.restore();
                }
            }
        }
    }

    ctx.globalCompositeOperation = prevComp;
}

export function drawDeadHull(ctx, hull) {
    const deadImg = assets.images.tankDead;
    ctx.save();
    ctx.translate(hull.x, hull.y);
    ctx.rotate(hull.angle);
    if (assets.loaded && deadImg.complete && deadImg.naturalWidth > 0) {
        ctx.drawImage(deadImg, -deadImg.naturalWidth / 2, -deadImg.naturalHeight / 2);
    } else {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#222';
        ctx.fillRect(-hull.w / 2, -hull.h / 2, hull.w, hull.h);
    }
    ctx.restore();
}
