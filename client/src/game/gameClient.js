/**
 * Игровой клиент: лобби, цикл кадра, DOM.
 * Симуляция — simulation.js; коллизии — collision.js; эффекты — effects.js; рендер — render/*; ввод — input/keyboard.js.
 */
import { ClientMsg } from '../../../shared/dist/protocol.js';
import { getTankDef } from '../../../shared/dist/tankDefs.js';
import { SPAWN_IMMUNITY_TIME, TANK_COLORS, TANK_MAX_HP, VIRTUAL_HEIGHT } from '../config/constants.js';
import { getWebSocketUrl } from '../config/env.js';
import { attachGameInput, gameKeys } from '../input/keyboard.js';
import { playSound_StartMusic, playUISound, updateVolume } from '../lib/audio.js';
import {
    configureServerMessages,
    gameMessageHooks,
    handleServerMessage,
} from '../network/messageHandlers.js';
import { connectGameSocket, isGameSocketOpen, sendGameMessage } from '../network/socket.js';
import { drawGameFrame } from '../render/drawFrame.js';
import { resetTrackCanvas } from '../render/effects.js';
import { clampCamera, findSpawnSpot } from './collision.js';
import { shadeColor } from './colorUtils.js';
import { addTrack, createBulletHitEffect, createExplosion, createSmokeCloud, createTankExplosion, spawnMuzzleFlash, spawnParticles } from './effects.js';
import { battle, level, session, world, zoomLevel } from './gameState.js';
import { runSimulation } from './simulation.js';
import cursorUrl from '../game-assets/images/cursor.png?url';
import { assets } from '../lib/assets.js';
import { getTankSkin } from '../render/tankSkin.js';

const {
    bricks,
    forests,
    stones,
    bullets,
    particles,
    tracks,
    boosts,
    smokes,
    mines,
    rockets,
    explosions,
    hulls,
    explosionMarks,
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
        return sanitize(inputNick, 24);
    }
    let nick = sessionStorage.getItem('tank_nickname_session');
    if (!nick) {
        nick = 'Игрок' + Math.floor(Math.random() * 1000);
        sessionStorage.setItem('tank_nickname_session', nick);
    }
    return sanitize(nick, 24);
}
function sanitize(str, maxLen) {
    return str.substring(0, maxLen).replace(/[^a-zA-Z0-9_а-яА-ЯёЁ]/g, '') || 'Игрок';
}
function setupUISounds() {
    const isInteractive = (el) => el.matches('button, select, option, .color-swatch, .color-selected, .join-btn, .dd-selected, .dd-item, input[type="text"]');
    document.addEventListener('mouseover', (e) => {
        if (isInteractive(e.target) && e.target.closest('#menu, #lobby-wrapper')) {
            playUISound(assets.sounds.click1, 0.4);
        }
    }, { passive: true });
    document.addEventListener('mousedown', (e) => {
        if (isInteractive(e.target) && e.target.closest('#menu, #lobby-wrapper')) {
            playUISound(assets.sounds.click2, 0.6);
        }
    }, { passive: true });
    // Звук при смене варианта в select (камуфляж, тип танка, размер карты и т.д.)
    document.addEventListener('change', (e) => {
        if (e.target.matches('select') && e.target.closest('#menu, #lobby-wrapper')) {
            playUISound(assets.sounds.click2, 0.6);
        }
    }, { passive: true });
}
let escMenuOpen = false;

function toggleEscMenu(forceClose) {
    if (!session.gameStarted) return;
    const menu = document.getElementById('esc-menu');
    if (!menu) return;
    if (forceClose || escMenuOpen) {
        menu.style.display = 'none';
        escMenuOpen = false;
        document.getElementById('escQuitConfirm').style.display = 'none';
    } else {
        menu.style.display = 'flex';
        escMenuOpen = true;
        // Обновить текст кнопки fullscreen
        const btn = document.getElementById('escBtnFullscreen');
        if (btn) btn.textContent = document.fullscreenElement ? 'На весь экран: ВКЛ' : 'На весь экран: ВЫКЛ';
    }
}

