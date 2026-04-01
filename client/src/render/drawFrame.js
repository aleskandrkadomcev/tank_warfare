/**
 * Полный кадр мира: камера, слои world → tanks → effects → UI.
 */
import { battle } from '../game/gameState.js';
import { clampCamera } from '../game/collision.js';
import { getShakeOffset } from '../game/cameraShake.js';
import { DETECTION_MEMORY_MS } from '../config/constants.js';
import { shadeColor } from '../game/colorUtils.js';
import { assets } from '../lib/assets.js';
import {
    drawBullets,
    drawDarkSmokeParticles,
    drawExplosions,
    drawExplosionDust,
    drawExplosionDirt,
    drawExplosionSmoke,
    drawExplosionFire,
    drawExplosionSparks,
    drawExplosionFlash,
    drawExplosionGlow,
    drawMines,
    drawExplosionMarks,
    drawMuzzleFlash,
    drawExhaust,
    drawParticlesDirt,
    drawParticlesSmoke,
    drawParticlesSparks,
    drawRockets,
    drawSmokes,
    drawTracks,
    drawCloudShadows,
} from './effects.js';
import { drawDeadHull, drawTank, drawTankFlashLighting, drawTankShadow } from './tank.js';
import { beginNicknameDrawPass, drawAimCrosshair, drawNickname, drawReloadIndicator, endNicknameDrawPass } from './uiOverlay.js';
import {
    drawBoostIcon,
    drawBricks,
    drawBrickShadows,
    drawForests,
    drawForestShadows,
    drawMapBackground,
    drawStoneShadows,
    drawStones,
    drawStoneFlashLighting,
} from './world.js';

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} view
 */
