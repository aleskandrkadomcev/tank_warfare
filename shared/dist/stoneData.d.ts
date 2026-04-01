/**
 * Данные хитбоксов камней (общие для клиента и сервера).
 * dx, dy — смещение от центра спрайта; r — радиус.
 */
export declare const STONE_HITBOXES: Record<number, {
    dx: number;
    dy: number;
    r: number;
}[]>;
export declare const STONE_SPRITE_SIZE = 150;
export declare const STONE_TYPE_COUNT = 5;
export type StonePos = {
    x: number;
    y: number;
    type: number;
    angle: number;
    scale: number;
};
/**
 * Возвращает мировые координаты хитбокс-кругов камня с учётом поворота.
 */
export declare function getStoneWorldCircles(stone: StonePos): {
    cx: number;
    cy: number;
    r: number;
}[];
//# sourceMappingURL=stoneData.d.ts.map