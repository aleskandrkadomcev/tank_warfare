/**
 * Игровой клиент: лобби, цикл кадра, DOM.
 * Симуляция — simulation.js; коллизии — collision.js; эффекты — effects.js; рендер — render/*; ввод — input/keyboard.js.
 */
import { ClientMsg } from '../../../shared/dist/protocol.js';
import { SPAWN_IMMUNITY_TIME, TANK_COLORS, TANK_MAX_HP, VIRTUAL_HEIGHT } from '../config/constants.js';
import { getWebSocketUrl } from '../config/env.js';
import { attachGameInput, gameKeys } from '../input/keyboard.js';
import { playSound_StartMusic, updateVolume } from '../lib/audio.js';
import {
    configureServerMessages,
    gameMessageHooks,
    handleServerMessage,
} from '../network/messageHandlers.js';
import { connectGameSocket, isGameSocketOpen, sendGameMessage } from '../network/socket.js';
import { drawGameFrame } from '../render/drawFrame.js';
import { findSpawnSpot } from './collision.js';
import { shadeColor } from './colorUtils.js';
import { addTrack, createExplosion, createSmokeCloud, spawnParticles } from './effects.js';
import { battle, level, session, world } from './gameState.js';
import { runSimulation } from './simulation.js';

const {
    bricks,
    forests,
    bullets,
    particles,
    tracks,
    boosts,
    smokes,
    mines,
    rockets,
    explosions,
} = world;
const { tank, enemyTanks } = battle;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width, height, scaleFactor = 1;
let lastTime = 0;
let cachedPatterns = { grassBase: null, perlinMask: null };
let camX = 0;
let camY = 0;
/** Сглаженный FPS для HUD (экспоненциальное сглаживание). */
let fpsSmoothed = 0;
const FPS_SMOOTH = 0.12;

/** Последний отрисованный снимок панели бустов — без смены не трогаем innerHTML (дорого для layout). */
let boostPanelRenderSig = '';

attachGameInput(canvas);

function getNickname() {
    const inputNick = document.getElementById('nicknameInput').value.trim();
    if (inputNick) {
        sessionStorage.setItem('tank_nickname_session', inputNick);
        return sanitize(inputNick, 12);
    }
    let nick = sessionStorage.getItem('tank_nickname_session');
    if (!nick) {
        nick = 'Игрок' + Math.floor(Math.random() * 1000);
        sessionStorage.setItem('tank_nickname_session', nick);
    }
    return sanitize(nick, 12);
}
function sanitize(str, maxLen) {
    return str.substring(0, maxLen).replace(/[^a-zA-Z0-9_а-яА-Я]/g, '') || 'Игрок';
}
window.addEventListener('load', () => {
    const nickInput = document.getElementById('nicknameInput');
    if (nickInput) nickInput.value = sessionStorage.getItem('tank_nickname_session') || '';
    initColorPicker();
    updateLobbyListUI([]);
    connect();
});
function initColorPicker() {
    const picker = document.getElementById('colorPicker');
    picker.innerHTML = '';
    TANK_COLORS.forEach((color) => {
        const btn = document.createElement('div');
        btn.className = 'color-btn' + (color === session.myColor ? ' selected' : '');
        btn.style.background = color;
        btn.onclick = (ev) => selectColor(color, ev);
        picker.appendChild(btn);
    });
}
function selectColor(color, ev) {
    session.myColor = color;
    document.querySelectorAll('.color-btn').forEach((b) => b.classList.remove('selected'));
    const el = ev?.currentTarget;
    if (el) el.classList.add('selected');
    if (isGameSocketOpen() && session.currentLobbyId) {
        sendGameMessage({ type: ClientMsg.UPDATE_PLAYER, color });
    }
}

function connect() {
    connectGameSocket(getWebSocketUrl(), {
        setConnectingStatus: setStatus,
        onMessage: handleServerMessage,
        onClose: () => {
            if (session.gameStarted) location.reload();
            else setStatus('Отключено');
        },
    });
}

