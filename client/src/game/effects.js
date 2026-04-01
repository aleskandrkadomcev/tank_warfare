/**
 * Локальные эффекты (частицы, следы, дым, взрывы) — мутация world, без сети.
 */
import { MAX_TRACKS_IN_WORLD } from '../config/constants.js';
import { calcPan, playSound_Explosion } from '../lib/audio.js';
import { battle, world } from './gameState.js';

const { particles, tracks, smokes, explosions } = world;

export function spawnParticles(x, y, color, count, type = 'spark') {
    for (let i = 0; i < count; i++) {
        const p = {
            x,
            y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 0.5,
            color,
            size: Math.random() * 3 + 2,
            type,
        };
        if (type === 'smoke') {
            p.vx = (Math.random() - 0.5) * 30;
            p.vy = (Math.random() - 0.5) * 30;
            p.life = 1;
            p.size = Math.random() * 5 + 5;
            p.color = `rgba(150,150,150,0.5)`;
            p.spriteScale = 1 + Math.random() * 0.5;
        }
        if (type === 'dark_smoke') {
            p.vx = (Math.random() - 0.5) * 40;
            p.vy = (Math.random() - 0.5) * 40;
            p.life = 4;
            p.size = (Math.random() * 15 + 10) * 0.8;
            p.color = `rgba(30,30,30,0.7)`;
            p.spriteScale = (1 + Math.random() * 0.5) * 0.8;
        }
        if (type === 'fire_smoke') {
            p.vx = (Math.random() - 0.5) * 50;
            p.vy = (Math.random() - 0.5) * 50;
            p.life = 1.0;
            p.size = (Math.random() * 8 + 8) * 0.5;
            p.color = `rgba(50,50,50,0.5)`;
            p.spriteScale = (1 + Math.random() * 0.5) * 0.5;
        }
        if (type === 'burn_spark') {
            p.vx = (Math.random() - 0.5) * 200;
            p.vy = (Math.random() - 0.5) * 200;
            p.life = 0.4;
            p.size = Math.random() * 1 + 1;
            p.color = '#ffdd00';
            p.type = 'expl_spark';
            p.prevX = x;
            p.prevY = y;
        }
        if (type === 'dirt') {
            p.life = 0.49;
            p.size = Math.random() * 2 + 1;
            p.vx = (Math.random() - 0.5) * 80;
            p.vy = (Math.random() - 0.5) * 80;
        }
        if (type === 'muzzle') {
            p.life = 0.13;
            p.size = Math.random() * 6 + 4;
        }
        particles.push(p);
    }
}

/**
 * Полный мазл-флеш: вспышка + фаербол + пороховой дым.
 * Вызывается и для своих выстрелов и для чужих.
 */
/** Эффект попадания снаряда в танк — вспышка + искры */
export function createBulletHitEffect(x, y) {
    // Белая вспышка (additive)
    particles.push({
        x, y, vx: 0, vy: 0,
        life: 0.15, size: 40,
        color: '#fff',
        type: 'expl_flash',
    });

    // Искры — 10шт, светло-жёлтые
    for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = Math.random() * 200;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.3 + Math.random() * 0.1,
            color: '#fff8b0', size: Math.random() * 1 + 1,
            type: 'spark_hit',
            prevX: x, prevY: y,
        });
    }
}

export function spawnMuzzleFlash(x, y, angle) {
    // Яркая вспышка (spotlight) — движется вперёд, дольше живёт, радиус ×1.5
    const flashSpd = 80;
    particles.push({
        x, y,
        vx: Math.cos(angle) * flashSpd,
        vy: Math.sin(angle) * flashSpd,
        life: 0.14, color: 'rgba(255,230,100,1)', size: 27,
        type: 'muzzle_flash',
    });

    // Фаербол — размытые круги, белый центр → оранж края, 50% прозрачность
    for (let i = 0; i < 7; i++) {
        const spread = (Math.random() - 0.5) * 0.4;
        const a = angle + spread;
        const spd = 150 + Math.random() * 250;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.15 + Math.random() * 0.10,
            color: `rgba(255,${100 + Math.floor(Math.random() * 100)},0,0.9)`,
            size: Math.random() * 8 + 5,
            type: 'muzzle',
        });
    }
    // Искры — 6-10 штук, 1-2px, 0.15-0.3с, разброс ×3
    const sparkCount = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < sparkCount; i++) {
        const a = angle + (Math.random() - 0.5) * 2.4;
        const spd = 200 + Math.random() * 200;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.15 + Math.random() * 0.15,
            color: 'rgba(255,255,200,0.95)', size: 1 + Math.random(),
            type: 'muzzle',
        });
    }

    // Пороховой дым — 10 штук, 50% прозрачность, 0.6-1.2с, scale 0.6-1.5
    for (let i = 0; i < 10; i++) {
        const a = angle + (Math.random() - 0.5) * 0.6;
        const spd = 160 + Math.random() * 280;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.6 + Math.random() * 0.6,
            color: 'rgba(180,180,180,0.5)',
            size: Math.random() * 8 + 6,
            type: 'muzzle_smoke',
            spriteScale: 0.6 + Math.random() * 0.9,
        });
    }
}

