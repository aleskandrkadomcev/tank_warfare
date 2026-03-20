/**
 * Следы, частицы, мины, снаряды, дым, взрывы, ракеты (фаза 3.3).
 */
import { BULLET_DAMAGE_BASE, TRACK_LIFETIME } from '../config/constants.js';

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
        ctx.fillRect(-4, -1.5, 8, 3);
    }
    ctx.setTransform(baseTransform);
}

export function drawParticlesSparks(ctx, particles) {
    for (const p of particles) {
        if (p.type !== 'smoke' && p.type !== 'fire_smoke' && p.type !== 'dark_smoke') {
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
    for (const p of particles) {
        if (p.type === 'smoke' || p.type === 'fire_smoke') {
            const life = Math.max(0, p.life);
            if (life < PARTICLE_VIS_EPS) continue;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = life;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

export function drawSmokes(ctx, smokes) {
    for (const s of smokes) {
        s.particles.forEach((p) => {
            const a = p.alpha;
            if (a < PARTICLE_VIS_EPS) return;
            ctx.fillStyle = `rgba(200,200,200,${a})`;
            ctx.beginPath();
            ctx.arc(s.x + p.ox, s.y + p.oy, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

export function drawDarkSmokeParticles(ctx, particles) {
    for (const p of particles) {
        if (p.type === 'dark_smoke') {
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
    for (let i = 0; i < rockets.length; i++) {
        const r = rockets[i];
        const el = now - r.startTime;
        const pr = Math.min(1, el / r.duration);
        const rx = r.sx + (r.tx - r.sx) * pr;
        const ry = r.sy + (r.ty - r.sy) * pr;
        const a = Math.atan2(r.ty - r.sy, r.tx - r.sx);
        ctx.save();
        ctx.translate(rx, ry);
        ctx.rotate(a);
        ctx.fillStyle = '#000';
        ctx.fillRect(-12, -4, 24, 8);
        ctx.fillStyle = '#f44336';
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(4, -6);
        ctx.lineTo(4, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(-18, -8);
        ctx.lineTo(-18, 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        if (Math.random() > 0.5) onRocketSmoke(rx, ry);
    }
}
