/**
 * Следы, частицы, мины, снаряды, дым, взрывы, ракеты (фаза 3.3).
 */
import { BULLET_DAMAGE_BASE, TRACK_LIFETIME } from '../config/constants.js';
import { assets } from '../lib/assets.js';

/** Не рисуем частицы/дым с пренебрежимой непрозрачностью — экономия beginPath/arc/fill. */
const PARTICLE_VIS_EPS = 0.002;

/**
 * @param {{ camX: number, camY: number, halfW: number, halfH: number }} [viewWorld] — центр камеры и полуразмеры видимой области в мировых координатах; без аргумента рисуем все следы.
 */
export function drawTracks(ctx, tracks, now, viewWorld) {
    if (tracks.length === 0) return;
    const baseTransform = ctx.getTransform();
    let minX;
    let maxX;
    let minY;
    let maxY;
    if (viewWorld) {
        const m = 32;
        minX = viewWorld.camX - viewWorld.halfW - m;
        maxX = viewWorld.camX + viewWorld.halfW + m;
        minY = viewWorld.camY - viewWorld.halfH - m;
        maxY = viewWorld.camY + viewWorld.halfH + m;
    }
    for (const t of tracks) {
        const age = now - t.time;
        const alpha = Math.max(0, 1 - age / TRACK_LIFETIME);
        if (alpha < PARTICLE_VIS_EPS) continue;
        if (viewWorld && (t.x < minX || t.x > maxX || t.y < minY || t.y > maxY)) continue;
        ctx.setTransform(baseTransform);
        ctx.translate(t.x, t.y);
        ctx.rotate(t.angle);
        ctx.fillStyle = `rgba(30,25,20,${alpha * 0.3})`;
        ctx.fillRect(-8, -3, 16, 6);
    }
    ctx.setTransform(baseTransform);
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
    mines.forEach((m) => {
        if (m.ownerTeam === myTeam || m.triggered) {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f44336';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 5, 0, Math.PI * 2);
            ctx.fill();
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
