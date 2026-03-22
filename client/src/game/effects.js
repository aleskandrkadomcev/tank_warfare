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
            p.vx = (Math.random() - 0.5) * 20;
            p.vy = -Math.random() * 20 - 10;
            p.life = 1;
            p.size = Math.random() * 5 + 5;
            p.color = `rgba(150,150,150,0.5)`;
        }
        if (type === 'dark_smoke') {
            p.vx = (Math.random() - 0.5) * 50;
            p.vy = -Math.random() * 30 - 20;
            p.life = 2;
            p.size = Math.random() * 15 + 10;
            p.color = `rgba(30,30,30,0.7)`;
        }
        if (type === 'fire_smoke') {
            p.vx = (Math.random() - 0.5) * 40;
            p.vy = -Math.random() * 40 - 20;
            p.life = 1.5;
            p.size = Math.random() * 8 + 8;
            p.color = `rgba(50,50,50,0.6)`;
        }
        if (type === 'spark_fire') {
            p.vx = (Math.random() - 0.5) * 300;
            p.vy = -Math.random() * 300 - 100;
            p.life = 0.4;
            p.size = Math.random() * 2 + 1;
            p.color = `rgba(255,100,0,0.9)`;
        }
        if (type === 'dirt') {
            p.life = 0.3;
            p.size = Math.random() * 2 + 1;
        }
        if (type === 'muzzle') {
            p.life = 0.1;
            p.size = Math.random() * 4 + 2;
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
        });
    }
    smokes.push(cloud);
}

export function createExplosion(x, y, radius) {
    explosions.push({ x, y, radius, time: 0, maxTime: 0.3 });
    spawnParticles(x, y, '#333', 30, 'dark_smoke');
    const dist = Math.hypot(battle.tank.x - x, battle.tank.y - y);
    const vol = Math.max(0, 1 - dist / 1200);
    playSound_Explosion(vol);
}
