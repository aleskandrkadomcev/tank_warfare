import { ServerMsg } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { MAX_PLAYERS } from '../constants.js';
import type { Lobby } from './lobbyStore.js';
import { lobbies } from './lobbyStore.js';

export function broadcastLobbyList(wss: WebSocketServer, excludeWs: WebSocket | null = null): void {
    const list = Object.values(lobbies).map((l) => ({
        id: Object.keys(lobbies).find((k) => lobbies[k] === l),
        name: l.name,
        players: l.players.length,
        max: MAX_PLAYERS,
        hostId: l.hostId,
        inGame: l.gameStarted,
    }));
    wss.clients.forEach((c) => {
        if (c !== excludeWs && c.readyState === 1 && !c.isInGame) {
            c.send(JSON.stringify({ type: ServerMsg.LOBBY_LIST, lobbies: list }));
        }
    });
}

export function sendLobbyList(ws: WebSocket): void {
    const list = Object.values(lobbies).map((l) => ({
        id: Object.keys(lobbies).find((k) => lobbies[k] === l),
        name: l.name,
        players: l.players.length,
        max: MAX_PLAYERS,
        inGame: l.gameStarted,
    }));
    ws.send(JSON.stringify({ type: ServerMsg.LOBBY_LIST, lobbies: list }));
}

export function broadcastLobbyState(lobby: Lobby): void {
    const state = {
        type: ServerMsg.LOBBY_STATE,
        players: lobby.players.map((p) => ({
            id: p.id,
            nick: p.nickname,
            team: p.team,
            ready: p.ready,
            color: p.color,
            camo: p.camo || 'none',
            isHost: p.id === lobby.hostId,
            isBot: Boolean(p.isBot),
        })),
        hostId: lobby.hostId,
        name: lobby.name,
        scoreLimit: lobby.scoreLimit,
        countdown: lobby.countdown > 0 ? lobby.countdown : undefined,
    };
    lobby.players.forEach((p) => {
        if (p.readyState === 1) p.send(JSON.stringify(state));
    });
}

export function broadcastGame(lobby: Lobby, data: object, excludeWs: WebSocket | null = null): void {
    const msg = JSON.stringify(data);
    lobby.players.forEach((p) => {
        if (p !== excludeWs && p.readyState === 1) p.send(msg);
    });
}

export function broadcastScores(lobby: Lobby): void {
    const playerStats = lobby.players.map((p) => ({
        id: p.id,
        nick: p.nickname || 'Bot',
        team: p.team,
        ...(lobby.stats[p.id!] || { kills: 0, deaths: 0, damageDealt: 0, damageReceived: 0 }),
    }));
    broadcastGame(lobby, { type: ServerMsg.SCORE_UPDATE, scores: lobby.scores, stats: playerStats });
}
