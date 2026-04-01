/**
 * Имена поля `type` в JSON по WebSocket.
 * Единый источник для сервера и клиента (фаза 4).
 * @see docs/protocol.md
 */
export declare const ClientMsg: Readonly<{
    readonly CREATE_LOBBY: "create_lobby";
    readonly JOIN_LOBBY: "join_lobby";
    readonly UPDATE_PLAYER: "update_player";
    readonly CHANGE_TEAM: "change_team";
    readonly TOGGLE_READY: "toggle_ready";
    readonly START_GAME: "start_game";
    readonly BULLET: "bullet";
    readonly BULLET_REMOVE: "bullet_remove";
    readonly DEAL_DAMAGE: "deal_damage";
    readonly STATE: "state";
    readonly DEATH: "death";
    readonly RESTART_MATCH: "restart_match";
    readonly DEPLOY_MINE: "deploy_mine";
    readonly LAUNCH_ROCKET: "launch_rocket";
    readonly COLLISION_DAMAGE: "collision_damage";
    readonly BOOST_PICKUP: "boost_pickup";
    readonly BRICKS_DESTROY_BATCH: "bricks_destroy_batch";
    readonly DEPLOY_SMOKE: "deploy_smoke";
    readonly ADD_BOT: "add_bot";
    readonly REMOVE_BOT: "remove_bot";
    readonly USE_HEAL: "use_heal";
    readonly REJOIN_LOBBY: "rejoin_lobby";
    readonly LOBBY_CHAT: "lobby_chat";
}>;
export declare const ServerMsg: Readonly<{
    readonly LOBBY_CREATED: "lobby_created";
    readonly LOBBY_JOINED: "lobby_joined";
    readonly LOBBY_STATE: "lobby_state";
    readonly LOBBY_LIST: "lobby_list";
    readonly ERROR: "error";
    readonly START: "start";
    readonly BULLET: "bullet";
    readonly BULLET_REMOVE: "bullet_remove";
    readonly BULLET_HIT: "bullet_hit";
    readonly BULLET_HIT_VISUAL: "bullet_hit_visual";
    readonly STATE: "state";
    readonly GAME_OVER: "game_over";
    readonly PLAYER_DIED: "player_died";
    readonly RESTART_MATCH: "restart_match";
    readonly DEPLOY_MINE: "deploy_mine";
    readonly LAUNCH_ROCKET: "launch_rocket";
    readonly EXPLOSION_EVENT: "explosion_event";
    readonly EXPLOSION_DAMAGE: "explosion_damage";
    readonly COLLISION_HIT: "collision_hit";
    readonly BOOST_PICKUP: "boost_pickup";
    readonly BOOST_SPAWN: "boost_spawn";
    readonly BRICKS_DESTROY_BATCH: "bricks_destroy_batch";
    readonly DEPLOY_SMOKE: "deploy_smoke";
    readonly SCORE_UPDATE: "score_update";
    readonly MINE_TRIGGERED: "mine_triggered";
    readonly MINE_REMOVED: "mine_removed";
    readonly HULL_SPAWN: "hull_spawn";
    readonly HULL_UPDATE: "hull_update";
    readonly HULL_SLOW: "hull_slow";
    readonly USE_HEAL: "use_heal";
    readonly REJOIN: "rejoin";
    readonly LOBBY_CLOSED: "lobby_closed";
    readonly LOBBY_CHAT: "lobby_chat";
}>;
export type ClientMsgKey = keyof typeof ClientMsg;
export type ServerMsgKey = keyof typeof ServerMsg;
export type ClientMessageType = (typeof ClientMsg)[ClientMsgKey];
export type ServerMessageType = (typeof ServerMsg)[ServerMsgKey];
//# sourceMappingURL=protocol.d.ts.map