function createLobby() {
    const nick = getNickname(),
        name = document.getElementById('lobbyNameInput').value.trim() || 'Лобби';
    session.myNickname = nick;
    connect();
    setTimeout(
        () =>
            sendGameMessage({
                type: ClientMsg.CREATE_LOBBY,
                nickname: nick,
                lobbyName: name,
                color: session.myColor,
            }),
        300,
    );
}
function joinLobbyByCode() {
    const code = document.getElementById('roomIdInput').value.trim();
    if (!code) return alert('Введи код');
    const nick = getNickname();
    session.myNickname = nick;
    connect();
    setTimeout(
        () =>
            sendGameMessage({
                type: ClientMsg.JOIN_LOBBY,
                lobbyId: code,
                nickname: nick,
                color: session.myColor,
            }),
        300,
    );
}
function joinLobby(id) {
    const nick = getNickname();
    session.myNickname = nick;
    connect();
    setTimeout(
        () =>
            sendGameMessage({
                type: ClientMsg.JOIN_LOBBY,
                lobbyId: id,
                nickname: nick,
                color: session.myColor,
            }),
        300,
    );
}
function showLobby(id, name, isHost) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('roomCodeDisplay').innerText = id;
    document.getElementById('lobbyNameDisplay').innerText = name || 'Лобби';
    document.getElementById('btnStart').style.display = isHost ? 'inline-block' : 'none';
    document.getElementById('btnAddBot').style.display = isHost ? 'inline-block' : 'none';
    document.getElementById('btnRemoveBot').style.display = isHost ? 'inline-block' : 'none';
    document.getElementById('lobbyNickInput').value = session.myNickname;
    document.getElementById('lobbyNickInput').oninput = (e) => {
        session.myNickname = sanitize(e.target.value, 12);
        if (isGameSocketOpen()) {
            sendGameMessage({ type: ClientMsg.UPDATE_PLAYER, nickname: session.myNickname });
        }
    };
    initColorPicker();
}
function escapeLobbyIdAttr(id) {
    return String(id).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function updateLobbyListUI(lobbies) {
    const list = document.getElementById('lobbyList');
    if (lobbies.length === 0) {
        list.innerHTML = '<div style="color:#666;font-style:italic">Нет активных лобби</div>';
        return;
    }
    list.innerHTML = lobbies
        .map(
            (l) =>
                `<div class="lobby-item"><span class="lobby-name">${l.name}</span><span class="lobby-players">${l.players}/${l.max}</span><button type="button" class="join-btn" data-lobby-id="${escapeLobbyIdAttr(l.id)}">▶</button></div>`,
        )
        .join('');
}
function updateLobbyPlayers(players) {
    const t1 = document.getElementById('team1-list'),
        t2 = document.getElementById('team2-list');
    t1.innerHTML = '';
    t2.innerHTML = '';
    players.forEach((p) => {
        const div = document.createElement('div');
        div.className = 'player-slot team' + p.team;
        div.innerHTML = `<div class="player-color" style="background:${p.color}"></div><strong>${p.nick}</strong>${p.isHost ? ' 👑' : ''}${p.isBot ? ' 🤖' : ''}`;
        (p.team === 1 ? t1 : t2).appendChild(div);
        session.playerData[p.id] = { nick: p.nick, team: p.team, color: p.color, isBot: Boolean(p.isBot) };
        if (p.id === session.myId) {
            session.myTeam = p.team;
            session.myColor = p.color;
        }
    });
}
function setTeam(team) {
    sendGameMessage({ type: ClientMsg.CHANGE_TEAM, team });
}
function toggleReady() {
    sendGameMessage({ type: ClientMsg.TOGGLE_READY });
}
function startGame() {
    sendGameMessage({ type: ClientMsg.START_GAME });
}

function addBot() {
    sendGameMessage({ type: ClientMsg.ADD_BOT });
}

function removeBot() {
    sendGameMessage({ type: ClientMsg.REMOVE_BOT });
}

function startGameClient() {
    boostPanelRenderSig = '';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('ui-game').style.display = 'block';
    document.getElementById('score-board').style.display = 'block';
    document.getElementById('volume-control').style.display = 'block';
    document.getElementById('boost-panel').style.display = 'flex';
    document.getElementById('victory-screen').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    resize();
    session.gameStarted = true;
    lastTime = performance.now();
    fpsSmoothed = 0;
    const fpsVal = document.getElementById('fps-value');
    if (fpsVal) fpsVal.textContent = '—';
    playSound_StartMusic();
    setTimeout(spawnMyTank, 500);
    requestAnimationFrame(loop);
}

function resetMatch() {
    boostPanelRenderSig = '';
    battle.myScore = 0;
    battle.enemyScore = 0;
    updateUI();
    document.getElementById('victory-screen').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    tracks.length = 0;
    particles.length = 0;
    boosts.length = 0;
    smokes.length = 0;
    mines.length = 0;
    rockets.length = 0;
    explosions.length = 0;
    tank.hp = TANK_MAX_HP;
    tank.isDead = false;
    tank.damageBoostTimer = 0;
    tank.speedBoostTimer = 0;
    tank.vx = 0;
    tank.vy = 0;
    tank.collisionTimer = 0;
    tank.smokeCount = 0;
    tank.mineCount = 0;
    tank.rocketCount = 0;
    for (const id in enemyTanks) {
        enemyTanks[id].hp = TANK_MAX_HP;
        enemyTanks[id].vx = 0;
        enemyTanks[id].vy = 0;
        enemyTanks[id].spawnImmunityTimer = SPAWN_IMMUNITY_TIME;
    }
    session.gameStarted = true;
    playSound_StartMusic();
    updateInventoryUI();
    setTimeout(spawnMyTank, 500);
}

function spawnMyTank() {
    boostPanelRenderSig = '';
    bullets.length = 0;
    tank.hp = TANK_MAX_HP;
    tank.isDead = false;
    tank.reload = 0;
    tank.vx = 0;
    tank.vy = 0;
    tank.damageBoostTimer = 0;
    tank.speedBoostTimer = 0;
    tank.collisionTimer = 0;
    tank.smokeCount = 0;
    tank.mineCount = 0;
    tank.rocketCount = 0;
    tank.spawnImmunityTimer = SPAWN_IMMUNITY_TIME;
    document.getElementById('death-screen').style.display = 'none';
    updateInventoryUI();
    tank.color = session.myColor;
    tank.turretColor = shadeColor(session.myColor, -20);
    tank.trackColor = shadeColor(session.myColor, -40);
    const sectorW = level.mapWidth / 4,
        spawnW = sectorW - 50;
    let sx, sy;
    if (session.myTeam === 1) {
        sx = Math.random() * spawnW + 50;
        sy = Math.random() * (level.mapHeight - 100) + 50;
        tank.angle = 0;
    } else {
        sx = level.mapWidth - (Math.random() * spawnW + 50);
        sy = Math.random() * (level.mapHeight - 100) + 50;
        tank.angle = Math.PI;
    }
    const valid = findSpawnSpot(sx, sy, tank, bricks, level.mapWidth, level.mapHeight);
    tank.x = valid.x;
    tank.y = valid.y;
}

function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    width = w;
    height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scaleFactor = h / VIRTUAL_HEIGHT;
}

