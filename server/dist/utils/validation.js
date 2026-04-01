import { VALID_TANK_COLORS } from '../constants.js';
export function sanitizeNick(n) {
    return (typeof n === 'string' ? n : 'Игрок').substring(0, 12).replace(/[^a-zA-Z0-9_а-яА-Я]/g, '') || 'Игрок';
}
export function sanitizeLobbyName(n) {
    return (typeof n === 'string' ? n : 'Лобби').substring(0, 30).replace(/[<>]/g, '') || 'Лобби';
}
export function isValidColor(c) {
    return VALID_TANK_COLORS.includes(c);
}
//# sourceMappingURL=validation.js.map