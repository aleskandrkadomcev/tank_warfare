import { ClientMsg } from '#shared/protocol.js';
import { log } from '../logger.js';
import { handleBullet, handleBulletRemove, handleCollisionDamage, handleDealDamage, } from './handlers/combat.js';
import { handleDeath, handleRestartMatch, handleState } from './handlers/gameState.js';
import { handleAddBot, handleChangeTeam, handleCreateLobby, handleJoinLobby, handleRemoveBot, handleStartGame, handleToggleReady, handleUpdatePlayer, } from './handlers/lobby.js';
import { handleBoostPickup, handleBricksDestroyBatch, handleDeployMine, handleDeploySmoke, handleLaunchRocket, } from './handlers/world.js';
const handlers = {
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
};
/** Проверка: на каждое значение `ClientMsg` назначен хендлер (юнит-тест + опционально dev-старт). */
export function assertDispatchRegistryComplete() {
    Object.keys(ClientMsg).forEach((key) => {
        const type = ClientMsg[key];
        if (typeof handlers[type] !== 'function') {
            throw new Error(`WS dispatch: нет хендлера для ClientMsg.${String(key)} (${type})`);
        }
    });
}
export function dispatchClientMessage(wss, ws, data) {
    const t = data.type;
    if (typeof t !== 'string')
        return;
    const fn = handlers[t];
    if (fn) {
        fn(wss, ws, data);
        return;
    }
    log.warn('ws_unhandled_client_message_type', { type: t });
}
//# sourceMappingURL=dispatch.js.map