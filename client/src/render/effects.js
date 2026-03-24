/**
 * Следы, частицы, мины, снаряды, дым, взрывы, ракеты (фаза 3.3).
 */
import { BULLET_DAMAGE_BASE } from '../config/constants.js';
import { assets } from '../lib/assets.js';

/** Не рисуем частицы/дым с пренебрежимой непрозрачностью — экономия beginPath/arc/fill. */
const PARTICLE_VIS_EPS = 0.002;

/* ── Offscreen-canvas для следов гусениц ── */
let _trackCanvas = null;
let _trackCtx = null;
let _lastFadeTime = 0;
/** Интервал fade-прохода (мс). */
const FADE_INTERVAL = 250;
/**
 * Alpha для destination-out за один шаг.
 * (1 - 0.056)^80 ≈ 0.01 → след исчезает за ~20 сек (80 шагов × 250 мс).
 */
const FADE_ALPHA = 0.056;
/** Непрозрачность штампа нового следа. */
const STAMP_ALPHA = 0.25;
const STAMP_COLOR = 'rgb(30,25,20)';

/** Сбросить offscreen-холст (при смене карты / новом раунде). */
export function resetTrackCanvas() {
    _trackCanvas = null;
    _trackCtx = null;
}

/**
 * Штампует новые следы на offscreen-canvas, периодически затухает,
 * и блитит видимую область на основной ctx.
 * Вместо сотен fillRect/кадр — один drawImage.
 */
