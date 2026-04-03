/**
 * Клавиатура и указатель для боя (фаза 3.5); тач — отдельный модуль позже.
 */
import { zoomLevel, setZoomLevel } from '../game/gameState.js';

export const gameKeys = {};

/**
 * @param {HTMLCanvasElement} canvas
 */
export function attachGameInput(canvas) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
        gameKeys[e.code] = true;
        if (e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
        gameKeys[e.code] = false;
        if (e.code === 'Tab') e.preventDefault();
    });
    // Сброс всех клавиш при потере фокуса окна — иначе WASD залипают
    window.addEventListener('blur', () => {
        for (const key in gameKeys) {
            if (key !== 'MouseX' && key !== 'MouseY') gameKeys[key] = false;
        }
    });
    canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        gameKeys['MouseX'] = e.clientX - r.left;
        gameKeys['MouseY'] = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) gameKeys['MouseLeft'] = true;
    });
    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) gameKeys['MouseLeft'] = false;
    });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setZoomLevel(zoomLevel + delta);
    }, { passive: false });
}
