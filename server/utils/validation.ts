import { VALID_TANK_COLORS } from '../constants.js';

export function sanitizeNick(n: unknown): string {
    return (typeof n === 'string' ? n : 'Игрок').substring(0, 12).replace(/[^a-zA-Z0-9_а-яА-ЯёЁ]/g, '') || 'Игрок';
}

export function sanitizeLobbyName(n: unknown): string {
    return (typeof n === 'string' ? n : 'Лобби').substring(0, 30).replace(/[<>]/g, '') || 'Лобби';
}

export function isValidColor(c: string): boolean {
    return (VALID_TANK_COLORS as readonly string[]).includes(c);
}
