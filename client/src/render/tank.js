/**
 * Отрисовка танка (запечённый скин или fallback-геометрия) + полоска HP.
 */
import { assets } from '../lib/assets.js';
import { getTankSkin } from './tankSkin.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} t — танк с x,y,angle,turretAngle,w,h,color,...
 */
export function drawTankShadow(ctx, t) {
    ctx.save();
    ctx.translate(t.x + 5, t.y + 5);
    ctx.rotate(t.angle);
    ctx.globalAlpha = 0.35;
    ctx.filter = 'blur(3px)';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    const hw = (t.w || 75) / 2;
    const hh = (t.h || 45) / 2;
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
    const skin = getTankSkin(t.color, t.camo || 'none', t.tankType || 'medium');

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    if (t.spawnImmunityTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    if (skin) {
        ctx.drawImage(skin.base, -skin.base.width / 2, -skin.base.height / 2);
    } else {
        const baseImg = assets.images.tankBase;
        if (assets.loaded && baseImg.complete && baseImg.naturalWidth > 0) {
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

    const ttype = t.tankType || 'medium';
    const turretOff = ttype === 'light' ? -2 : ttype === 'heavy' ? -4 : 4;
    ctx.save();
    ctx.translate(t.x + Math.cos(t.angle) * turretOff, t.y + Math.sin(t.angle) * turretOff);
    ctx.rotate(t.turretAngle);

    if (skin) {
        ctx.drawImage(skin.turret, -skin.turret.width / 2, -skin.turret.height / 2);
    } else {
        const turImg = assets.images.tankTurret;
        if (assets.loaded && turImg.complete && turImg.naturalWidth > 0) {
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
