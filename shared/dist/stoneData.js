/**
 * Данные хитбоксов камней (общие для клиента и сервера).
 * dx, dy — смещение от центра спрайта; r — радиус.
 */
export const STONE_HITBOXES = {
    1: [{ dx: 3, dy: 25, r: 49.5 }, { dx: -7, dy: -37, r: 36.5 }],
    2: [{ dx: 0, dy: 0, r: 73.5 }],
    3: [{ dx: 0, dy: 0, r: 73.5 }],
    4: [{ dx: -27, dy: 8, r: 47 }, { dx: 17, dy: 1, r: 57 }],
    5: [{ dx: -32, dy: 0, r: 42.5 }, { dx: 40, dy: 7, r: 34.5 }],
};
export const STONE_SPRITE_SIZE = 150;
export const STONE_TYPE_COUNT = 5;
/**
 * Возвращает мировые координаты хитбокс-кругов камня с учётом поворота.
 */
export function getStoneWorldCircles(stone) {
    const circles = STONE_HITBOXES[stone.type];
    if (!circles)
        return [];
    const cos = Math.cos(stone.angle);
    const sin = Math.sin(stone.angle);
    const s = stone.scale ?? 1;
    return circles.map((c) => ({
        cx: stone.x + (c.dx * cos - c.dy * sin) * s,
        cy: stone.y + (c.dx * sin + c.dy * cos) * s,
        r: c.r * s,
    }));
}
//# sourceMappingURL=stoneData.js.map