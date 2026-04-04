/**
 * Следы, частицы, мины, снаряды, дым, взрывы, ракеты (фаза 3.3).
 */
import { BULLET_DAMAGE_BASE } from '../config/constants.js';
import { level } from '../game/gameState.js';
import { assets } from '../lib/assets.js';
import { bakeLitSprite } from './lightingRenderer.js';

/** Не рисуем частицы/дым с пренебрежимой непрозрачностью — экономия beginPath/arc/fill. */
const PARTICLE_VIS_EPS = 0.002;

/** Безопасный createRadialGradient — пропускает NaN/Infinity. */
function safeRadialGradient(ctx, x, y, r0, r1) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(r1) || r1 <= 0) return null;
    return ctx.createRadialGradient(x, y, r0, x, y, r1);
}

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
        if (t.tankType === 'heavy') {
            tc.fillRect(-8, -3.75, 16, 7.5);
        } else if (t.tankType === 'light') {
            tc.fillRect(-7, -2.5, 14, 5);
        } else {
            tc.fillRect(-8, -3, 16, 6);
        }
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
    // 1. Пороховой дым (muzzle_smoke) — НИЖНИЙ слой, 50% начальная прозрачность
    const greyImg = assets.images.smokeGrey;
    const useGrey = greyImg?.complete && greyImg.naturalWidth > 0;
    for (const p of particles) {
        if (p.type !== 'muzzle_smoke') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const maxLife = 1.2; // макс лайфтайм дыма
        const lifeRatio = life / maxLife;
        ctx.globalAlpha = Math.min(lifeRatio * 2, 0.5); // макс 50%
        if (useGrey) {
            const scale = (p.spriteScale || 1) * (1 + (1 - lifeRatio) * 0.5);
            const w = greyImg.naturalWidth * scale;
            const h = greyImg.naturalHeight * scale;
            ctx.drawImage(greyImg, p.x - w / 2, p.y - h / 2, w, h);
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 2. Фаербол (muzzle) — размытые круги с белым центром → оранж краями, скейл 1.3-2×
    for (const p of particles) {
        if (p.type !== 'muzzle') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const maxLife = 0.25;
        const lifeRatio = Math.min(life / maxLife, 1);
        // Скейл: от 1.3 (начало) до 2.0 (конец жизни)
        const scaleFactor = 1.3 + (1 - lifeRatio) * 0.7;
        const radius = p.size * scaleFactor;
        ctx.globalAlpha = Math.min(lifeRatio * 4, 0.5); // макс 50%
        // Радиальный градиент: широкий белый центр → тонкий оранж край
        const grad = safeRadialGradient(ctx, p.x, p.y, 0, radius);
        if (!grad) continue;
        grad.addColorStop(0, `rgba(255,255,250,${(0.5 * 0.95).toFixed(2)})`);
        grad.addColorStop(0.55, `rgba(255,240,200,${(0.5 * 0.7).toFixed(2)})`);
        grad.addColorStop(0.8, `rgba(255,180,60,${(0.5 * 0.3).toFixed(2)})`);
        grad.addColorStop(1, `rgba(255,140,0,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }

    // 3. Яркая вспышка-spotlight (muzzle_flash) — движется, дольше, радиус ×1.5, additive
    const prevComposite = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        if (p.type !== 'muzzle_flash') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const maxLife = p.maxLife || 0.14;
        const t = Math.max(0, 1 - (life / maxLife));
        const radius = Math.max(1, p.size + t * 105);
        const alpha = Math.min(life / maxLife, 1);  // 1→0
        const grad = safeRadialGradient(ctx, p.x, p.y, 0, radius);
        if (!grad) continue;
        grad.addColorStop(0, `rgba(255,240,120,${(alpha * 0.95).toFixed(2)})`);
        grad.addColorStop(0.25, `rgba(255,210,60,${(alpha * 0.5).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,180,30,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = prevComposite;

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
        if (p.type !== 'smoke' && p.type !== 'fire_smoke' && p.type !== 'dark_smoke' && p.type !== 'dirt' && p.type !== 'muzzle' && p.type !== 'muzzle_flash' && p.type !== 'muzzle_smoke' && p.type !== 'spark_hit' && p.type !== 'exhaust' && !p.type.startsWith('expl_')) {
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

/** Выхлопные газы — размытые серые круги */
export function drawExhaust(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'exhaust') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const r = p.size;
        const grad = safeRadialGradient(ctx, p.x, p.y, 0, r);
        if (!grad) continue;
        grad.addColorStop(0, `rgba(80,80,80,${(life * 0.6).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(80,80,80,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
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
    ctx.fillStyle = '#000';
    bullets.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
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
            ctx.globalAlpha = Math.min(1, life / 4) * 0.7;
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

/** Взрывная волна: расширяющееся белое кольцо (прозрачный центр → белые края), additive */
export function drawExplosions(ctx, explosions) {
    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    explosions.forEach((e) => {
        const pr = e.time / e.maxTime; // 0→1
        const alpha = (1 - pr) * 0.5;  // 50%→0%
        if (alpha < 0.01) return;
        const radius = Math.max(1, e.radius * pr);
        const grad = safeRadialGradient(ctx, e.x, e.y, 0, radius);
        if (!grad) return;
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.6, 'rgba(255,255,255,0)');
        grad.addColorStop(0.85, `rgba(255,255,255,${(alpha * 0.5).toFixed(2)})`);
        grad.addColorStop(1, `rgba(255,255,255,${alpha.toFixed(2)})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalCompositeOperation = prevComp;
}

/** Пыль взрыва — размытые светло-коричневые круги, статичные */
export function drawExplosionDust(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'expl_dust') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const lifeRatio = life / 4; // maxLife=4
        ctx.globalAlpha = Math.min(lifeRatio * 2, 0.75); // 75%→0
        const grad = safeRadialGradient(ctx, p.x, p.y, 0, p.size / 2);
        if (!grad) continue;
        grad.addColorStop(0, 'rgba(121,102,71,0.75)');
        grad.addColorStop(1, 'rgba(121,102,71,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

/** Куски земли — тёмные точки с fade-out */
export function drawExplosionDirt(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'expl_dirt') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        ctx.globalAlpha = Math.min(life / 2, 1); // 2с→0
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/** Дым взрыва — чёрные спрайты дыма */
export function drawExplosionSmoke(ctx, particles) {
    const smokeBlackImg = assets.images.smokeBlack;
    const useSprite = smokeBlackImg?.complete && smokeBlackImg.naturalWidth > 0;
    for (const p of particles) {
        if (p.type !== 'expl_smoke') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        ctx.globalAlpha = Math.min(1, life / 4) * 0.7;
        if (useSprite) {
            const scale = (p.spriteScale || 1) * (1 + (1 - life / 4) * 0.5);
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
    ctx.globalAlpha = 1;
}

/** Огненные фаерболы взрыва — белый центр→оранж край, растут */
export function drawExplosionFire(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'expl_fire') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const maxLife = 0.7;
        const lifeRatio = Math.min(life / maxLife, 1);
        const radius = p.size;
        ctx.globalAlpha = Math.min(lifeRatio * 3, 0.5);
        const grad = safeRadialGradient(ctx, p.x, p.y, 0, radius);
        if (!grad) continue;
        grad.addColorStop(0, `rgba(255,255,250,${(0.5 * 0.95).toFixed(2)})`);
        grad.addColorStop(0.55, `rgba(255,240,200,${(0.5 * 0.7).toFixed(2)})`);
        grad.addColorStop(0.8, `rgba(255,180,60,${(0.5 * 0.3).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,140,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ctx.globalAlpha = 1;
}

/** Искры взрыва — белое ядро + жёлтый glow */
export function drawExplosionSparks(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'expl_spark' && p.type !== 'spark_hit') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const maxLife = 1.2;
        const alpha = Math.min(life / maxLife * 2, 1);

        // Жёлтый glow (размытый, больше ядра)
        const glowR = p.size * 3;
        const glowGrad = safeRadialGradient(ctx, p.x, p.y, 0, glowR);
        if (!glowGrad) continue;
        glowGrad.addColorStop(0, `rgba(255,220,60,${(alpha * 0.4).toFixed(2)})`);
        glowGrad.addColorStop(1, 'rgba(255,220,60,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Ядро
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color || '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

/** Белая вспышка взрыва — 1 большой размытый круг, additive */
export function drawExplosionFlash(ctx, particles) {
    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        if (p.type !== 'expl_flash') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const alpha = life / 0.2; // 1→0
        const radius = p.size;
        const grad = safeRadialGradient(ctx, p.x, p.y, 0, radius);
        if (!grad) continue;
        grad.addColorStop(0, `rgba(255,255,255,${(alpha * 1.0).toFixed(2)})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${(alpha * 0.5).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ctx.globalCompositeOperation = prevComp;
    ctx.globalAlpha = 1;
}

/** Псевдо-освещение взрыва — большой размытый светло-жёлтый круг, additive */
export function drawExplosionGlow(ctx, particles) {
    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
        if (p.type !== 'expl_glow') continue;
        const life = Math.max(0, p.life);
        if (life < PARTICLE_VIS_EPS) continue;
        const alpha = Math.min(life / 0.3, 1) * 0.4; // макс 40%, затухает
        const radius = p.size;
        const grad = safeRadialGradient(ctx, p.x, p.y, 0, radius);
        if (!grad) continue;
        grad.addColorStop(0, `rgba(255,250,220,${alpha.toFixed(2)})`);
        grad.addColorStop(0.5, `rgba(255,240,180,${(alpha * 0.5).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(255,230,150,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = prevComp;
    ctx.globalAlpha = 1;
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
    _cloudOffsetX += Math.cos(level.windAngle) * CLOUD_SPEED * elapsed;
    _cloudOffsetY += Math.sin(level.windAngle) * CLOUD_SPEED * elapsed;

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
    if (!assets.loaded || !img?.complete || !img.naturalWidth) return;
    for (const m of marks) {
        const w = img.naturalWidth * m.scale;
        const h = img.naturalHeight * m.scale;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.angle);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
}