function updateInventoryUI() {
    if (!session.gameStarted) return;
    const sig = `${tank.smokeCount}|${tank.mineCount}|${tank.rocketCount}|${Math.ceil(tank.damageBoostTimer)}|${Math.ceil(tank.speedBoostTimer)}`;
    if (sig === boostPanelRenderSig) return;
    boostPanelRenderSig = sig;
    let html = '';
    html += `<div class="boost-indicator"><div class="boost-icon" style="background:#888;border:1px solid #fff;"></div>Дым: ${tank.smokeCount}</div>`;
    html += `<div class="boost-indicator"><div class="boost-icon" style="background:#2e4634;border:1px solid #fff;"></div>Мины: ${tank.mineCount}</div>`;
    html += `<div class="boost-indicator"><div class="boost-icon" style="background:#ffeb3b;border:1px solid #f44336;"></div>Ракеты: ${tank.rocketCount}</div>`;
    if (tank.damageBoostTimer > 0)
        html += `<div class="boost-indicator"><div class="boost-icon circle" style="background:#f44336;"></div>Урон: ${Math.ceil(tank.damageBoostTimer)}с</div>`;
    if (tank.speedBoostTimer > 0)
        html += `<div class="boost-indicator"><div class="boost-icon circle" style="background:#2196F3;"></div>Скор: ${Math.ceil(tank.speedBoostTimer)}с</div>`;
    document.getElementById('boost-panel').innerHTML = html;
}

function loop(ts) {
    const prevTs = lastTime;
    lastTime = ts;
    let rawDt = prevTs > 0 ? (ts - prevTs) / 1000 : 0.016;
    if (rawDt <= 0) rawDt = 0.016;
    let dt = rawDt;
    if (dt > 0.1) dt = 0.1;
    if (session.gameStarted && rawDt > 0.0005 && rawDt < 2) {
        const inst = 1 / rawDt;
        fpsSmoothed = fpsSmoothed <= 0 ? inst : fpsSmoothed * (1 - FPS_SMOOTH) + inst * FPS_SMOOTH;
        const fpsEl = document.getElementById('fps-value');
        if (fpsEl) fpsEl.textContent = String(Math.round(fpsSmoothed));
    }
    runSimulation(dt, {
        send: sendGameMessage,
        keys: gameKeys,
        width,
        height,
        scaleFactor,
        camX,
        camY,
        updateInventoryUI,
    });
    const cam = drawGameFrame(ctx, {
        width,
        height,
        scaleFactor,
        keys: gameKeys,
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
        bricksDrawRevision: world.bricksDrawRevision,
        frameTimeMs: ts,
        onRocketSmoke: (rx, ry) => spawnParticles(rx, ry, '#888', 1, 'smoke'),
    });
    camX = cam.camX;
    camY = cam.camY;
    requestAnimationFrame(loop);
}

function updateUI() {
    document.getElementById('score-me').innerText = battle.myScore;
    document.getElementById('score-enemy').innerText = battle.enemyScore;
}

window.onresize = resize;
window.visualViewport?.addEventListener('resize', resize);
resize();
function setStatus(t) {
    document.getElementById('status').innerText = t || '';
}
document.getElementById('volumeSlider')?.addEventListener('input', updateVolume);

Object.assign(gameMessageHooks, {
    updateLobbyListUI,
    showLobby,
    updateLobbyPlayers,
    startGameClient,
    resetMatch,
    spawnMyTank,
    updateUI,
    spawnParticles,
    createExplosion,
    createSmokeCloud,
    addTrack,
});
configureServerMessages({ send: sendGameMessage });

export { addBot, createLobby, joinLobby, joinLobbyByCode, removeBot, setTeam, startGame, toggleReady };