function updateFullscreenBtn() {
    const isFs = window.innerHeight >= screen.height - 5 && window.innerWidth >= screen.width - 5;
    const btn = document.getElementById('escBtnFullscreen');
    if (btn) btn.textContent = isFs ? 'На весь экран: ВКЛ (F11)' : 'На весь экран: ВЫКЛ (F11)';
}

function setupEscMenu() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            e.preventDefault();
            toggleEscMenu();
        }
    });
    window.addEventListener('resize', updateFullscreenBtn);
    document.getElementById('escBtnResume')?.addEventListener('click', () => toggleEscMenu(true));
    // Кнопка fullscreen — подсказка что нужно F11
    document.getElementById('escBtnFullscreen')?.addEventListener('click', () => {
        const btn = document.getElementById('escBtnFullscreen');
        if (btn) btn.textContent = 'Нажмите F11';
        setTimeout(updateFullscreenBtn, 2000);
    });
    document.getElementById('escBtnQuit')?.addEventListener('click', () => {
        document.getElementById('escQuitConfirm').style.display = 'block';
    });
    document.getElementById('escQuitYes')?.addEventListener('click', () => {
        sessionStorage.removeItem('gameReconnect');
        location.reload();
    });
    document.getElementById('escQuitNo')?.addEventListener('click', () => {
        document.getElementById('escQuitConfirm').style.display = 'none';
    });
}

// ── Ченжлог ──
const CHANGELOG = [
    {
        version: 'v0.5.0', date: '05.04.2026', title: 'Скины, боты, зум',
        sections: [
            { name: 'Новые танки и скины', items: [
                'Т-62 (лёгкий) — 10 скинов',
                'ИС-3 (тяжёлый) — 8 скинов',
                'Т-34-85 (средний) — 10 скинов',
                'Normal map освещение для всех танков (солнце + вспышка выстрела)',
                'Тень башни для всех типов',
                'Селектор скинов "Покраска" в лобби с превью',
            ]},
            { name: 'AI ботов', items: [
                'Тактика по типу танка (ТТ: стоп-выстрел-отъезд, СТ: обход, ЛТ: зигзаг)',
                'Все танки <50% HP меняют тактику, ЛТ ищет хилку',
                'Боты ломают кирпичи на пути и стреляют по ним в поисках бонусов',
                'Подбор бустов, использование абилок (хилка, ракета, мина, дым)',
                'Память о последней позиции врага',
                'Обнаружение из характеристик танка (ЛТ видит дальше)',
                'Не видят через стены',
                'Сложность: Новобранец / Боец / Ветеран (выбор в лобби)',
                'Pathfinding A* с учётом габаритов танка',
            ]},
            { name: 'Геймплей', items: [
                'Зум камеры (колёсико мыши, 70%-130%)',
                'КД выстрела увеличен ×2 для всех танков',
                'Скорость снаряда 1500 px/с',
                'Разброс на ходу ±12°',
                'Огромная карта (1.3× большой)',
                'Raycast коллизии снарядов (без пролёта сквозь танк)',
            ]},
            { name: 'Звук', items: [
                'Пул звуков (исправлено пропадание звуков)',
                'Стерео звук двигателя с дистанцией',
                'Все звуки от камеры, а не от танка',
                'Звук подбора бонуса (pick_bonus1.mp3)',
            ]},
            { name: 'Интерфейс', items: [
                'ESC меню (громкость, фуллскрин, выход)',
                'Хост реконнект в лобби (10 сек)',
                'Кнопка "Вернуться в игру"',
                'Тип танка в таблице лидеров',
                'Подсказка F11, никнейм до 24 символов',
            ]},
            { name: 'Баги', items: [
                'TAB скорборд после рестарта',
                'Камни не обновлялись после рестарта карты',
                'Клавиши залипали при Alt+Tab',
                'Двойной звук ракеты',
                'Краш NaN в эффектах',
            ]},
        ],
    },
];

