/**
 * Полный кадр мира: камера, слои world → tanks → effects → UI.
 */
import { clampCamera } from '../game/collision.js';
import { getShakeOffset } from '../game/cameraShake.js';
import { DETECTION_MEMORY_MS, DETECTION_RADIUS } from '../config/constants.js';
import { shadeColor } from '../game/colorUtils.js';
import { assets } from '../lib/assets.js';
import {
    drawBullets,
    drawDarkSmokeParticles,
    drawExplosions,
    drawMines,
    drawParticlesSmoke,
    drawParticlesSparks,
    drawRockets,
    drawSmokes,
    drawTracks,
} from './effects.js';
import { drawTank, drawTankShadow } from './tank.js';
import { beginNicknameDrawPass, drawAimCrosshair, drawNickname, endNicknameDrawPass } from './uiOverlay.js';
import {
    drawBoostIcon,
    drawBricks,
    drawBrickShadows,
    drawForests,
    drawForestShadows,
    drawMapBackground,
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
        boosts,
        tracks,
        particles,
        mines,
        bullets,
        smokes,
        explosions,
        rockets,
        cachedPatterns,
        onRocketSmoke,
    } = view;

    const dx = (keys['MouseX'] || width / 2) - width / 2;
    const dy = (keys['MouseY'] || height / 2) - height / 2;
    const rawCamX = tank.x + (dx / scaleFactor) * 0.33;
    const rawCamY = tank.y + (dy / scaleFactor) * 0.33;
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

    boosts.forEach((b) => drawBoostIcon(ctx, b.x, b.y, b.type));

    // Круг обзора игрока
    ctx.save();
    ctx.beginPath();
    ctx.arc(tank.x, tank.y, DETECTION_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.26)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    const halfW = width / 2 / scaleFactor;
    const halfH = height / 2 / scaleFactor;
    drawTracks(ctx, tracks, now, { camX, camY, halfW, halfH });

    drawParticlesSparks(ctx, particles);

    drawMines(ctx, mines, session.myTeam);

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
            const baseColor = session.playerData[id]?.color || '#f44336';
            et.color = baseColor;
            if (et._renderShadeSource !== baseColor) {
                et._renderShadeSource = baseColor;
                et.turretColor = shadeColor(baseColor, -20);
                et.trackColor = shadeColor(baseColor, -40);
            }
            et._isAlly = (session.playerData[id]?.team === session.myTeam);
            drawTank(ctx, et);
        }
    }
    if (tank.hp > 0) {
        tank._isAlly = true;
        drawTank(ctx, tank);
    }

    // 3. Тени кирпичей — ложатся на танк
    drawBrickShadows(ctx, bricks, level.mapWidth, level.mapHeight, view.bricksDrawRevision ?? 0);

    // 4. Кирпичи — выше тени кирпичей
    drawBricks(ctx, bricks, level.mapWidth, level.mapHeight, view.bricksDrawRevision ?? 0);

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

    // Тени леса — ниже леса, выше никнеймов
    drawForestShadows(ctx, forests, assets.images.shadowForest);

    // Лес
    drawForests(ctx, forests, assets.images.forest);

    drawSmokes(ctx, smokes);
    drawDarkSmokeParticles(ctx, particles);

    drawExplosions(ctx, explosions);

    drawRockets(ctx, rockets, onRocketSmoke, now);

    if (tank.hp > 0) {
        drawAimCrosshair(ctx, tank);
    }

    ctx.restore();

    return { camX, camY };
}
