/**
 * Игровой шаг симуляции: движение, столкновения, снаряды, таймеры.
 * Сеть — только через переданный send(); DOM — через updateInventoryUI.
 */
import { ClientMsg } from '../../../shared/dist/protocol.js';
import { DETECTION_MEMORY_MS } from '../config/constants.js';
import {
    BOOST_DURATION,
    BOOST_PICKUP_RADIUS,
    BOOST_SPEED_DURATION,
    MAX_TRACKS_IN_WORLD,
    TRACK_LIFETIME,
} from '../config/constants.js';
import {
    calcPan,
    calcVol,
    playAlert,
    playRocketFlyBy,
    playSound_BrickHit,
    playSound_Damage,
    playSound_Heal,
    playSound_Hit,
    playSound_Shot,
    playSound_ShotHeavy,
    playSound_Smoke,
    playSound_Speed,
    playSound_PickBonus,
    playSound_StoneHit,
    setListener,
} from '../lib/audio.js';
import { triggerShake } from './cameraShake.js';
import {
    checkBulletBrickCollision,
    checkBulletStoneCollision,
    clampTankCenterToMap,
    getTankHullHalfExtents,
    obbIntersectsObb,
    pointInsideObb,
    separateTankFromBricks,
    separateTankFromStones,
    tankBrickCollisionIndex,
    tankStoneCollision,
} from './collision.js';
import { addTrack, createBulletHitEffect, createSmokeCloud, spawnMuzzleFlash, spawnParticles } from './effects.js';
import { battle, bumpBricksDrawRevision, level, session, world } from './gameState.js';

