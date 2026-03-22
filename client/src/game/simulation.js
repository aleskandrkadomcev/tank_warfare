/**
 * Игровой шаг симуляции: движение, столкновения, снаряды, таймеры.
 * Сеть — только через переданный send(); DOM — через updateInventoryUI.
 */
import { ClientMsg } from '../../../shared/dist/protocol.js';
import {
    ACCEL_FORWARD,
    ACCEL_REVERSE,
    BASE_RELOAD_TIME,
    BOOST_DURATION,
    BOOST_PICKUP_RADIUS,
    BOOST_RELOAD_TIME,
    BOOST_SPEED_DURATION,
    BRAKE_POWER,
    BULLET_DAMAGE_BASE,
    BULLET_DAMAGE_BOOST,
    COLLISION_DAMAGE,
    GRIP,
    MAX_SPEED_FORWARD,
    MAX_SPEED_REVERSE,
    MAX_TRACKS_IN_WORLD,
    NATURAL_DRAG,
    TANK_MAX_HP,
    TRACK_LIFETIME,
    TURN_SPEED,
    TURRET_ROTATION_SPEED,
} from '../config/constants.js';
import {
    playAlert,
    playRocketFlyBy,
    playSound_BrickHit,
    playSound_Damage,
    playSound_Heal,
    playSound_Hit,
    playSound_Shot,
    playSound_Smoke,
    playSound_Speed,
} from '../lib/audio.js';
import { triggerShake } from './cameraShake.js';
import {
    checkBulletBrickCollision,
    clampTankCenterToMap,
    getTankHullHalfExtents,
    separateTankFromBricks,
    tankBrickCollisionIndex,
} from './collision.js';
import { addTrack, createSmokeCloud, spawnParticles } from './effects.js';
import { battle, bumpBricksDrawRevision, level, session, world } from './gameState.js';

const {
    bricks,
    bullets,
    particles,
    tracks,
    boosts,
    smokes,
    rockets,
    explosions,
} = world;
const { tank, enemyTanks } = battle;

/**
 * @param {number} dt
 * @param {{
 *   send: (msg: Record<string, unknown>) => void;
 *   keys: Record<string, boolean>;
 *   width: number;
 *   height: number;
 *   scaleFactor: number;
 *   camX: number;
 *   camY: number;
 *   updateInventoryUI: () => void;
 * }} ctx
 */
