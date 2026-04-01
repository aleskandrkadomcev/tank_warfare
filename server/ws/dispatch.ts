import { ClientMsg, type ClientMsgKey } from '#shared/protocol.js';
import type { WebSocket, WebSocketServer } from 'ws';
import { log } from '../logger.js';
import {
    handleBullet,
    handleBulletRemove,
    handleCollisionDamage,
    handleDealDamage,
} from './handlers/combat.js';
import { handleDeath, handleRestartMatch, handleState } from './handlers/gameState.js';
import {
    handleAddBot,
    handleChangeTeam,
    handleCreateLobby,
    handleJoinLobby,
    handleLobbyChat,
    handleRejoinLobby,
    handleRemoveBot,
    handleStartGame,
    handleToggleReady,
    handleUpdatePlayer,
} from './handlers/lobby.js';
import {
    handleBoostPickup,
    handleBricksDestroyBatch,
    handleDeployMine,
    handleDeploySmoke,
    handleLaunchRocket,
    handleUseHeal,
} from './handlers/world.js';

type DispatchFn = (wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>) => void;

const handlers: Partial<Record<string, DispatchFn>> = {
    [ClientMsg.CREATE_LOBBY]: handleCreateLobby,
    [ClientMsg.JOIN_LOBBY]: handleJoinLobby,
    [ClientMsg.UPDATE_PLAYER]: handleUpdatePlayer,
    [ClientMsg.CHANGE_TEAM]: handleChangeTeam,
    [ClientMsg.TOGGLE_READY]: handleToggleReady,
    [ClientMsg.START_GAME]: handleStartGame,
    [ClientMsg.BULLET]: handleBullet,
    [ClientMsg.BULLET_REMOVE]: handleBulletRemove,
    [ClientMsg.DEAL_DAMAGE]: handleDealDamage,
    [ClientMsg.STATE]: handleState,
    [ClientMsg.DEATH]: handleDeath,
    [ClientMsg.RESTART_MATCH]: handleRestartMatch,
    [ClientMsg.DEPLOY_MINE]: handleDeployMine,
    [ClientMsg.LAUNCH_ROCKET]: handleLaunchRocket,
    [ClientMsg.COLLISION_DAMAGE]: handleCollisionDamage,
    [ClientMsg.BOOST_PICKUP]: handleBoostPickup,
    [ClientMsg.BRICKS_DESTROY_BATCH]: handleBricksDestroyBatch,
    [ClientMsg.DEPLOY_SMOKE]: handleDeploySmoke,
    [ClientMsg.ADD_BOT]: handleAddBot,
    [ClientMsg.REMOVE_BOT]: handleRemoveBot,
    [ClientMsg.USE_HEAL]: handleUseHeal,
    [ClientMsg.REJOIN_LOBBY]: handleRejoinLobby,
    [ClientMsg.LOBBY_CHAT]: handleLobbyChat,
};

/** Проверка: на каждое значение `ClientMsg` назначен хендлер (юнит-тест + опционально dev-старт). */
export function assertDispatchRegistryComplete(): void {
    (Object.keys(ClientMsg) as ClientMsgKey[]).forEach((key) => {
        const type = ClientMsg[key];
        if (typeof handlers[type] !== 'function') {
            throw new Error(`WS dispatch: нет хендлера для ClientMsg.${String(key)} (${type})`);
        }
    });
}

export function dispatchClientMessage(wss: WebSocketServer, ws: WebSocket, data: Record<string, unknown>): void {
    const t = data.type;
    if (typeof t !== 'string') return;
    const fn = handlers[t];
    if (fn) {
        fn(wss, ws, data);
        return;
    }
    log.warn('ws_unhandled_client_message_type', { type: t });
}