const {
    bricks,
    stones,
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
    if (session.roundOver) return; // Раунд окончен — заморозка
    const def = battle.tankDef;
    setListener(camX, camY);
    // Удаляем врагов, которых давно не видно
    const now = performance.now();
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if ((et.lastSeenAt ?? 0) + DETECTION_MEMORY_MS < now) {
            delete enemyTanks[id];
        }
    }
    if (session.gameStarted && tank.hp > 0) updateInventoryUI();
    if (tank.hp <= 0 || tank.isDead) {
        if (session.myEngine) session.myEngine.update(dt, 0, 0, 0);
        if (session.enemyEngine) session.enemyEngine.update(dt, 0, 0, 0);
        // Обновляем эффекты даже после смерти (пули, партиклы, ракеты, взрывы, дым)
        updateEffectsOnly(dt);
        if (tank._respawnTimer > 0) {
            tank._respawnTimer -= dt;
            const el = document.getElementById('death-screen');
            if (el) el.innerHTML = `<div style="font-size:50px;color:#cc4036">УНИЧТОЖЕН</div><div style="font-size:37px;color:#f1f1f1">Возрождение через ${Math.max(0, tank._respawnTimer).toFixed(1)} сек</div>`;
        }
        return;
    }
    if (tank.spawnImmunityTimer > 0) tank.spawnImmunityTimer -= dt;
    if (tank.damageBoostTimer > 0) tank.damageBoostTimer -= dt;
    if (tank.speedBoostTimer > 0) tank.speedBoostTimer -= dt;
    if (tank.collisionTimer > 0) tank.collisionTimer -= dt;
    if (tank.healCooldown > 0) tank.healCooldown -= dt;

    // Хилка — расходник на R
    if (keys['KeyR'] && tank.healCount > 0 && tank.healCooldown <= 0 && tank.hp > 0 && tank.hp < def.hp) {
        tank.healCount--;
        tank.healCooldown = 2;
        tank.hp = Math.min(def.hp, tank.hp + 50);
        spawnParticles(tank.x, tank.y, '#4CAF50', 10);
        playSound_Heal();
        send({ type: ClientMsg.USE_HEAL });
        keys['KeyR'] = false;
        updateInventoryUI();
    }

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
    if (keys['KeyF'] && tank.rocketCount > 0) {
        tank.rocketCount--;
        const mx = keys['MouseX'] || width / 2;
        const my = keys['MouseY'] || height / 2;
        const wx = camX + (mx - width / 2) / scaleFactor;
        const wy = camY + (my - height / 2) / scaleFactor;
        send({ type: ClientMsg.LAUNCH_ROCKET, tx: wx, ty: wy });
        playAlert();
        playRocketFlyBy();
        keys['KeyF'] = false;
        updateInventoryUI();
    }

    if (keys['KeyA']) tank.angle -= def.turnSpeed * dt;
    if (keys['KeyD']) tank.angle += def.turnSpeed * dt;
    clampTankCenterToMap(tank, mapW, mapH);

    const cosA = Math.cos(tank.angle);
    const sinA = Math.sin(tank.angle);
    let forwardSpeed = tank.vx * cosA + tank.vy * sinA;
    let rightSpeed = -tank.vx * sinA + tank.vy * cosA;
    let input = 0;
    if (keys['KeyW']) input = 1;
    if (keys['KeyS']) input = -1;

    let currentMaxSpeed = def.maxSpeedForward;
    if (tank.speedBoostTimer > 0) currentMaxSpeed *= 1.4;

    let targetSpeed;
    let accelRate;
    if (input === 1) {
        targetSpeed = currentMaxSpeed;
        accelRate = forwardSpeed < 0 ? def.brakePower : def.accelForward;
    } else if (input === -1) {
        targetSpeed = -def.maxSpeedReverse;
        accelRate = forwardSpeed > 0 ? def.brakePower : def.accelReverse;
    } else {
        targetSpeed = 0;
        accelRate = def.naturalDrag;
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

    rightSpeed *= def.grip;
    tank.vx = forwardSpeed * cosA - rightSpeed * sinA;
    tank.vy = forwardSpeed * sinA + rightSpeed * cosA;

    const { hw, hh } = getTankHullHalfExtents(tank);
    const nx = tank.x + tank.vx * dt;
    const ny = tank.y + tank.vy * dt;
    const colX = tankBrickCollisionIndex(nx, tank.y, tank.angle, hw, hh, bricks, mapW, mapH);
    if (colX === -1 && !tankStoneCollision(nx, tank.y, tank.angle, hw, hh, stones)) tank.x = nx;
    else tank.vx = 0;
    const colY = tankBrickCollisionIndex(tank.x, ny, tank.angle, hw, hh, bricks, mapW, mapH);
    if (colY === -1 && !tankStoneCollision(tank.x, ny, tank.angle, hw, hh, stones)) tank.y = ny;
    else tank.vy = 0;
    separateTankFromBricks(tank, bricks, mapW, mapH);
    if (stones.length) separateTankFromStones(tank, stones);
    // Локальное толкание остовов (визуальная отзывчивость).
    // Торможение танка приходит от сервера (HULL_SLOW) — надёжно для всех типов.
    for (const hull of world.hulls) {
        if (obbIntersectsObb(tank.x, tank.y, tank.angle, hw, hh, hull.x, hull.y, hull.angle, hull.w / 2, hull.h / 2)) {
            const dx = hull.x - tank.x;
            const dy = hull.y - tank.y;
            const d = Math.hypot(dx, dy) || 1;
            hull.x += (dx / d) * 4;
            hull.y += (dy / d) * 4;
        }
    }
    // Остовы не должны стакаться
    for (let a = 0; a < world.hulls.length; a++) {
        const ha = world.hulls[a];
        for (let b = a + 1; b < world.hulls.length; b++) {
            const hb = world.hulls[b];
            if (obbIntersectsObb(ha.x, ha.y, ha.angle, ha.w / 2, ha.h / 2, hb.x, hb.y, hb.angle, hb.w / 2, hb.h / 2)) {
                const dx = hb.x - ha.x;
                const dy = hb.y - ha.y;
                const d = Math.hypot(dx, dy) || 1;
                hb.x += (dx / d) * 4;
                hb.y += (dy / d) * 4;
                ha.x -= (dx / d) * 4;
                ha.y -= (dy / d) * 4;
            }
        }
    }

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
                if (rs > def.maxSpeedForward * 0.5 && tank.collisionTimer <= 0) {
                    if (tank.spawnImmunityTimer <= 0) {
                        tank.hp -= def.collisionDamage;
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
    if (stones.length) separateTankFromStones(tank, stones);
    clampTankCenterToMap(tank, mapW, mapH);

    const mySpeedNorm = Math.abs(forwardSpeed) / currentMaxSpeed;
    let enemySpeed = 0;
    let distToEnemy = 1920;
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
    const ENGINE_RANGE = 2000;
    const myDistFactor = Math.max(0, 1 - Math.hypot(tank.x - camX, tank.y - camY) / ENGINE_RANGE);
    const myPan = (tank.x - camX) / 960;
    let closestEnemyCamDist = ENGINE_RANGE;
    let closestEnemyX = camX;
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if (et.hp > 0) {
            const d = Math.hypot(et.x - camX, et.y - camY);
            if (d < closestEnemyCamDist) {
                closestEnemyCamDist = d;
                closestEnemyX = et.x;
            }
        }
    }
    const enemyDistFactor = Math.max(0, 1 - closestEnemyCamDist / ENGINE_RANGE);
    const enemyPan = (closestEnemyX - camX) / 960;
    if (session.myEngine) session.myEngine.update(dt, mySpeedNorm, myDistFactor, myPan);
    if (session.enemyEngine) session.enemyEngine.update(dt, enemySpeed / def.maxSpeedForward, enemyDistFactor, enemyPan);

    if (tank.hp > 0) {
        const hpPct = tank.hp / def.hp;
        if (hpPct <= 0.33) {
            // Огонь (≤33% HP) — спавн ближе к заду танка
            const burnX = tank.x - Math.cos(tank.angle) * 18;
            const burnY = tank.y - Math.sin(tank.angle) * 18;
            if (Math.random() < 0.10) spawnParticles(burnX, burnY, '#555', 1, 'fire_smoke');
            if (Math.random() > 0.965) spawnParticles(burnX, burnY, '#fff', 1, 'burn_spark');
        } else if (hpPct <= 0.66 && Math.random() > 0.96) {
            // Серый дым (33-66% HP) — спавн ближе к заду танка
            const smokeX = tank.x - Math.cos(tank.angle) * 18;
            const smokeY = tank.y - Math.sin(tank.angle) * 18;
            spawnParticles(smokeX, smokeY, '#888', 1, 'smoke');
        }
    }
    for (const id in enemyTanks) {
        const et = enemyTanks[id];
        if (et.hp > 0 && (et.lastSeenAt ?? 0) + DETECTION_MEMORY_MS >= now) {
            const etMaxHp = et.maxHp || 100;
            const etPct = et.hp / etMaxHp;
            if (etPct <= 0.33) {
                const ebX = et.x - Math.cos(et.angle) * 18;
                const ebY = et.y - Math.sin(et.angle) * 18;
                if (Math.random() < 0.10) spawnParticles(ebX, ebY, '#555', 1, 'fire_smoke');
                if (Math.random() > 0.965) spawnParticles(ebX, ebY, '#fff', 1, 'burn_spark');
            } else if (etPct <= 0.66 && Math.random() > 0.96) {
                const esX = et.x - Math.cos(et.angle) * 18;
                const esY = et.y - Math.sin(et.angle) * 18;
                spawnParticles(esX, esY, '#888', 1, 'smoke');
            }
        }
    }
    // Чёрный дым от остовов (медленно рассеивается)
    for (const hull of world.hulls) {
        if (Math.random() < 0.003) spawnParticles(hull.x, hull.y, '#111', 1, 'dark_smoke');
    }

    // speedAbs нужен для разброса стрельбы
    const speedAbs = Math.abs(forwardSpeed);
    // Считаем дистанцию по реальному перемещению (а не forwardSpeed),
    // чтобы следы появлялись и при толкании от коллизий / остовов.
    const _prevX = level._prevTrackX ?? tank.x;
    const _prevY = level._prevTrackY ?? tank.y;
    const movedDist = Math.hypot(tank.x - _prevX, tank.y - _prevY);
    level._prevTrackX = tank.x;
    level._prevTrackY = tank.y;
    level.trackSpawnDist += movedDist;
    if (level.trackSpawnDist > 15) {
        const ttype = tank.tankType || 'medium';
        const off = ttype === 'heavy' ? 23 : ttype === 'light' ? 15 : 18;
        const backOff = (ttype === 'heavy' ? 15 : 0) + 20;
        const bkX = -Math.cos(tank.angle) * backOff;
        const bkY = -Math.sin(tank.angle) * backOff;
        const trackLX = tank.x + bkX - Math.cos(tank.angle + Math.PI / 2) * off;
        const trackLY = tank.y + bkY - Math.sin(tank.angle + Math.PI / 2) * off;
        const trackRX = tank.x + bkX - Math.cos(tank.angle - Math.PI / 2) * off;
        const trackRY = tank.y + bkY - Math.sin(tank.angle - Math.PI / 2) * off;
        addTrack(trackLX, trackLY, tank.angle, ttype);
        addTrack(trackRX, trackRY, tank.angle, ttype);
        level.trackSpawnDist = 0;
        // Грязь из-под обеих гусениц
        if (Math.random() > 0.6) {
            spawnParticles(trackLX, trackLY, '#2e2418', 1, 'dirt');
        }
        if (Math.random() > 0.6) {
            spawnParticles(trackRX, trackRY, '#2e2418', 1, 'dirt');
        }
        // Выхлопные газы из обеих гусениц
        const exVx = -Math.cos(tank.angle) * 40;
        const exVy = -Math.sin(tank.angle) * 40;
        particles.push({
            x: trackLX, y: trackLY, vx: exVx, vy: exVy,
            life: 1, size: 10, color: 'rgba(80,80,80,1)',
            type: 'exhaust',
        });
        particles.push({
            x: trackRX, y: trackRY, vx: exVx, vy: exVy,
            life: 1, size: 10, color: 'rgba(80,80,80,1)',
            type: 'exhaust',
        });
    }

    const mx = keys['MouseX'] || width / 2;
    const my = keys['MouseY'] || height / 2;
    const wx = camX + (mx - width / 2) / scaleFactor;
    const wy = camY + (my - height / 2) / scaleFactor;
    let targetAngle = Math.atan2(wy - tank.y, wx - tank.x);
    let diff = targetAngle - tank.turretAngle;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;

    let finalSpeed = def.turretRotationSpeed;
    let hullTurnDir = 0;
    if (keys['KeyA']) hullTurnDir = -1;
    if (keys['KeyD']) hullTurnDir = 1;
    if ((diff < 0 && hullTurnDir < 0) || (diff > 0 && hullTurnDir > 0)) finalSpeed += def.turnSpeed;
    else if (hullTurnDir !== 0) finalSpeed = Math.max(0.1, finalSpeed - def.turnSpeed * 0.5);
    if (Math.abs(diff) < finalSpeed * dt) tank.turretAngle = targetAngle;
    else tank.turretAngle += diff > 0 ? finalSpeed * dt : -finalSpeed * dt;

    // Прицел — плавное движение вдоль оси башни
    const targetAimDist = Math.max(60, Math.hypot(wx - tank.x, wy - tank.y));
    const aimLerp = 1 - Math.exp(-8 * dt); // экспоненциальное затухание, ~8 единиц/сек
    tank.aimDist += (targetAimDist - tank.aimDist) * aimLerp;

    if (tank.reload > 0) tank.reload -= dt;
    let reloadTime = def.reloadTime;
    let dmg = def.bulletDamage;
    if (tank.damageBoostTimer > 0) {
        // Бонус атаки — только ускоренная перезарядка, урон не меняется
        reloadTime = def.reloadTime * def.reloadBoostMult;
    }

    if (keys['MouseLeft'] && tank.reload <= 0) {
        const sr = speedAbs / currentMaxSpeed;
        const sp = (Math.random() - 0.5) * sr * 12 * (Math.PI / 180) * 2;
        const a = tank.turretAngle + sp;
        const bulletOff = tank.tankType === 'heavy' ? 98 : tank.tankType === 'medium' ? 84 : 55;
        const b = {
            x: tank.x + Math.cos(a) * bulletOff,
            y: tank.y + Math.sin(a) * bulletOff,
            vx: Math.cos(a) * 1500,
            vy: Math.sin(a) * 1500,
            ownerId: session.myId,
            ownerTeam: session.myTeam,
            damage: dmg,
        };
        battle.bulletCounter++;
        b.bulletId = 'b_' + session.myId + '_' + battle.bulletCounter;
        bullets.push(b);
        tank.reload = reloadTime;
        tank._reloadTotal = reloadTime;
        const shotVol = calcVol(b.x, b.y, 1920);
        const shotPan = calcPan(b.x, b.y);
        if (tank.tankType === 'heavy') {
            playSound_ShotHeavy(shotVol, shotPan);
        } else {
            playSound_Shot(shotVol, shotPan);
        }
        triggerShake('shot');
        spawnMuzzleFlash(b.x, b.y, a);
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
        healCount: tank.healCount,
        smokeCount: tank.smokeCount,
        mineCount: tank.mineCount,
        rocketCount: tank.rocketCount,
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
            playSound_BrickHit(calcVol(b.x, b.y, 1920), calcPan(b.x, b.y));
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
        // Пуля попала в камень — искры + звук, пуля исчезает, камень не разрушается
        if (stones.length && checkBulletStoneCollision(b.x, b.y, stones)) {
            spawnParticles(b.x, b.y, '#999', 4);
            playSound_StoneHit(calcVol(b.x, b.y, 1920), calcPan(b.x, b.y));
            bullets.splice(i, 1);
            continue;
        }
        // Пуля попала в остов — искры + звук, без урона
        let hitHull = false;
        for (const hull of world.hulls) {
            if (pointInsideObb(b.x, b.y, hull.x, hull.y, hull.angle, hull.w / 2, hull.h / 2)) {
                createBulletHitEffect(b.x, b.y);
                playSound_Hit(calcVol(b.x, b.y, 1920), calcPan(b.x, b.y));
                bullets.splice(i, 1);
                hitHull = true;
                break;
            }
        }
        if (hitHull) continue;
        if (b.ownerId === session.myId) {
            for (const id in enemyTanks) {
                const et = enemyTanks[id];
                if (et.hp > 0 && et.team !== session.myTeam && pointInsideObb(b.x, b.y, et.x, et.y, et.angle, (et.w || 75) / 2, (et.h || 45) / 2)) {
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

    const windVx = Math.cos(level.windAngle) * level.windSpeed;
    const windVy = Math.sin(level.windAngle) * level.windSpeed;
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const isSmoke = p.type === 'smoke' || p.type === 'fire_smoke' || p.type === 'dark_smoke';
        const isMuzzle = p.type === 'muzzle' || p.type === 'muzzle_smoke';
        const isExplSmoke = p.type === 'expl_smoke';
        const isExplDirt = p.type === 'expl_dirt';
        const isExplSpark = p.type === 'expl_spark';
        const isExplFire = p.type === 'expl_fire';
        p.x += (p.vx + (isSmoke ? windVx : 0)) * dt;
        p.y += (p.vy + (isSmoke ? windVy : 0)) * dt;
        if (isMuzzle) { const d = Math.pow(0.04, dt); p.vx *= d; p.vy *= d; }
        // Дым взрыва: сильное замедление (как мазл)
        if (isExplSmoke) { const d = Math.pow(0.04, dt); p.vx *= d; p.vy *= d; }
        // Искры взрыва: замедление как дым
        if (isExplSpark) { const d = Math.pow(0.04, dt); p.vx *= d; p.vy *= d; }
        if (p.type === 'spark_hit') { const d = Math.pow(0.25, dt); p.vx *= d; p.vy *= d; }
        // Куски земли: слабое замедление
        if (isExplDirt) { const d = Math.pow(0.25, dt); p.vx *= d; p.vy *= d; }
        // Фаерболы взрыва: растут
        if (isExplFire) { p.size += dt * 8; }
        // Пыль: растёт
        if (p.type === 'expl_dust') { p.size += dt * 3; }
        if (p.type === 'exhaust') { p.size += dt * 40; }
        p.life -= dt;
        if (p.type === 'fire_smoke') p.size *= Math.pow(1.5, dt);
        else if (isSmoke || isExplSmoke) p.size += dt * 5;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = smokes.length - 1; i >= 0; i--) {
        const s = smokes[i];
        s.time += dt;
        if (s.time > 10) {
            smokes.splice(i, 1);
            continue;
        }
        s.x += windVx * dt;
        s.y += windVy * dt;
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
    while (tracks.length > 0 && now - tracks[0].time > TRACK_LIFETIME) tracks.shift();
    while (tracks.length > MAX_TRACKS_IN_WORLD) tracks.shift();
}

function updateEffectsOnly(dt) {
    const now = performance.now();
    const mapW = level.mapWidth;
    const mapH = level.mapHeight;
    // Пули
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
            bricks.splice(bi, 1);
            bumpBricksDrawRevision();
            bullets.splice(i, 1);
            continue;
        }
        if (stones.length && checkBulletStoneCollision(b.x, b.y, stones)) {
            spawnParticles(b.x, b.y, '#999', 4);
            bullets.splice(i, 1);
            continue;
        }
        let hitHull = false;
        for (const hull of world.hulls) {
            if (pointInsideObb(b.x, b.y, hull.x, hull.y, hull.angle, hull.w / 2, hull.h / 2)) {
                createBulletHitEffect(b.x, b.y);
                bullets.splice(i, 1);
                hitHull = true;
                break;
            }
        }
        if (hitHull) continue;
    }
    // Партиклы
    const wVx = Math.cos(level.windAngle) * level.windSpeed;
    const wVy = Math.sin(level.windAngle) * level.windSpeed;
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const isSmoke = p.type === 'smoke' || p.type === 'fire_smoke' || p.type === 'dark_smoke';
        const isMuzzle = p.type === 'muzzle' || p.type === 'muzzle_smoke';
        const isExplSmoke = p.type === 'expl_smoke';
        const isExplDirt = p.type === 'expl_dirt';
        const isExplSpark = p.type === 'expl_spark';
        const isExplFire = p.type === 'expl_fire';
        const isExplDust = p.type === 'expl_dust';
        p.x += (p.vx + (isSmoke ? wVx : 0)) * dt;
        p.y += (p.vy + (isSmoke ? wVy : 0)) * dt;
        if (isMuzzle) { const d = Math.pow(0.04, dt); p.vx *= d; p.vy *= d; }
        if (isExplSmoke) { const d = Math.pow(0.04, dt); p.vx *= d; p.vy *= d; }
        if (isExplSpark) { const d = Math.pow(0.04, dt); p.vx *= d; p.vy *= d; }
        if (p.type === 'spark_hit') { const d = Math.pow(0.25, dt); p.vx *= d; p.vy *= d; }
        if (isExplDirt) { const d = Math.pow(0.25, dt); p.vx *= d; p.vy *= d; }
        if (isExplFire) p.size += dt * 8;
        if (isExplDust) p.size += dt * 3;
        if (p.type === 'exhaust') p.size += dt * 40;
        p.life -= dt;
        if (p.type === 'fire_smoke') p.size *= Math.pow(1.5, dt);
        else if (isSmoke) p.size += dt * 5;
        if (p.life <= 0) particles.splice(i, 1);
    }
    // Дымы
    for (let i = smokes.length - 1; i >= 0; i--) {
        const s = smokes[i];
        s.time += dt;
        if (s.time > 10) { smokes.splice(i, 1); continue; }
        s.x += wVx * dt;
        s.y += wVy * dt;
        s.particles.forEach((p) => {
            if (s.time < 0.5) p.alpha = Math.min(0.8, p.alpha + dt * 2);
            else if (s.time > 7) p.alpha = Math.max(0, p.alpha - dt * 0.3);
            p.size += dt * 2;
            p.ox += (Math.random() - 0.5) * dt * 5;
            p.oy += (Math.random() - 0.5) * dt * 5 - dt * 2;
        });
    }
    // Ракеты
    for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        if (performance.now() - r.startTime >= r.duration) rockets.splice(i, 1);
    }
    // Взрывы
    for (let i = explosions.length - 1; i >= 0; i--) {
        const e = explosions[i];
        e.time += dt;
        if (e.time > e.maxTime) explosions.splice(i, 1);
    }
    // Следы
    while (tracks.length > 0 && now - tracks[0].time > TRACK_LIFETIME) tracks.shift();
    while (tracks.length > MAX_TRACKS_IN_WORLD) tracks.shift();
    // Чёрный дым от остовов
    for (const hull of world.hulls) {
        if (Math.random() < 0.003) spawnParticles(hull.x, hull.y, '#111', 1, 'dark_smoke');
    }
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
        tank.healCount++;
        spawnParticles(tank.x, tank.y, '#4CAF50', 10);
        playSound_PickBonus(0.5);
    } else if (type === 1) {
        tank.damageBoostTimer += BOOST_DURATION;
        spawnParticles(tank.x, tank.y, '#ffeb3b', 10);
        playSound_PickBonus(0.5);
    } else if (type === 2) {
        tank.speedBoostTimer += BOOST_SPEED_DURATION;
        spawnParticles(tank.x, tank.y, '#2196F3', 10);
        playSound_PickBonus(0.5);
    } else if (type === 3) {
        tank.smokeCount++;
        spawnParticles(tank.x, tank.y, '#9C27B0', 10);
        playSound_PickBonus(0.5);
    } else if (type === 4) {
        tank.mineCount++;
        spawnParticles(tank.x, tank.y, '#333', 10);
        playSound_PickBonus(0.5);
    } else if (type === 5) {
        tank.rocketCount++;
        spawnParticles(tank.x, tank.y, '#ffeb3b', 10);
        playSound_PickBonus(0.5);
    }
    updateInventoryUI();
}