export function drawTracks(ctx, tracks, now, viewWorld, mapWidth, mapHeight) {
    // Ленивая инициализация / пересоздание при смене размера карты
    if (!_trackCanvas || _trackCanvas.width !== mapWidth || _trackCanvas.height !== mapHeight) {
        _trackCanvas = document.createElement('canvas');
        _trackCanvas.width = mapWidth;
        _trackCanvas.height = mapHeight;
        _trackCtx = _trackCanvas.getContext('2d');
        _lastFadeTime = now;
    }

    const tc = _trackCtx;

    // Штампуем только новые (ещё не отрисованные) следы
    let hasNew = false;
    for (let i = 0, len = tracks.length; i < len; i++) {
        const t = tracks[i];
        if (t.stamped) continue;
        t.stamped = true;
        if (!hasNew) {
            tc.fillStyle = STAMP_COLOR;
            tc.globalAlpha = STAMP_ALPHA;
            hasNew = true;
        }
        tc.save();
        tc.translate(t.x, t.y);
        tc.rotate(t.angle);
        tc.fillRect(-8, -3, 16, 6);
        tc.restore();
    }
    if (hasNew) tc.globalAlpha = 1;

    // Периодическое затухание — destination-out убирает альфу у всего холста
    if (now - _lastFadeTime >= FADE_INTERVAL) {
        const steps = Math.floor((now - _lastFadeTime) / FADE_INTERVAL);
        const totalAlpha = 1 - Math.pow(1 - FADE_ALPHA, steps);
        tc.globalCompositeOperation = 'destination-out';
        tc.fillStyle = `rgba(0,0,0,${totalAlpha.toFixed(4)})`;
        tc.fillRect(0, 0, mapWidth, mapHeight);
        tc.globalCompositeOperation = 'source-over';
        _lastFadeTime += steps * FADE_INTERVAL;
    }

    // Блит видимой области на основной canvas
    if (viewWorld) {
        const m = 32;
        const sx = Math.max(0, Math.floor(viewWorld.camX - viewWorld.halfW - m));
        const sy = Math.max(0, Math.floor(viewWorld.camY - viewWorld.halfH - m));
        const ex = Math.min(mapWidth, Math.ceil(viewWorld.camX + viewWorld.halfW + m));
        const ey = Math.min(mapHeight, Math.ceil(viewWorld.camY + viewWorld.halfH + m));
        const sw = ex - sx;
        const sh = ey - sy;
        if (sw > 0 && sh > 0) {
            ctx.drawImage(_trackCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
        }
    } else {
        ctx.drawImage(_trackCanvas, 0, 0);
    }
}

export function drawMuzzleFlash(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'muzzle') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

export function drawParticlesDirt(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'dirt') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        ctx.fillStyle = p.color;
        // 70% жизни — полностью непрозрачный, потом затухает
        const fadeStart = 0.3;
        ctx.globalAlpha = life > fadeStart ? 0.75 : (life / fadeStart) * 0.75;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

export function drawParticlesSparks(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'smoke' && p.type !== 'fire_smoke' && p.type !== 'dark_smoke' && p.type !== 'dirt' && p.type !== 'muzzle') {
            const life = Math.max(0, p.life);
            if (life < PARTICLE_VIS_EPS) continue;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

export function drawMines(ctx, mines, myTeam) {
    const img = assets.images.mine;
    const useSprite = img && img.complete && img.naturalWidth > 0;
    mines.forEach((m) => {
        if (m.ownerTeam === myTeam || m.triggered) {
            if (useSprite) {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                ctx.drawImage(img, m.x - w / 2, m.y - h / 2, w, h);
            } else {
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(m.x, m.y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#f44336';
                ctx.beginPath();
                ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });
}

export function drawBullets(ctx, bullets) {
    bullets.forEach((b) => {
        if (b.damage > BULLET_DAMAGE_BASE) {
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

export function drawParticlesSmoke(ctx, particles) {
    const greyImg = assets.images.smokeGrey;
    const blackImg = assets.images.smokeBlack;
    const useGrey = greyImg && greyImg.complete && greyImg.naturalWidth > 0;
    const useBlack = blackImg && blackImg.complete && blackImg.naturalWidth > 0;
    for (const p of particles) {
        if (p.type === 'smoke' || p.type === 'fire_smoke') {
            const life = Math.max(0, p.life);
            if (life < PARTICLE_VIS_EPS) continue;
            ctx.globalAlpha = life;
            const img = p.type === 'fire_smoke' ? (useBlack ? blackImg : null) : (useGrey ? greyImg : null);
            if (img) {
                const scale = p.spriteScale || 1;
                const w = img.naturalWidth * scale;
                const h = img.naturalHeight * scale;
                ctx.drawImage(img, p.x - w / 2, p.y - h / 2, w, h);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

export function drawSmokes(ctx, smokes) {
    const smokeImg = assets.images.smoke;
    const useSprite = smokeImg && smokeImg.complete && smokeImg.naturalWidth > 0;
    for (const s of smokes) {
        s.particles.forEach((p) => {
            const a = p.alpha;
            if (a < PARTICLE_VIS_EPS) return;
            ctx.globalAlpha = a;
            if (useSprite) {
                const scale = p.spriteScale || 1;
                const w = smokeImg.naturalWidth * scale;
                const h = smokeImg.naturalHeight * scale;
                const px = s.x + p.ox;
                const py = s.y + p.oy;
                ctx.drawImage(smokeImg, px - w / 2, py - h / 2, w, h);
            } else {
                ctx.fillStyle = `rgba(200,200,200,${a})`;
                ctx.beginPath();
                ctx.arc(s.x + p.ox, s.y + p.oy, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    ctx.globalAlpha = 1;
}

export function drawDarkSmokeParticles(ctx, particles) {
    const smokeBlackImg = assets.images.smokeBlack;
    const useSprite = smokeBlackImg && smokeBlackImg.complete && smokeBlackImg.naturalWidth > 0;
    for (const p of particles) {
        if (p.type === 'dark_smoke') {
            const life = Math.max(0, p.life);
            if (life < PARTICLE_VIS_EPS) continue;
            ctx.globalAlpha = life;
            if (useSprite) {
                const scale = p.spriteScale || 1;
                const w = smokeBlackImg.naturalWidth * scale;
                const h = smokeBlackImg.naturalHeight * scale;
                ctx.drawImage(smokeBlackImg, p.x - w / 2, p.y - h / 2, w, h);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    ctx.globalAlpha = 1;
}

export function drawExplosions(ctx, explosions) {
    explosions.forEach((e) => {
        const pr = e.time / e.maxTime;
        if (pr < 0.33) {
            ctx.fillStyle = `rgba(255,255,0,${1 - pr / 0.33})`;
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.radius * (pr / 0.33), 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

/**
 * @param {function} onRocketSmoke — (x,y) => spawnParticles(...) для редкого дыма у ракеты
 * @param {number} now — время кадра (performance.now или rAF timestamp), один раз на кадр
 */
export function drawRockets(ctx, rockets, onRocketSmoke, now) {
    const rocketImg = assets.images.rocket;
    const useSprite = rocketImg && rocketImg.complete && rocketImg.naturalWidth > 0;
    for (let i = 0; i < rockets.length; i++) {
        const r = rockets[i];
        const el = now - r.startTime;
        const pr = Math.min(1, el / r.duration);
        const rx = r.sx + (r.tx - r.sx) * pr;
        const ry = r.sy + (r.ty - r.sy) * pr;
        const a = Math.atan2(r.ty - r.sy, r.tx - r.sx);
        ctx.save();
        ctx.translate(rx, ry);
        // спрайт смотрит вверх — поворачиваем на -90° чтобы совпало с atan2 (вправо = 0)
        ctx.rotate(a - Math.PI / 2);
        if (useSprite) {
            const w = rocketImg.naturalWidth;
            const h = rocketImg.naturalHeight;
            ctx.drawImage(rocketImg, -w / 2, -h / 2, w, h);
        } else {
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#000';
            ctx.fillRect(-12, -4, 24, 8);
            ctx.fillStyle = '#f44336';
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(4, -6);
            ctx.lineTo(4, 6);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        if (Math.random() > 0.5) onRocketSmoke(rx, ry);
    }
}

/* ── Тень от облаков ── */
/** Рандомное направление движения (выбирается один раз). */
let _cloudAngle = Math.random() * Math.PI * 2;
const CLOUD_SPEED = 60; // px/сек
const CLOUD_SCALE = 5;  // растянуть текстуру в 5 раз
let _cloudOffsetX = 0;
let _cloudOffsetY = 0;
let _cloudLastTime = 0;

export function drawCloudShadows(ctx, now, viewWorld) {
    const img = assets.images.cloudShadow;
    if (!img || !img.complete || !img.naturalWidth) return;

    // Обновляем смещение по времени
    if (_cloudLastTime === 0) _cloudLastTime = now;
    const elapsed = (now - _cloudLastTime) / 1000;
    _cloudLastTime = now;
    _cloudOffsetX += Math.cos(_cloudAngle) * CLOUD_SPEED * elapsed;
    _cloudOffsetY += Math.sin(_cloudAngle) * CLOUD_SPEED * elapsed;

    const tw = img.naturalWidth * CLOUD_SCALE;
    const th = img.naturalHeight * CLOUD_SCALE;

    // Оборачиваем смещение, чтобы не уплыть в бесконечность
    _cloudOffsetX = ((_cloudOffsetX % tw) + tw) % tw;
    _cloudOffsetY = ((_cloudOffsetY % th) + th) % th;

    // Рисуем только тайлы, попадающие в viewport
    if (!viewWorld) return;
    const minX = viewWorld.camX - viewWorld.halfW - tw;
    const maxX = viewWorld.camX + viewWorld.halfW + tw;
    const minY = viewWorld.camY - viewWorld.halfH - th;
    const maxY = viewWorld.camY + viewWorld.halfH + th;

    const startTileX = Math.floor((minX - _cloudOffsetX) / tw);
    const endTileX = Math.ceil((maxX - _cloudOffsetX) / tw);
    const startTileY = Math.floor((minY - _cloudOffsetY) / th);
    const endTileY = Math.ceil((maxY - _cloudOffsetY) / th);

    for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
            ctx.drawImage(img, _cloudOffsetX + tx * tw, _cloudOffsetY + ty * th, tw, th);
        }
    }
}

export function drawExplosionMarks(ctx, marks) {
    const img = assets.images.explosionMark;
    if (!assets.loaded || !img.complete || !img.naturalWidth) return;
    for (const m of marks) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);
        const w = img.naturalWidth * m.scale;
        const h = img.naturalHeight * m.scale;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
}
