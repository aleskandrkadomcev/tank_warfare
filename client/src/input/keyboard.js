/**
 * Клавиатура и указатель для боя (фаза 3.5); тач — отдельный модуль позже.
 */
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
}