export function addTrack(x, y, angle, tankType = 'medium') {
    tracks.push({ x, y, angle, time: performance.now(), tankType });
    /** Следы с сети приходят вне `runSimulation` — иначе массив раздувается выше лимита до следующего кадра. */
    while (tracks.length > MAX_TRACKS_IN_WORLD) tracks.shift();
}

export function createSmokeCloud(x, y) {
    const cloud = { x, y, time: 0, particles: [] };
    for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 150;
        cloud.particles.push({
            ox: Math.cos(a) * d,
            oy: Math.sin(a) * d,
            size: 30 + Math.random() * 40,
            alpha: 0,
            spriteScale: 1 + Math.random() * 0.5,
        });
    }
    smokes.push(cloud);
}

export function createExplosion(x, y, radius) {
    // Взрывная волна (белое кольцо, прозрачный центр)
    explosions.push({ x, y, radius: radius * 1.5, time: 0, maxTime: 0.4 });

    // Метка взрыва на земле
    world.explosionMarks.push({ x, y, angle: Math.random() * Math.PI * 2, scale: 0.52 + Math.random() * 0.07 });

    // Псевдо-освещение — большой размытый круг, additive
    particles.push({
        x, y, vx: 0, vy: 0,
        life: 0.3, size: 120,
        color: '#fff',
        type: 'expl_glow',
    });

    // Белая вспышка — 1шт, 90px, 0.2с, additive
    particles.push({
        x, y, vx: 0, vy: 0,
        life: 0.2, size: 90,
        color: '#fff',
        type: 'expl_flash',
    });

    // Искры — 20шт, белое ядро + жёлтый glow, шлейф
    for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 100 + Math.random() * 100;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.6 + Math.random() * 0.6,
            color: '#ffdd00', size: Math.random() * 1 + 1,
            type: 'expl_spark',
            prevX: x, prevY: y,
        });
    }

    // Огненные фаерболы — 10шт, белый центр→оранж край
    for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 50 + Math.random() * 100;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.4 + Math.random() * 0.3,
            color: `rgba(255,${100 + Math.floor(Math.random() * 100)},0,0.9)`,
            size: 5 + Math.random() * 5,
            type: 'expl_fire',
        });
    }

    // Тёмный дым — 18шт, разлетается с замедлением
    for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 30 + Math.random() * 120;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 4,
            color: `rgba(30,30,30,0.7)`,
            size: (Math.random() * 15 + 10) * 0.8,
            type: 'expl_smoke',
            spriteScale: (1 + Math.random() * 0.5) * 0.8,
        });
    }

    // Куски земли — 12шт, гравитация тянет вниз
    for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 140;
        // Цвет от чёрного до коричневого
        const brown = Math.floor(Math.random() * 100);
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 2,
            color: `rgb(${30 + brown},${20 + Math.floor(brown * 0.5)},${10 + Math.floor(brown * 0.2)})`,
            size: 1 + Math.random() * 3,
            type: 'expl_dirt',
        });
    }

    // Пыль с земли — 40шт, равномерно по площади взрыва (90px)
    for (let i = 0; i < 40; i++) {
        const d = Math.sqrt(Math.random()) * 90;
        const a = Math.random() * Math.PI * 2;
        particles.push({
            x: x + Math.cos(a) * d,
            y: y + Math.sin(a) * d,
            vx: 0, vy: 0,
            life: 4,
            color: '#796647',
            size: 20 + Math.random() * 20,
            type: 'expl_dust',
        });
    }

    const dist = Math.hypot(battle.tank.x - x, battle.tank.y - y);
    const vol = Math.max(0, 1 - dist / 1920);
    playSound_Explosion(vol, calcPan(x, y));
}

/**
 * Взрыв танка — как createExplosion, но без земли, пыли, волны и воронки.
 */
export function createTankExplosion(x, y) {
    // Псевдо-освещение
    particles.push({
        x, y, vx: 0, vy: 0,
        life: 0.3, size: 120,
        color: '#fff',
        type: 'expl_glow',
    });

    // Белая вспышка
    particles.push({
        x, y, vx: 0, vy: 0,
        life: 0.2, size: 90,
        color: '#fff',
        type: 'expl_flash',
    });

    // Искры — 20шт
    for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 100 + Math.random() * 100;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.6 + Math.random() * 0.6,
            color: '#ffdd00', size: Math.random() * 1 + 1,
            type: 'expl_spark',
            prevX: x, prevY: y,
        });
    }

    // Огненные фаерболы — 10шт
    for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 50 + Math.random() * 100;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 0.4 + Math.random() * 0.3,
            color: `rgba(255,${100 + Math.floor(Math.random() * 100)},0,0.9)`,
            size: 5 + Math.random() * 5,
            type: 'expl_fire',
        });
    }

    // Тёмный дым — 18шт
    for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 30 + Math.random() * 120;
        particles.push({
            x, y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            life: 4,
            color: `rgba(30,30,30,0.7)`,
            size: (Math.random() * 15 + 10) * 0.8,
            type: 'expl_smoke',
            spriteScale: (1 + Math.random() * 0.5) * 0.8,
        });
    }

    const dist = Math.hypot(battle.tank.x - x, battle.tank.y - y);
    const vol = Math.max(0, 1 - dist / 1920);
    playSound_Explosion(vol, calcPan(x, y));
}
