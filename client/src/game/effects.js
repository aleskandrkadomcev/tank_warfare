/**
 * Локальные эффекты (частицы, следы, дым, взрывы) — мутация world, без сети.
 */
import { MAX_TRACKS_IN_WORLD } from '../config/constants.js';
import { playSound_Explosion } from '../lib/audio.js';
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
            p.size = Math.random() * 15 + 10;
            p.color = `rgba(30,30,30,0.7)`;
            p.spriteScale = 1 + Math.random() * 0.5;
        }
        if (type === 'fire_smoke') {
            p.vx = (Math.random() - 0.5) * 50;
            p.vy = (Math.random() - 0.5) * 50;
            p.life = 1.5;
            p.size = Math.random() * 8 + 8;
            p.color = `rgba(50,50,50,0.6)`;
            p.spriteScale = 1 + Math.random() * 0.5;
        }
        if (type === 'spark_fire') {
            p.vx = (Math.random() - 0.5) * 200;
            p.vy = (Math.random() - 0.5) * 200;
            p.life = 0.6;
            p.size = Math.random() * 3 + 1.5;
            p.color = `rgba(255,220,0,0.95)`;
        }
        if (type === 'dirt') {
            p.life = 0.7;
            p.size = Math.random() * 2.5 + 2;
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

export function addTrack(x, y, angle) {
    tracks.push({ x, y, angle, time: performance.now() });
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
    explosions.push({ x, y, radius, time: 0, maxTime: 0.4 });
    // Метка взрыва на земле (чёрное пятно)
    world.explosionMarks.push({ x, y, angle: Math.random() * Math.PI * 2, scale: 0.8 + Math.random() * 0.5 });
    // тёмный дым — облако
    spawnParticles(x, y, '#333', 18, 'dark_smoke');
    // огненные искры разлетаются во все стороны
    spawnParticles(x, y, '#ffdd00', 16, 'spark_fire');
    // куски земли/обломки
    spawnParticles(x, y, '#8B4513', 12, 'dirt');
    // яркое пламя — два кольца (центр + периферия)
    for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 120;
        particles.push({
            x, y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life: 0.25 + Math.random() * 0.35,
            color: `rgba(255,${80 + Math.floor(Math.random() * 120)},0,0.9)`,
            size: Math.random() * 6 + 3,
            type: 'spark',
        });
    }
    // белая вспышка в центре
    for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        particles.push({
            x, y,
            vx: Math.cos(a) * (10 + Math.random() * 20),
            vy: Math.sin(a) * (10 + Math.random() * 20),
            life: 0.1 + Math.random() * 0.1,
            color: `rgba(255,255,200,0.95)`,
            size: Math.random() * 8 + 5,
            type: 'spark',
        });
    }
    const dist = Math.hypot(battle.tank.x - x, battle.tank.y - y);
    const vol = Math.max(0, 1 - dist / 1920);
    playSound_Explosion(vol);
}