export function runSimulation(dt, ctx) {
    const { send, keys, width, height, scaleFactor, camX, camY, updateInventoryUI } = ctx;
    const mapW = level.mapWidth;
    const mapH = level.mapHeight;

    if (!session.gameStarted) return;
    if (session.gameStarted && tank.hp > 0) updateInventoryUI();
    if (keys['KeyR'] && session.isHost) {
        send({ type: ClientMsg.RESTART_MATCH });
        keys['KeyR'] = false;
    }
    if (tank.hp <= 0 || tank.isDead) {
        if (session.myEngine) session.myEngine.update(dt, 0, 0);
        if (session.enemyEngine) session.enemyEngine.update(dt, 0, 0);
        return;
    }
    if (tank.spawnImmunityTimer > 0) tank.spawnImmunityTimer -= dt;
    if (tank.damageBoostTimer > 0) tank.damageBoostTimer -= dt;
    if (tank.speedBoostTimer > 0) tank.speedBoostTimer -= dt;
    if (tank.collisionTimer > 0) tank.collisionTimer -= dt;

    if (keys['KeyQ'] && tank.smokeCount > 0) {
        tank.smokeCount--;
        createSmokeCloud(tank.x, tank.y);
        send({ type: ClientMsg.DEPLOY_SMOKE, x: tank.x, y: tank.y });
        playSound_Smoke();
        keys['KeyQ'] = false;
        updateInventoryUI();
    }
    if (keys['KeyE'] && tank.mineCount > 0) {
        tank.mineCount--;
        send({ type: ClientMsg.DEPLOY_MINE, x: tank.x, y: tank.y });
        playSound_Smoke();
        keys['KeyE'] = false;
        updateInventoryUI();
    }
    if (keys['Space'] && tank.rocketCount > 0) {
        tank.rocketCount--;
        const mx = keys['MouseX'] || width / 2;
        const my = keys['MouseY'] || height / 2;
        const wx = camX + (mx - width / 2) / scaleFactor;
        const wy = camY + (my - height / 2) / scaleFactor;
        send({ type: ClientMsg.LAUNCH_ROCKET, tx: wx, ty: wy });
        playAlert();
        playRocketFlyBy();
        keys['Space'] = false;
        updateInventoryUI();
    }

    if (keys['KeyA']) tank.angle -= TURN_SPEED * dt;
    if (keys['KeyD']) tank.angle += TURN_SPEED * dt;
    clampTankCenterToMap(tank, mapW, mapH);

    const cosA = Math.cos(tank.angle);
    const sinA = Math.sin(tank.angle);
    let forwardSpeed = tank.vx * cosA + tank.vy * sinA;
    let rightSpeed = -tank.vx * sinA + tank.vy * cosA;
    let input = 0;
    if (keys['KeyW']) input = 1;
    if (keys['KeyS']) input = -1;

    let currentMaxSpeed = MAX_SPEED_FORWARD;
    if (tank.speedBoostTimer > 0) currentMaxSpeed *= 1.4;

    let targetSpeed;
    let accelRate;
    if (input === 1) {
        targetSpeed = currentMaxSpeed;
        accelRate = forwardSpeed < 0 ? BRAKE_POWER : ACCEL_FORWARD;
    } else if (input === -1) {
        targetSpeed = -MAX_SPEED_REVERSE;
        accelRate = forwardSpeed > 0 ? BRAKE_POWER : ACCEL_REVERSE;
    } else {
        targetSpeed = 0;
        accelRate = NATURAL_DRAG;
    }

    if (input === -1 && forwardSpeed > 0) {
        forwardSpeed -= accelRate * dt;
        if (forwardSpeed < 0) forwardSpeed = 0;
    } else if (input === 1 && forwardSpeed < 0) {
        forwardSpeed += accelRate * dt;
        if (forwardSpeed > 0) forwardSpeed = 0;
    } else if (forwardSpeed < targetSpeed) {
        forwardSpeed += accelRate * dt;
        if (forwardSpeed > targetSpeed) forwardSpeed = targetSpeed;
    } else {
        forwardSpeed -= accelRate * dt;
        if (forwardSpeed < targetSpeed) forwardSpeed = targetSpeed;
    }

    rightSpeed *= GRIP;
    tank.vx = forwardSpeed * cosA - rightSpeed * sinA;
    tank.vy = forwardSpeed * sinA + rightSpeed * cosA;

    const { hw, hh } = getTankHullHalfExtents(tank);
    const nx = tank.x + tank.vx * dt;
    const ny = tank.y + tank.vy * dt;
    const colX = tankBrickCollisionIndex(nx, tank.y, tank.angle, hw, hh, bricks, mapW, mapH);
    if (colX === -1) tank.x = nx;
    else tank.vx = 0;
    const colY = tankBrickCollisionIndex(tank.x, ny, tank.angle, hw, hh, bricks, mapW, mapH);
    if (colY === -1) tank.y = ny;
    else tank.vy = 0;
    separateTankFromBricks(tank, bricks, mapW, mapH);

    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if (et.hp > 0) {
            const d = Math.hypot(tank.x - et.x, tank.y - et.y);
            if (d < 30 && d > 0) {
                const a = Math.atan2(tank.y - et.y, tank.x - et.x);
                tank.x += Math.cos(a) * 150 * dt;
                tank.y += Math.sin(a) * 150 * dt;
                const rvx = tank.vx - et.vx;
                const rvy = tank.vy - et.vy;
                const rs = Math.hypot(rvx, rvy);
                if (rs > MAX_SPEED_FORWARD * 0.5 && tank.collisionTimer <= 0) {
                    if (tank.spawnImmunityTimer <= 0) {
                        tank.hp -= COLLISION_DAMAGE;
                    }
                    spawnParticles(tank.x, tank.y, '#fff', 10);
                    playSound_Hit();
                    send({ type: ClientMsg.COLLISION_DAMAGE, otherId: id });
                    tank.collisionTimer = 1;
                    if (tank.hp <= 0 && !tank.isDead) {
                        send({ type: ClientMsg.DEATH });
                        tank.isDead = true;
                    }
                }
            }
        }
    }
    separateTankFromBricks(tank, bricks, mapW, mapH);
    clampTankCenterToMap(tank, mapW, mapH);

    const mySpeedNorm = Math.abs(forwardSpeed) / currentMaxSpeed;
    let enemySpeed = 0;
    let distToEnemy = 1200;
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if (et.hp > 0) {
            const d = Math.hypot(tank.x - et.x, tank.y - et.y);
            if (d < distToEnemy) {
                distToEnemy = d;
                enemySpeed = Math.hypot(et.vx, et.vy);
            }
        }
    }
    const distFactor = Math.max(0, 1 - distToEnemy / 1200);
    if (session.myEngine) session.myEngine.update(dt, mySpeedNorm, 1);
    if (session.enemyEngine) session.enemyEngine.update(dt, enemySpeed / MAX_SPEED_FORWARD, distFactor);

    if (tank.hp > 0) {
        if (tank.hp <= 33) {
            if (Math.random() > 0.7) spawnParticles(tank.x, tank.y, '#555', 1, 'fire_smoke');
            if (Math.random() > 0.8) spawnParticles(tank.x, tank.y, '#ffaa00', 1, 'spark_fire');
        } else if (tank.hp <= 66 && Math.random() > 0.85) spawnParticles(tank.x, tank.y, '#888', 1, 'smoke');
    }
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if (et.hp > 0) {
            if (et.hp <= 33) {
                if (Math.random() > 0.7) spawnParticles(et.x, et.y, '#555', 1, 'fire_smoke');
                if (Math.random() > 0.8) spawnParticles(et.x, et.y, '#ffaa00', 1, 'spark_fire');
            } else if (et.hp <= 66 && Math.random() > 0.85) spawnParticles(et.x, et.y, '#888', 1, 'smoke');
        }
    }

    const speedAbs = Math.abs(forwardSpeed);
    level.trackSpawnDist += speedAbs * dt;
    if (level.trackSpawnDist > 8) {
        const off = 18;
        addTrack(
            tank.x - Math.cos(tank.angle + Math.PI / 2) * off,
            tank.y - Math.sin(tank.angle + Math.PI / 2) * off,
            tank.angle,
        );
        addTrack(
            tank.x - Math.cos(tank.angle - Math.PI / 2) * off,
            tank.y - Math.sin(tank.angle - Math.PI / 2) * off,
            tank.angle,
        );
        level.trackSpawnDist = 0;
        if (Math.random() > 0.5) {
            spawnParticles(tank.x - Math.cos(tank.angle) * 18, tank.y - Math.sin(tank.angle) * 18, '#4a3c2b', 1, 'dirt');
        }
    }

    const mx = keys['MouseX'] || width / 2;
    const my = keys['MouseY'] || height / 2;
    const wx = camX + (mx - width / 2) / scaleFactor;
    const wy = camY + (my - height / 2) / scaleFactor;
    let targetAngle = Math.atan2(wy - tank.y, wx - tank.x);
    let diff = targetAngle - tank.turretAngle;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;

    let finalSpeed = TURRET_ROTATION_SPEED;
    let hullTurnDir = 0;
    if (keys['KeyA']) hullTurnDir = -1;
    if (keys['KeyD']) hullTurnDir = 1;
    if ((diff < 0 && hullTurnDir < 0) || (diff > 0 && hullTurnDir > 0)) finalSpeed += TURN_SPEED;
    else if (hullTurnDir !== 0) finalSpeed = Math.max(0.1, finalSpeed - TURN_SPEED * 0.5);
    if (Math.abs(diff) < finalSpeed * dt) tank.turretAngle = targetAngle;
    else tank.turretAngle += diff > 0 ? finalSpeed * dt : -finalSpeed * dt;

    if (tank.reload > 0) tank.reload -= dt;
    let reloadTime = BASE_RELOAD_TIME;
    let dmg = BULLET_DAMAGE_BASE;
    if (tank.damageBoostTimer > 0) {
        dmg = BULLET_DAMAGE_BOOST;
        reloadTime = BOOST_RELOAD_TIME;
    }

    if (keys['MouseLeft'] && tank.reload <= 0) {
        const sr = speedAbs / currentMaxSpeed;
        const sp = (Math.random() - 0.5) * sr * 5 * (Math.PI / 180) * 2;
        const a = tank.turretAngle + sp;
        const b = {
            x: tank.x + Math.cos(a) * 30,
            y: tank.y + Math.sin(a) * 30,
            vx: Math.cos(a) * 1200,
            vy: Math.sin(a) * 1200,
            ownerId: session.myId,
            ownerTeam: session.myTeam,
            damage: dmg,
        };
        battle.bulletCounter++;
        b.bulletId = 'b_' + session.myId + '_' + battle.bulletCounter;
        bullets.push(b);
        tank.reload = reloadTime;
        playSound_Shot(1);
        triggerShake('shot');
        spawnParticles(b.x, b.y, '#fff', 3, 'muzzle');
        send({
            type: ClientMsg.BULLET,
            bulletId: b.bulletId,
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            damage: dmg,
        });
    }

    send({
        type: ClientMsg.STATE,
        x: tank.x,
        y: tank.y,
        angle: tank.angle,
        turretAngle: tank.turretAngle,
        hp: tank.hp,
        vx: tank.vx,
        vy: tank.vy,
    });

    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 0 || b.x > mapW || b.y < 0 || b.y > mapH) {
            bullets.splice(i, 1);
            continue;
        }
        const bi = checkBulletBrickCollision(b.x, b.y, 2, mapW, mapH, bricks);
        if (bi >= 0) {
            spawnParticles(b.x, b.y, '#8b4513', 5);
            playSound_BrickHit(1);
            const hx = bricks[bi].x;
            const hy = bricks[bi].y;
            bricks.splice(bi, 1);
            bumpBricksDrawRevision();
            bullets.splice(i, 1);
            send({
                type: ClientMsg.BRICKS_DESTROY_BATCH,
                list: [{ x: hx, y: hy }],
                ownerId: session.myId,
                bulletId: b.bulletId,
            });
            continue;
        }
        if (b.ownerId === session.myId) {
            for (const id in enemyTanks) {
                const et = enemyTanks[id];
                if (et.hp > 0 && et.team !== session.myTeam && Math.hypot(b.x - et.x, b.y - et.y) < 20) {
                    send({
                        type: ClientMsg.DEAL_DAMAGE,
                        damage: b.damage,
                        hitX: b.x,
                        hitY: b.y,
                        targetId: id,
                        bulletId: b.bulletId,
                    });
                    bullets.splice(i, 1);
                    break;
                }
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.type === 'smoke' || p.type === 'fire_smoke' || p.type === 'dark_smoke') p.size += dt * 5;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
        const s = smokes[i];
        s.time += dt;
        if (s.time > 10) {
            smokes.splice(i, 1);
            continue;
        }
        s.particles.forEach((p) => {
            if (s.time < 0.5) p.alpha = Math.min(0.8, p.alpha + dt * 2);
            else if (s.time > 7) p.alpha = Math.max(0, p.alpha - dt * 0.3);
            p.size += dt * 2;
            p.ox += (Math.random() - 0.5) * dt * 5;
            p.oy += (Math.random() - 0.5) * dt * 5 - dt * 2;
        });
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        const el = performance.now() - r.startTime;
        if (el >= r.duration) {
            rockets.splice(i, 1);
        }
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i];
        e.time += dt;
        if (e.time > e.maxTime) explosions.splice(i, 1);
    }
    updateBoosts(dt, send, updateInventoryUI);
    const now = performance.now();
    while (tracks.length > 0 && now - tracks[0].time > TRACK_LIFETIME) tracks.shift();
    while (tracks.length > MAX_TRACKS_IN_WORLD) tracks.shift();
}

