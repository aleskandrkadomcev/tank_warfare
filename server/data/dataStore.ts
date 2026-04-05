/**
 * Простое JSON хранилище для фидбека и статистики матчей.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(import.meta.dirname || '.', '..', 'data');

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function appendJson(filename: string, entry: object): void {
    ensureDir();
    const filePath = path.join(DATA_DIR, filename);
    let arr: object[] = [];
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        arr = JSON.parse(raw);
    } catch (_) { /* файл не существует или пустой */ }
    arr.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf-8');
}

export function saveFeedback(nick: string, text: string): void {
    appendJson('feedback.json', {
        nick,
        text,
        date: new Date().toISOString(),
    });
}

export type MatchPlayerStats = {
    id: string;
    nick: string;
    team: number;
    tankType: string;
    isBot: boolean;
    kills: number;
    deaths: number;
    damageDealt: number;
    damageReceived: number;
    avgFps?: number;
};

export function saveMatchStats(data: {
    date: string;
    durationSec: number;
    mapSize: string;
    scoreLimit: number;
    winner: number;
    scores: Record<number, number>;
    players: MatchPlayerStats[];
}): void {
    appendJson('matches.json', data);
}
