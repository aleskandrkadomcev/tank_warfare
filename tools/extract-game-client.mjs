import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'archive', 'legacy-monolith', 'index.html');
const outPath = path.join(root, 'client', 'src', 'game', 'gameClient.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('<script>') + '<script>'.length;
const end = html.indexOf('</script>', start);
let body = html.slice(start, end).trim();

// Drop canvas init (stays at top of output)
body = body.replace(
  /^const canvas = document\.getElementById\('gameCanvas'\);\s*const ctx = canvas\.getContext\('2d'\);\s*/m,
  '',
);

// Drop server constants
body = body.replace(/^const SERVER_IP =[^\n]+\nconst SERVER_PORT =[^\n]+\n/m, '');

// Drop game constants + TANK_COLORS block (imported)
body = body.replace(
  /^const BRICK_SIZE[\s\S]*?^const TANK_COLORS = \[[^\]]+\];\s*/m,
  '',
);

// Drop assets block through sound loaders
body = body.replace(
  /^const assets = \{[\s\S]*?^Object\.values\(assets\.sounds\)\.forEach\(audio => \{[\s\S]*?^\}\);\s*/m,
  '',
);

// Drop initAudio, updateVolume, volume listener, playSound*, noise, tone, TankEngine class
body = body.replace(
  /^function initAudio\(\) \{[\s\S]*?^document\.getElementById\('volumeSlider'\)\.addEventListener\('input', updateVolume\);\s*/m,
  '',
);
body = body.replace(/^function playSound_Shot[\s\S]*?^}\s*\n\nclass TankEngine \{[\s\S]*?^}\s*\n/m, '');

const header = `/**
 * Игровой клиент (логика перенесена из монолитного index.html).
 * Дальнейшее дробление: network/messages, game/simulation, render/pipeline.
 */
import {
  BRICK_SIZE,
  MAX_SCORE,
  TRACK_LIFETIME,
  MAP_WIDTH,
  MAP_HEIGHT,
  VIRTUAL_HEIGHT,
  MAX_SPEED_FORWARD,
  MAX_SPEED_REVERSE,
  ACCEL_FORWARD,
  ACCEL_REVERSE,
  BRAKE_POWER,
  NATURAL_DRAG,
  TURN_SPEED,
  GRIP,
  BASE_RELOAD_TIME,
  BOOST_RELOAD_TIME,
  BULLET_DAMAGE_BASE,
  BULLET_DAMAGE_BOOST,
  COLLISION_DAMAGE,
  TURRET_ROTATION_SPEED,
  MINE_DAMAGE,
  MINE_RADIUS,
  ROCKET_DAMAGE,
  ROCKET_RADIUS,
  ROCKET_FLIGHT_TIME,
  TANK_MAX_HP,
  BOOST_DURATION,
  BOOST_SPEED_DURATION,
  SPAWN_IMMUNITY_TIME,
  TANK_COLORS,
} from '../config/constants.js';
import { assets } from '../lib/assets.js';
import {
  initAudio,
  updateVolume,
  playSound_Shot,
  playSound_Hit,
  playSound_Explosion,
  playSound_BrickHit,
  playSound_Heal,
  playSound_Speed,
  playSound_Damage,
  playSound_Smoke,
  playBombBeep,
  playAlert,
  playRocketFlyBy,
  playSound_Victory,
  playSound_StartMusic,
  TankEngine,
} from '../lib/audio.js';
import { getWebSocketUrl } from '../config/env.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

`;

body = body.replace(
  /ws = new WebSocket\(`ws:\/\/\$\{SERVER_IP\}:\$\{SERVER_PORT\}`\)/,
  'ws = new WebSocket(getWebSocketUrl())',
);

const footer = `
document.getElementById('volumeSlider')?.addEventListener('input', updateVolume);
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, header + body.trim() + '\n' + footer.trim() + '\n', 'utf8');
console.log('Wrote', outPath);
