/**
 * Имена поля `type` в JSON по WebSocket.
 * Единый источник для сервера и клиента (фаза 4).
 * @see docs/protocol.md
 */

export const ClientMsg = Object.freeze({
    CREATE_LOBBY: 'create_lobby',
    JOIN_LOBBY: 'join_lobby',
    UPDATE_PLAYER: 'update_player',
    CHANGE_TEAM: 'change_team',
    TOGGLE_READY: 'toggle_ready',
    START_GAME: 'start_game',
    BULLET: 'bullet',
    BULLET_REMOVE: 'bullet_remove',
    DEAL_DAMAGE: 'deal_damage',
    STATE: 'state',
    DEATH: 'death',
    RESTART_MATCH: 'restart_match',
    DEPLOY_MINE: 'deploy_mine',
    LAUNCH_ROCKET: 'launch_rocket',
    COLLISION_DAMAGE: 'collision_damage',
    BOOST_PICKUP: 'boost_pickup',
    BRICKS_DESTROY_BATCH: 'bricks_destroy_batch',
    DEPLOY_SMOKE: 'deploy_smoke',
    ADD_BOT: 'add_bot',
    REMOVE_BOT: 'remove_bot',
    USE_HEAL: 'use_heal',
    REJOIN_LOBBY: 'rejoin_lobby',
    LOBBY_CHAT: 'lobby_chat',
} as const);

export const ServerMsg = Object.freeze({
    LOBBY_CREATED: 'lobby_created',
    LOBBY_JOINED: 'lobby_joined',
    LOBBY_STATE: 'lobby_state',
    LOBBY_LIST: 'lobby_list',
    ERROR: 'error',
    START: 'start',
    BULLET: 'bullet',
    BULLET_REMOVE: 'bullet_remove',
    BULLET_HIT: 'bullet_hit',
    BULLET_HIT_VISUAL: 'bullet_hit_visual',
    STATE: 'state',
    GAME_OVER: 'game_over',
    PLAYER_DIED: 'player_died',
    RESTART_MATCH: 'restart_match',
    DEPLOY_MINE: 'deploy_mine',
    LAUNCH_ROCKET: 'launch_rocket',
    EXPLOSION_EVENT: 'explosion_event',
    EXPLOSION_DAMAGE: 'explosion_damage',
    COLLISION_HIT: 'collision_hit',
    BOOST_PICKUP: 'boost_pickup',
    BOOST_SPAWN: 'boost_spawn',
    BRICKS_DESTROY_BATCH: 'bricks_destroy_batch',
    DEPLOY_SMOKE: 'deploy_smoke',
    SCORE_UPDATE: 'score_update',
    MINE_TRIGGERED: 'mine_triggered',
    MINE_REMOVED: 'mine_removed',
    HULL_SPAWN: 'hull_spawn',
    HULL_UPDATE: 'hull_update',
    HULL_SLOW: 'hull_slow',
    USE_HEAL: 'use_heal',
    REJOIN: 'rejoin',
    LOBBY_CLOSED: 'lobby_closed',
    LOBBY_CHAT: 'lobby_chat',
} as const);

export type ClientMsgKey = keyof typeof ClientMsg;
export type ServerMsgKey = keyof typeof ServerMsg;
export type ClientMessageType = (typeof ClientMsg)[ClientMsgKey];
export type ServerMessageType = (typeof ServerMsg)[ServerMsgKey];