function setupChangelog() {
    const overlay = document.getElementById('changelog-overlay');
    const verList = document.getElementById('changelog-versions');
    const content = document.getElementById('changelog-content');
    if (!overlay || !verList || !content) return;

    function renderVersion(idx) {
        const v = CHANGELOG[idx];
        verList.querySelectorAll('.changelog-ver-btn').forEach((b, i) => {
            b.classList.toggle('active', i === idx);
        });
        content.innerHTML = `<h3>${v.version} — ${v.title} <small style="color:#666">(${v.date})</small></h3>` +
            v.sections.map((s) => `<h3>${s.name}</h3><ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul>`).join('');
    }

    // Кнопки версий
    CHANGELOG.forEach((v, i) => {
        const btn = document.createElement('button');
        btn.className = 'changelog-ver-btn';
        btn.textContent = v.version;
        btn.onclick = () => renderVersion(i);
        verList.appendChild(btn);
    });

    // Открытие
    document.getElementById('btnChangelog')?.addEventListener('click', () => {
        overlay.style.display = 'flex';
        renderVersion(0);
    });
    // Закрытие
    document.getElementById('btnChangelogClose')?.addEventListener('click', () => {
        overlay.style.display = 'none';
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
    });
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && overlay.style.display === 'flex') {
            overlay.style.display = 'none';
            e.stopPropagation();
        }
    }, true); // capture чтобы перехватить до ESC меню
}

window.addEventListener('load', () => {
    const nickInput = document.getElementById('nicknameInput');
    if (nickInput) nickInput.value = sessionStorage.getItem('tank_nickname_session') || '';
    initSkinSelector();
    setupEscMenu();
    setupChangelog();
    updateLobbyListUI([]);
    setupUISounds();
    connect();
    // Подсказка F11 — 3 сек видна, потом 1 сек fadeout
    const hint = document.getElementById('fullscreen-hint');
    if (hint) {
        setTimeout(() => hint.classList.add('fade-out'), 3000);
        setTimeout(() => hint.remove(), 4000);
    }
    // Кнопка "Вернуться в игру" если вылетел из активной игры
    const gameReconnectRaw = sessionStorage.getItem('gameReconnect');
    if (gameReconnectRaw) {
        try {
            const { lobbyId, nickname } = JSON.parse(gameReconnectRaw);
            if (lobbyId && nickname) {
                const btn = document.getElementById('btnRejoinGame');
                if (btn) {
                    btn.style.display = 'block';
                    btn.onclick = () => {
                        sessionStorage.removeItem('gameReconnect');
                        session.myNickname = nickname;
                        rejoinLobby(lobbyId);
                    };
                }
            }
        } catch (_e) {
            sessionStorage.removeItem('gameReconnect');
        }
    }
    // Авто-реджойн хоста в лобби после F5
    const reconnectRaw = sessionStorage.getItem('lobbyReconnect');
    if (reconnectRaw) {
        try {
            const { lobbyId, nickname } = JSON.parse(reconnectRaw);
            if (lobbyId && nickname) {
                sessionStorage.removeItem('lobbyReconnect');
                session.myNickname = nickname;
                setTimeout(() => sendGameMessage({
                    type: ClientMsg.REJOIN_LOBBY,
                    lobbyId,
                    nickname,
                }), 400);
            }
        } catch (_e) {
            sessionStorage.removeItem('lobbyReconnect');
        }
    }
});
const SKIN_NAMES = {
    light: [
        { id: '1', label: 'Стандартный' }, { id: '2', label: 'Песок' }, { id: '3', label: 'Полиция' },
        { id: '4', label: 'Зима' }, { id: '5', label: 'Городской' }, { id: '6', label: 'Тигр' },
        { id: '7', label: 'Серый' }, { id: '8', label: 'Молния' }, { id: '9', label: 'Пустыня' },
        { id: '10', label: 'Лес' },
    ],
    medium: [
        { id: '1', label: 'Стандартный' }, { id: '2', label: 'Болото' }, { id: '3', label: 'Охотник' },
        { id: '4', label: 'Лес' }, { id: '5', label: 'Пустыня' }, { id: '6', label: 'Пепел' },
        { id: '7', label: 'Городской' }, { id: '8', label: 'Тигриный' }, { id: '9', label: 'Аниме' },
        { id: '10', label: 'Старый' },
    ],
    heavy: [
        { id: '1', label: 'Стандартный' }, { id: '2', label: 'Зима' }, { id: '3', label: 'Лес' },
        { id: '4', label: 'Городской' }, { id: '5', label: 'Песок' }, { id: '6', label: 'Пустыня' },
        { id: '7', label: 'Серый' }, { id: '8', label: 'Инферно' },
    ],
};

