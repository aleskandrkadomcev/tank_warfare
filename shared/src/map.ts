/** Размеры мира и общие лимиты матча (сервер + клиент). */

export const BRICK_SIZE = 80;
export const MAP_WIDTH = 3200;
export const MAP_HEIGHT = 1800;
export const MAX_SCORE = 5;
/** Допустимые значения лимита очков для лобби. */
export const SCORE_LIMITS = [3, 5, 10, 15, 20] as const;
export const MAX_PLAYERS = 10;