function updateBoosts(dt, send, updateInventoryUI) {
    for (let i = boosts.length - 1; i >= 0; i--) {
        const b = boosts[i];
        if (tank.hp > 0 && Math.hypot(b.x - tank.x, b.y - tank.y) < BOOST_PICKUP_RADIUS) {
            applyBoost(b.type, updateInventoryUI);
            send({ type: ClientMsg.BOOST_PICKUP, boostId: b.id, x: b.x, y: b.y });
            boosts.splice(i, 1);
        }
    }
}

function applyBoost(type, updateInventoryUI) {
    if (type === 0) {
        tank.hp = Math.min(TANK_MAX_HP, tank.hp + 50);
        spawnParticles(tank.x, tank.y, '#4CAF50', 10);
        playSound_Heal();
    } else if (type === 1) {
        tank.damageBoostTimer += BOOST_DURATION;
        spawnParticles(tank.x, tank.y, '#ffeb3b', 10);
        playSound_Damage();
    } else if (type === 2) {
        tank.speedBoostTimer += BOOST_SPEED_DURATION;
        spawnParticles(tank.x, tank.y, '#2196F3', 10);
        playSound_Speed();
    } else if (type === 3) {
        tank.smokeCount++;
        spawnParticles(tank.x, tank.y, '#9C27B0', 10);
        playSound_Heal();
    } else if (type === 4) {
        tank.mineCount++;
        spawnParticles(tank.x, tank.y, '#333', 10);
        playSound_Heal();
    } else if (type === 5) {
        tank.rocketCount++;
        spawnParticles(tank.x, tank.y, '#ffeb3b', 10);
        playSound_Heal();
    }
    updateInventoryUI();
}