function initSkinSelector() {
    const tt = session.myTankType || 'medium';
    const skins = SKIN_NAMES[tt] || SKIN_NAMES.medium;
    buildCustomDropdown('skinSelect', skins.map((s) => ({ value: s.id, label: s.label })),
        session.myCamo || '1', (val) => {
            session.myCamo = val;
            if (isGameSocketOpen() && session.currentLobbyId) {
                sendGameMessage({ type: ClientMsg.UPDATE_PLAYER, camo: session.myCamo, tankType: session.myTankType });
            }
            drawTankPreview();
        }, (val) => {
            // При наведении — превью скина
            _skinPreviewOverride = val;
            drawTankPreview();
        }, () => {
            // При уходе — сброс превью
            _skinPreviewOverride = null;
            drawTankPreview();
        });

    // Кастомный dropdown для типа танка
    buildCustomDropdown('tankTypeSelect', [
        { value: 'light', label: 'Лёгкий' },
        { value: 'medium', label: 'Средний' },
        { value: 'heavy', label: 'Тяжёлый' },
    ], session.myTankType || 'medium', (val) => {
        session.myTankType = val;
        battle.tankDef = getTankDef(session.myTankType);
        // Сброс скина на стандартный при смене типа
        session.myCamo = '1';
        if (isGameSocketOpen() && session.currentLobbyId) {
            sendGameMessage({ type: ClientMsg.UPDATE_PLAYER, camo: session.myCamo, tankType: session.myTankType });
        }
        initSkinSelector(); // Пересоздать список скинов для нового типа
    });

    drawTankPreview();
}
let _skinPreviewOverride = null;

function buildCustomDropdown(containerId, options, currentValue, onChange, onHover, onLeave) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    const sel = document.createElement('div');
    sel.className = 'dd-selected';
    const currentOpt = options.find((o) => o.value === currentValue) || options[0];
    sel.textContent = currentOpt.label;
    container.appendChild(sel);

    const list = document.createElement('div');
    list.className = 'dd-list';
    if (onLeave) list.addEventListener('mouseleave', onLeave);
    options.forEach((opt) => {
        const item = document.createElement('div');
        item.className = 'dd-item';
        if (opt.value === currentValue) item.classList.add('active');
        item.textContent = opt.label;
        item.addEventListener('mouseenter', () => {
            playUISound(assets.sounds.click1, 0.4);
            if (onHover) onHover(opt.value);
        }, { passive: true });
        item.onclick = (e) => {
            e.stopPropagation();
            playUISound(assets.sounds.click2, 0.6);
            sel.textContent = opt.label;
            list.querySelectorAll('.dd-item').forEach((i) => i.classList.remove('active'));
            item.classList.add('active');
            list.style.display = 'none';
            onChange(opt.value);
        };
        list.appendChild(item);
    });
    container.appendChild(list);
    sel.onclick = (e) => {
        e.stopPropagation();
        playUISound(assets.sounds.click2, 0.6);
        // Закрыть все другие открытые dropdown
        document.querySelectorAll('.dd-list').forEach((l) => { if (l !== list) l.style.display = 'none'; });
        list.style.display = list.style.display === 'block' ? 'none' : 'block';
    };
    document.addEventListener('click', () => { list.style.display = 'none'; });
}

