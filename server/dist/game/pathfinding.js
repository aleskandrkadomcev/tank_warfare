import { BRICK_SIZE } from '#shared/map.js';
const DEFAULT_CELL_SIZE = BRICK_SIZE / 2;
function indexOf(grid, col, row) {
    return row * grid.cols + col;
}
export function buildBotPathGrid(map, cellSize = DEFAULT_CELL_SIZE) {
    const cols = Math.ceil(map.w / cellSize);
    const rows = Math.ceil(map.h / cellSize);
    const blocked = new Uint8Array(cols * rows);
    for (const brick of map.bricks) {
        const startCol = Math.max(0, Math.floor(brick.x / cellSize));
        const endCol = Math.min(cols - 1, Math.floor((brick.x + BRICK_SIZE - 1) / cellSize));
        const startRow = Math.max(0, Math.floor(brick.y / cellSize));
        const endRow = Math.min(rows - 1, Math.floor((brick.y + BRICK_SIZE - 1) / cellSize));
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                blocked[indexOf({ cellSize, cols, rows, blocked }, col, row)] = 1;
            }
        }
    }
    return { cellSize, cols, rows, blocked };
}
export function worldToCell(x, y, grid) {
    return {
        col: Math.max(0, Math.min(grid.cols - 1, Math.floor(x / grid.cellSize))),
        row: Math.max(0, Math.min(grid.rows - 1, Math.floor(y / grid.cellSize))),
    };
}
export function cellToWorld(cell, grid) {
    return {
        x: cell.col * grid.cellSize + grid.cellSize / 2,
        y: cell.row * grid.cellSize + grid.cellSize / 2,
    };
}
export function isCellBlocked(grid, col, row) {
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows)
        return true;
    return grid.blocked[indexOf(grid, col, row)] === 1;
}
function cellKey(cell) {
    return `${cell.col}:${cell.row}`;
}
function heuristic(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}
function findNearestFreeCell(grid, start) {
    if (!isCellBlocked(grid, start.col, start.row))
        return start;
    const queue = [start];
    const seen = new Set([cellKey(start)]);
    while (queue.length > 0) {
        const cell = queue.shift();
        const neighbors = [
            { col: cell.col + 1, row: cell.row },
            { col: cell.col - 1, row: cell.row },
            { col: cell.col, row: cell.row + 1 },
            { col: cell.col, row: cell.row - 1 },
        ];
        for (const next of neighbors) {
            if (next.col < 0 || next.row < 0 || next.col >= grid.cols || next.row >= grid.rows)
                continue;
            const key = cellKey(next);
            if (seen.has(key))
                continue;
            if (!isCellBlocked(grid, next.col, next.row))
                return next;
            seen.add(key);
            queue.push(next);
        }
    }
    return null;
}
export function findBotPath(grid, startPoint, goalPoint) {
    const startCell = findNearestFreeCell(grid, worldToCell(startPoint.x, startPoint.y, grid));
    const goalCell = findNearestFreeCell(grid, worldToCell(goalPoint.x, goalPoint.y, grid));
    if (!startCell || !goalCell)
        return [];
    if (startCell.col === goalCell.col && startCell.row === goalCell.row) {
        return [cellToWorld(goalCell, grid)];
    }
    const open = [startCell];
    const cameFrom = new Map();
    const gScore = new Map([[cellKey(startCell), 0]]);
    const fScore = new Map([[cellKey(startCell), heuristic(startCell, goalCell)]]);
    const closed = new Set();
    while (open.length > 0) {
        let currentIndex = 0;
        let currentScore = fScore.get(cellKey(open[0])) ?? Infinity;
        for (let i = 1; i < open.length; i++) {
            const score = fScore.get(cellKey(open[i])) ?? Infinity;
            if (score < currentScore) {
                currentScore = score;
                currentIndex = i;
            }
        }
        const current = open.splice(currentIndex, 1)[0];
        const currentKey = cellKey(current);
        if (current.col === goalCell.col && current.row === goalCell.row) {
            const cells = [current];
            let cursor = cameFrom.get(currentKey);
            while (cursor) {
                cells.push(cursor);
                cursor = cameFrom.get(cellKey(cursor));
            }
            cells.reverse();
            return cells.map((cell) => cellToWorld(cell, grid));
        }
        closed.add(currentKey);
        const neighbors = [
            { col: current.col + 1, row: current.row },
            { col: current.col - 1, row: current.row },
            { col: current.col, row: current.row + 1 },
            { col: current.col, row: current.row - 1 },
        ];
        for (const neighbor of neighbors) {
            if (isCellBlocked(grid, neighbor.col, neighbor.row))
                continue;
            const neighborKey = cellKey(neighbor);
            if (closed.has(neighborKey))
                continue;
            const tentative = (gScore.get(currentKey) ?? Infinity) + 1;
            if (tentative < (gScore.get(neighborKey) ?? Infinity)) {
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentative);
                fScore.set(neighborKey, tentative + heuristic(neighbor, goalCell));
                if (!open.some((cell) => cell.col === neighbor.col && cell.row === neighbor.row)) {
                    open.push(neighbor);
                }
            }
        }
    }
    return [];
}
//# sourceMappingURL=pathfinding.js.map