export function drawGameFrame(ctx, view) {
    const {
        width,
        height,
        scaleFactor,
        keys,
        tank,
        enemyTanks,
        session,
        level,
        bricks,
        forests,
        stones,
        boosts,
        tracks,
        particles,
        mines,
        bullets,
        smokes,
        explosions,
        rockets,
        hulls,
        cachedPatterns,
        onRocketSmoke,
    } = view;

    const dx = (keys['MouseX'] || width / 2) - width / 2;
    const dy = (keys['MouseY'] || height / 2) - height / 2;
    const rawCamX = tank.x + (dx / scaleFactor) * 0.5;
    const rawCamY = tank.y + (dy / scaleFactor) * 0.5;
    const c = clampCamera(rawCamX, rawCamY, width, height, scaleFactor, level.mapWidth, level.mapHeight);
    const shake = getShakeOffset(view.dt || 0.016);
    const camX = c.x + shake.x;
    const camY = c.y + shake.y;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-camX, -camY);

    const now = typeof view.frameTimeMs === 'number' ? view.frameTimeMs : performance.now();

    drawMapBackground(ctx, {
        mapWidth: level.mapWidth,
        mapHeight: level.mapHeight,
        biome: level.biome,
        cachedPatterns,
        grassImg: assets.images.grassBase,
        perlinImg: assets.images.perlinMask,
    });

    // Метки взрывов на земле
    if (view.explosionMarks) {
        drawExplosionMarks(ctx, view.explosionMarks);
    }

    boosts.forEach((b) => drawBoostIcon(ctx, b.x, b.y, b.type));

    // Круг обзора игрока
    ctx.save();
    ctx.beginPath();
    ctx.arc(tank.x, tank.y, battle.tankDef.detectionRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.26)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    const halfW = width / 2 / scaleFactor;
    const halfH = height / 2 / scaleFactor;
    drawTracks(ctx, tracks, now, { camX, camY, halfW, halfH }, level.mapWidth, level.mapHeight);
    drawExhaust(ctx, particles);
    drawParticlesDirt(ctx, particles);

    drawMines(ctx, mines, session.myTeam);

    // Остовы мёртвых танков (ниже живых)
    if (hulls) {
        for (const hull of hulls) {
            drawDeadHull(ctx, hull);
        }
    }

    // 1. Тени танков (самый нижний слой)
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if ((et.lastSeenAt ?? now) + DETECTION_MEMORY_MS < now) continue;
        if (et.hp > 0) drawTankShadow(ctx, et);
    }
    if (tank.hp > 0) drawTankShadow(ctx, tank);

    // 2. Танки
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if ((et.lastSeenAt ?? now) + DETECTION_MEMORY_MS < now) continue;
        if (et.hp > 0) {
            const pd = session.playerData[id];
            const baseColor = pd?.color || '#f44336';
            et.color = baseColor;
            et.camo = pd?.camo || 'none';
            if (et._renderShadeSource !== baseColor) {
                et._renderShadeSource = baseColor;
                et.turretColor = shadeColor(baseColor, -20);
                et.trackColor = shadeColor(baseColor, -40);
            }
            et._isAlly = (pd?.team === session.myTeam);
            drawTank(ctx, et);
        }
    }
    if (tank.hp > 0) {
        tank._isAlly = true;
        drawTank(ctx, tank);
    }

    // 2.5 Подсветка вспышкой (normal map point light)
    drawTankFlashLighting(ctx, particles, tank, enemyTanks);

    // 3. Тени кирпичей — ложатся на танк
    drawBrickShadows(ctx, bricks, level.mapWidth, level.mapHeight, view.bricksDrawRevision ?? 0);

    // 3.5 Тени камней
    drawStoneShadows(ctx, stones, level.mapWidth, level.mapHeight);

    // 4. Кирпичи — выше тени кирпичей
    drawBricks(ctx, bricks, level.mapWidth, level.mapHeight, view.bricksDrawRevision ?? 0);

    // 5. Камни
    drawStones(ctx, stones, level.mapWidth, level.mapHeight);

    // 5.5 Подсветка камней вспышками (normal map point light)
    drawStoneFlashLighting(ctx, particles, stones);

    drawBullets(ctx, bullets);

    drawParticlesSmoke(ctx, particles);
    ctx.globalAlpha = 1;

    beginNicknameDrawPass(ctx);
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if ((et.lastSeenAt ?? now) + DETECTION_MEMORY_MS < now) continue;
        if (et.hp > 0) drawNickname(ctx, et, false, session);
    }
    if (tank.hp > 0) {
        drawNickname(ctx, tank, true, session);
    }
    endNicknameDrawPass(ctx);

    drawMuzzleFlash(ctx, particles);
    drawSmokes(ctx, smokes);
    drawDarkSmokeParticles(ctx, particles);

    drawParticlesSparks(ctx, particles);

    // Взрыв — слои снизу вверх:
    drawExplosions(ctx, explosions);        // взрывная волна (кольцо)
    drawExplosionDust(ctx, particles);      // пыль
    drawExplosionDirt(ctx, particles);      // куски земли
    drawExplosionSmoke(ctx, particles);     // дым
    drawExplosionFire(ctx, particles);      // фаерболы
    drawExplosionSparks(ctx, particles);    // искры
    drawExplosionFlash(ctx, particles);     // белая вспышка
    drawExplosionGlow(ctx, particles);      // псевдо-освещение

    drawRockets(ctx, rockets, onRocketSmoke, now);

    // Тени кустов — выше эффектов
    drawForestShadows(ctx, forests);

    // Кусты
    drawForests(ctx, forests);

    // Тень от облаков — поверх всего
    drawCloudShadows(ctx, now, { camX, camY, halfW, halfH });

    if (tank.hp > 0) {
        drawAimCrosshair(ctx, tank);
    }

    ctx.restore();

    // Виньетка поверх всей сцены
    if (assets.images.vignette.complete && assets.images.vignette.naturalWidth) {
        ctx.drawImage(assets.images.vignette, 0, 0, width, height);
    }

    // Индикатор перезарядки вокруг курсора (экранные координаты)
    if (tank.hp > 0) {
        const mx = keys['MouseX'] || width / 2;
        const my = keys['MouseY'] || height / 2;
        drawReloadIndicator(ctx, tank, mx, my);
    }

    return { camX, camY };
}