function drawTankPreview() {
    const canvas = document.getElementById('tankPreview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const previewSkin = _skinPreviewOverride || session.myCamo || '1';
    const skin = getTankSkin(session.myColor, previewSkin, session.myTankType || 'medium');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const ttype = session.myTankType || 'medium';
    // Смещение башни вдоль корпуса (танк смотрит вправо → angle=0 → cos=1)
    const turretOff = ttype === 'light' ? 1 : ttype === 'heavy' ? 17 : 4;

    if (skin) {
        // Корпус
        ctx.drawImage(skin.base, cx - 5 - skin.base.width / 2, cy - skin.base.height / 2);
        // Башня
        ctx.drawImage(skin.turret, cx - 5 + turretOff - skin.turret.width / 2, cy - skin.turret.height / 2);
    } else {
        // Fallback — простой прямоугольник
        ctx.fillStyle = session.myColor;
        ctx.fillRect(cx - 5 - 37, cy - 22, 75, 45);
        ctx.fillStyle = shadeColor(session.myColor, -20);
        ctx.fillRect(cx - 5 + turretOff + 10, cy - 3, 22, 6);
        ctx.beginPath();
        ctx.arc(cx - 5 + turretOff, cy, 10, 0, Math.PI * 2);
        ctx.fill();
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
                camo: session.myCamo || 'none',
                tankType: document.getElementById('tankTypeSelect')?.value || 'medium',
                mapSize: document.getElementById('mapSizeSelect')?.value || 'small',
                scoreLimit: parseInt(document.getElementById('scoreLimitSelect')?.value || '5', 10),
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
                camo: session.myCamo || 'none',
                tankType: document.getElementById('tankTypeSelect')?.value || 'medium',
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
                camo: session.myCamo || 'none',
                tankType: document.getElementById('tankTypeSelect')?.value || 'medium',
            }),
        300,
    );
}
function rejoinLobby(id) {
    const nick = getNickname();
    session.myNickname = nick;
    connect();
    setTimeout(
        () =>
            sendGameMessage({
                type: ClientMsg.REJOIN_LOBBY,
                lobbyId: id,
                nickname: nick,
            }),
        300,
    );
}
function showLobby(id, name, isHost) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('lobby-wrapper').style.display = 'flex';
    document.getElementById('roomCodeDisplay').innerText = id;
    document.getElementById('lobbyNameDisplay').innerText = name || 'Лобби';
    document.getElementById('btnStart').style.display = isHost ? 'inline-block' : 'none';
    document.getElementById('btnAddBot').style.display = isHost ? 'inline-block' : 'none';
    document.getElementById('btnRemoveBot').style.display = isHost ? 'inline-block' : 'none';
    document.getElementById('mapSizeSelector').style.display = isHost ? 'block' : 'none';
    document.getElementById('scoreLimitSelector').style.display = isHost ? 'block' : 'none';
    document.getElementById('lobbyNickInput').value = session.myNickname;
    document.getElementById('lobbyNickInput').oninput = (e) => {
        session.myNickname = sanitize(e.target.value, 24);
        if (isGameSocketOpen()) {
            sendGameMessage({ type: ClientMsg.UPDATE_PLAYER, nickname: session.myNickname });
        }
    };
    // Хост меняет scoreLimit — отправляем на сервер
    const scoreLimitEl = document.getElementById('scoreLimitSelect');
    if (isHost && scoreLimitEl) {
        scoreLimitEl.onchange = () => {
            if (isGameSocketOpen()) {
                sendGameMessage({ type: ClientMsg.UPDATE_PLAYER, scoreLimit: parseInt(scoreLimitEl.value, 10) });
            }
        };
    }
    initSkinSelector();
}
function escapeLobbyIdAttr(id) {
    return String(id).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function updateLobbyListUI(lobbies) {
    const list = document.getElementById('lobbyList');
    // Не показываем лобби которые уже в игре
    const available = lobbies.filter((l) => !l.inGame);
    if (available.length === 0) {
        list.innerHTML = '<div style="color:#666;font-style:italic">Нет активных лобби</div>';
        return;
    }
    list.innerHTML = available
        .map(
            (l) => `<div class="lobby-item"><span class="lobby-name">${l.name}</span><span class="lobby-players">${l.players}/${l.max}</span><button type="button" class="join-btn" data-lobby-id="${escapeLobbyIdAttr(l.id)}">▶</button></div>`,
        )
        .join('');
}
function updateLobbyPlayers(players) {
    const t1 = document.getElementById('team1-list'),
        t2 = document.getElementById('team2-list');
    t1.innerHTML = '';
    t2.innerHTML = '';

    // Drop-зоны для drag-and-drop (хост перетаскивает игроков)
    const setupDropZone = (container, team) => {
        container.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
        container.ondragenter = () => container.classList.add('drag-over');
        container.ondragleave = (e) => { if (!container.contains(e.relatedTarget)) container.classList.remove('drag-over'); };
        container.ondrop = (e) => {
            e.preventDefault();
            container.classList.remove('drag-over');
            const targetId = e.dataTransfer.getData('text/plain');
            if (targetId) sendGameMessage({ type: ClientMsg.CHANGE_TEAM, team, targetId });
        };
    };
    setupDropZone(t1, 1);
    setupDropZone(t2, 2);

    players.forEach((p) => {
        const div = document.createElement('div');
        div.className = 'player-slot team' + p.team;
        const readyIcon = p.isBot ? '' : `<span class="ready-icon">${p.ready ? '✅' : '❌'}</span>`;
        const diffLabel = p.isBot ? ({ 1: '🟢', 2: '🟡', 3: '🔴' }[p.botDifficulty] || '🟡') : '';
        div.innerHTML = `${readyIcon}<strong>${p.nick}</strong>${p.isHost ? ' 👑' : ''}${p.isBot ? ' 🤖' + diffLabel : ''}`;
        // Хост может перетаскивать любого игрока
        if (session.isHost) {
            div.draggable = true;
            div.style.cursor = 'grab';
            div.ondragstart = (e) => {
                e.dataTransfer.setData('text/plain', p.id);
                e.dataTransfer.effectAllowed = 'move';
            };
        }
        (p.team === 1 ? t1 : t2).appendChild(div);
        session.playerData[p.id] = { nick: p.nick, team: p.team, color: p.color, camo: p.camo || 'none', isBot: Boolean(p.isBot) };
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
    sendGameMessage({ type: ClientMsg.START_GAME, mapSize: document.getElementById('mapSizeSelect')?.value || 'small' });
}

function sendChatMessage() {
    const input = document.getElementById('lobby-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    sendGameMessage({ type: ClientMsg.LOBBY_CHAT, text });
    input.value = '';
}

function addBot(difficulty = 2) {
    sendGameMessage({ type: ClientMsg.ADD_BOT, difficulty });
}

function removeBot() {
    sendGameMessage({ type: ClientMsg.REMOVE_BOT });
}

function startGameClient() {
    boostPanelRenderSig = '';
    document.getElementById('menu').style.display = 'none';
    document.getElementById('lobby-wrapper').style.display = 'none';
    const chatLog = document.getElementById('lobby-chat-log');
    if (chatLog) chatLog.innerHTML = '';
    document.getElementById('ui-game').style.display = 'block';
    document.getElementById('score-board').style.display = 'block';
    // volume-control убран — теперь в ESC меню
    document.getElementById('boost-panel').style.display = 'flex';
    document.getElementById('victory-screen').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    resize();
    document.body.style.cursor = `url('${cursorUrl}') 15 20, crosshair`;
    session.gameStarted = true;
    lastTime = performance.now();
    fpsSmoothed = 0;
    const fpsVal = document.getElementById('fps-value');
    if (fpsVal) fpsVal.textContent = '—';
    updateUI();
    playSound_StartMusic();
    spawnMyTank();
    requestAnimationFrame(loop);
}

function resetMatch() {
    boostPanelRenderSig = '';
    battle.myScore = 0;
    battle.enemyScore = 0;
    updateUI();
    document.getElementById('victory-screen').style.display = 'none';
    document.getElementById('death-screen').style.display = 'none';
    const endOverlay = document.getElementById('endgame-overlay');
    if (endOverlay) endOverlay.style.display = 'none';
    const canvasEl = document.getElementById('gameCanvas');
    if (canvasEl) canvasEl.classList.remove('endgame-filter');
    tracks.length = 0;
    resetTrackCanvas();
    particles.length = 0;
    boosts.length = 0;
    smokes.length = 0;
    mines.length = 0;
    rockets.length = 0;
    explosions.length = 0;
    hulls.length = 0;
    explosionMarks.length = 0;
    const def = battle.tankDef;
    tank.hp = def.hp;
    tank.maxHp = def.hp;
    tank.isDead = false;
    tank.damageBoostTimer = 0;
    tank.speedBoostTimer = 0;
    tank.vx = 0;
    tank.vy = 0;
    tank.collisionTimer = 0;
    tank.smokeCount = def.startInventory.smokeCount;
    tank.mineCount = def.startInventory.mineCount;
    tank.rocketCount = def.startInventory.rocketCount;
    tank.healCount = def.startInventory.healCount;
    tank.healCooldown = 0;
    for (const id in enemyTanks) {
        delete enemyTanks[id];
    }
    session.gameStarted = true;
    playSound_StartMusic();
    updateInventoryUI();
    setTimeout(spawnMyTank, 500);
}

function spawnMyTank() {
    const def = battle.tankDef;
    boostPanelRenderSig = '';
    bullets.length = 0;
    tank.hp = def.hp;
    tank.maxHp = def.hp;
    tank.isDead = false;
    tank.reload = 0;
    tank.vx = 0;
    tank.vy = 0;
    tank.w = def.w;
    tank.h = def.h;
    tank.tankType = def.type;
    tank.damageBoostTimer = 0;
    tank.speedBoostTimer = 0;
    tank.collisionTimer = 0;
    tank.smokeCount = def.startInventory.smokeCount;
    tank.mineCount = def.startInventory.mineCount;
    tank.rocketCount = def.startInventory.rocketCount;
    tank.healCount = def.startInventory.healCount;
    tank.healCooldown = 0;
    tank.spawnImmunityTimer = SPAWN_IMMUNITY_TIME;
    document.getElementById('death-screen').style.display = 'none';
    updateInventoryUI();
    tank.color = session.myColor;
    tank.camo = session.myCamo || '1';
    tank.turretColor = shadeColor(session.myColor, -20);
    tank.trackColor = shadeColor(session.myColor, -40);
    const SPAWN_BOX = 400;
    const CELL = 100;
    const SPAWN_ORDER = [
        { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 1 }, { row: 1, col: 3 },
        { row: 0, col: 2 }, { row: 3, col: 3 }, { row: 2, col: 0 }, { row: 0, col: 0 },
        { row: 1, col: 2 }, { row: 2, col: 3 }, { row: 3, col: 2 }, { row: 0, col: 1 },
        { row: 2, col: 1 }, { row: 1, col: 0 }, { row: 3, col: 0 }, { row: 0, col: 3 },
    ];
    const slot = session.spawnSlot % SPAWN_ORDER.length;
    const cell = SPAWN_ORDER[slot];
    const cx = cell.col * CELL + CELL / 2;
    const cy = cell.row * CELL + CELL / 2;
    let sx, sy;
    if (session.myTeam === 1) {
        sx = cx;
        sy = cy;
        tank.angle = 0;
    } else {
        sx = level.mapWidth - SPAWN_BOX + cx;
        sy = level.mapHeight - SPAWN_BOX + cy;
        tank.angle = Math.PI;
    }
    const valid = findSpawnSpot(sx, sy, tank, bricks, level.mapWidth, level.mapHeight, world.stones);
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
    const sig = `${tank.healCount}|${tank.smokeCount}|${tank.mineCount}|${tank.rocketCount}|${Math.ceil(tank.damageBoostTimer)}|${Math.ceil(tank.speedBoostTimer)}`;
    if (sig === boostPanelRenderSig) return;
    boostPanelRenderSig = sig;
    const img = assets.images;
    // Инвентарь — слева снизу
    let inv = '';
    inv += `<div class="boost-indicator"><img class="boost-icon" src="${img.repairBoxInv.src}">Ремонт (R): ${tank.healCount}</div>`;
    inv += `<div class="boost-indicator"><img class="boost-icon" src="${img.smokeBoxInv.src}">Дым (Q): ${tank.smokeCount}</div>`;
    inv += `<div class="boost-indicator"><img class="boost-icon" src="${img.mine.src}">Мина (E): ${tank.mineCount}</div>`;
    inv += `<div class="boost-indicator"><img class="boost-icon" src="${img.rocketBoxInv.src}">Ракета (F): ${tank.rocketCount}</div>`;
    document.getElementById('boost-panel').innerHTML = inv;
    // Активные бусты — по центру снизу
    let boosts = '';
    if (tank.speedBoostTimer > 0)
        boosts += `<div class="boost-indicator"><img class="boost-icon" src="${img.speedBoost.src}">Скорость: ${Math.ceil(tank.speedBoostTimer)}с</div>`;
    if (tank.damageBoostTimer > 0)
        boosts += `<div class="boost-indicator"><img class="boost-icon" src="${img.atackSpeed.src}">Скорострельность: ${Math.ceil(tank.damageBoostTimer)}с</div>`;
    const activePanel = document.getElementById('boost-active-panel');
    activePanel.innerHTML = boosts;
    activePanel.style.display = boosts ? 'flex' : 'none';
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
    // Вычисляем камеру ДО simulation чтобы прицел совпадал с курсором
    const sf = scaleFactor * zoomLevel;
    const mdx = (gameKeys['MouseX'] || width / 2) - width / 2;
    const mdy = (gameKeys['MouseY'] || height / 2) - height / 2;
    const rawCX = tank.x + (mdx / sf) * 0.5;
    const rawCY = tank.y + (mdy / sf) * 0.5;
    const cc = clampCamera(rawCX, rawCY, width, height, sf, level.mapWidth, level.mapHeight);
    camX = cc.x;
    camY = cc.y;

    runSimulation(dt, {
        send: sendGameMessage,
        keys: gameKeys,
        width,
        height,
        scaleFactor: sf,
        camX,
        camY,
        updateInventoryUI,
    });
    const cam = drawGameFrame(ctx, {
        width,
        height,
        scaleFactor: scaleFactor * zoomLevel,
        keys: gameKeys,
        tank,
        enemyTanks,
        session,
        level,
        bricks,
        forests,
        stones,
        boosts,
        tracks,
        particles,
        mines,
        bullets,
        smokes,
        explosions,
        rockets,
        hulls,
        explosionMarks,
        cachedPatterns,
        bricksDrawRevision: world.bricksDrawRevision,
        dt,
        frameTimeMs: ts,
        onRocketSmoke: (rx, ry) => spawnParticles(rx, ry, '#888', 1, 'smoke'),
    });
    camX = cam.camX;
    camY = cam.camY;
    updateTabScoreboard();
    requestAnimationFrame(loop);
}

const TANK_DISPLAY_NAMES = { light: 'Т-62', medium: 'Т-34-85', heavy: 'ИС-3' };

function updateTabScoreboard() {
    const overlay = document.getElementById('tab-scoreboard');
    if (!overlay) return;
    const show = session.gameStarted && !session.roundOver && gameKeys['Tab'];
    overlay.style.display = show ? 'flex' : 'none';
    if (!show) return;
    const tbody = document.getElementById('tab-score-tbody');
    if (!tbody) return;
    const stats = battle.liveStats || [];
    const sorted = [...stats].sort((a, b) => a.team - b.team || b.kills - a.kills);
    tbody.innerHTML = '';
    sorted.forEach((s) => {
        const tr = document.createElement('tr');
        tr.className = s.team === 1 ? 'team1-row' : 'team2-row';
        const tankName = TANK_DISPLAY_NAMES[s.tankType] || s.tankType || '?';
        tr.innerHTML = `<td>${s.nick}</td><td>${tankName}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.damageDealt}</td><td>${s.damageReceived}</td>`;
        tbody.appendChild(tr);
    });
}

function updateUI() {
    document.getElementById('score-me').innerText = battle.myScore;
    document.getElementById('score-enemy').innerText = battle.enemyScore;
    const limitEl = document.getElementById('score-limit');
    if (limitEl) limitEl.innerText = `/ ${battle.scoreLimit}`;
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
    spawnMuzzleFlash,
    createBulletHitEffect,
    createExplosion,
    createTankExplosion,
    createSmokeCloud,
    addTrack,
});
configureServerMessages({ send: sendGameMessage });

export { addBot, createLobby, joinLobby, joinLobbyByCode, rejoinLobby, removeBot, sendChatMessage, setTeam, startGame, toggleReady };

