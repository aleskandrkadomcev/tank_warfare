import type { WebSocket } from 'ws';
import type { BotPathGrid } from '../game/pathfinding.js';

export type BrickPos = { x: number; y: number };
export type ForestPos = { x: number; y: number };

export type MapData = {
    bricks: BrickPos[];
    forests: ForestPos[];
    biome: number;
    w: number;
    h: number;
};

export type LobbyBoost = { x: number; y: number; type: number; id: string };

export type LobbyRocket = {
    id: string;
    tx: number;
    ty: number;
    ownerId: string;
    ownerTeam: number;
    startTime: number;
    exploded: boolean;
};

export type LobbyMine = {
    mineId: string | number;
    x: number;
    y: number;
    owner: string;
    ownerTeam: number;
    triggered: boolean;
};

export type LobbySmokeCloud = {
    x: number;
    y: number;
    /** Когда облако исчезает (Date.now()). */
    expiresAt: number;
};

export type LobbyBotBullet = {
    bulletId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
    ownerTeam: number;
    damage: number;
    createdAt: number;
    ttl: number;
};

export type LobbyHull = {
    id: string;
    x: number;
    y: number;
    angle: number;
    w: number;
    h: number;
};

export type Lobby = {
    hostId: string;
    name: string;
    players: WebSocket[];
    scores: Record<number, number>;
    mines: LobbyMine[];
    boosts: LobbyBoost[];
    rockets: LobbyRocket[];
    aiBullets: LobbyBotBullet[];
    aiGrid: BotPathGrid | null;
    gameStarted: boolean;
    mapData: MapData | null;
    aiTickHandle: ReturnType<typeof setInterval> | null;
    mapSize?: string;
    /** Сколько очков для победы (по умолчанию MAX_SCORE). */
    scoreLimit: number;
    /** Остовы мёртвых танков — блокируют проезд и пули. */
    hulls: LobbyHull[];
    /** Активные облака дыма (серверная копия для обнаружения). */
    smokes: LobbySmokeCloud[];
    /**
     * Память обнаружения:
     * ключ `${team}:${targetId}` -> timestamp (ms), до которого враг остаётся видим.
     */
    detectionVisibleUntil: Record<string, number>;
};

export const lobbies: Record<string, Lobby> = {};
