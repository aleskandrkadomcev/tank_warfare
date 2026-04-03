import { describe, expect, it } from 'vitest';
import { isValidColor, sanitizeLobbyName, sanitizeNick } from './validation.js';

describe('sanitizeNick', () => {
    it('обрезает длину и убирает недопустимые символы', () => {
        expect(sanitizeNick('abc!@#def')).toBe('abcdef');
        expect(sanitizeNick('ОченьДлинныйНикнеймДляТеста')).toBe('ОченьДлинныйНикнеймДляТест');
    });

    it('для не-строки возвращает дефолт', () => {
        expect(sanitizeNick(null)).toBe('Игрок');
        expect(sanitizeNick(undefined)).toBe('Игрок');
        expect(sanitizeNick(42)).toBe('Игрок');
    });

    it('пустой результат после очистки → Игрок', () => {
        expect(sanitizeNick('!!!')).toBe('Игрок');
    });
});

describe('sanitizeLobbyName', () => {
    it('убирает < и >', () => {
        expect(sanitizeLobbyName('a<b>')).toBe('ab');
    });

    it('обрезает до 30 символов', () => {
        const long = 'x'.repeat(40);
        expect(sanitizeLobbyName(long).length).toBe(30);
    });
});

describe('isValidColor', () => {
    it('принимает только цвета из палитры shared', () => {
        expect(isValidColor('#4CAF50')).toBe(true);
        expect(isValidColor('#deadbeef')).toBe(false);
    });
});
