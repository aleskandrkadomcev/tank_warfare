/**
 * Типы полезной нагрузки WS (фаза 4.3) — документация контракта и сужение в TS.
 * Не все поля валидируются на сервере; при расхождении с рантаймом поправить здесь.
 */
import { ClientMsg, ServerMsg } from './protocol.js';

// --- примитивы контракта ---

export type BrickPos = { x: number; y: number };
export type ForestPos = { x: number; y: number };
export type StonePos = { x: number; y: number; type: number; angle: number; scale: number };

export type LobbyListRow = {
    id?: string;
    name: string;
    players: number;
    max: number;
    hostId?: string;
};

export type LobbyPlayerRow = {
    id: string;
    nick: string;
    team: number;
    ready: boolean;
    color: string;
    isHost: boolean;
    isBot?: boolean;
};

export type PlayerSummary = { id: string; nick: string; team: number; color: string; isBot?: boolean };

export type MapPayload = { bricks: BrickPos[]; forests: ForestPos[]; stones: StonePos[]; biome: number; w: number; h: number };

export type BoostEntity = { x: number; y: number; type: number; id: string };

// --- клиент → сервер ---

export type ClientCreateLobbyMessage = {
    type: typeof ClientMsg.CREATE_LOBBY;
    nickname?: string;
    lobbyName?: string;
    color?: string;
    mapSize?: string;
};

export type ClientJoinLobbyMessage = {
    type: typeof ClientMsg.JOIN_LOBBY;
    lobbyId: string;
    nickname?: string;
    color?: string;
};

export type ClientUpdatePlayerMessage = {
    type: typeof ClientMsg.UPDATE_PLAYER;
    nickname?: string;
    color?: string;
};

export type ClientChangeTeamMessage = { type: typeof ClientMsg.CHANGE_TEAM; team: number };

export type ClientToggleReadyMessage = { type: typeof ClientMsg.TOGGLE_READY };

export type ClientStartGameMessage = { type: typeof ClientMsg.START_GAME };

export type ClientBulletMessage = {
    type: typeof ClientMsg.BULLET;
    bulletId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage?: number;
};

export type ClientBulletRemoveMessage = { type: typeof ClientMsg.BULLET_REMOVE; bulletId: string };

export type ClientDealDamageMessage = {
    type: typeof ClientMsg.DEAL_DAMAGE;
    targetId: string;
    damage: number;
    hitX: number;
    hitY: number;
    bulletId?: string;
};

export type ClientStateMessage = {
    type: typeof ClientMsg.STATE;
    x: number;
    y: number;
    angle: number;
    turretAngle: number;
    hp: number;
    vx: number;
    vy: number;
};

export type ClientDeathMessage = { type: typeof ClientMsg.DEATH };

export type ClientRestartMatchMessage = { type: typeof ClientMsg.RESTART_MATCH };

export type ClientDeployMineMessage = { type: typeof ClientMsg.DEPLOY_MINE; x: number; y: number };

export type ClientLaunchRocketMessage = { type: typeof ClientMsg.LAUNCH_ROCKET; tx: number; ty: number };

export type ClientCollisionDamageMessage = { type: typeof ClientMsg.COLLISION_DAMAGE; otherId: string };

export type ClientBoostPickupMessage = {
    type: typeof ClientMsg.BOOST_PICKUP;
    boostId: string;
    x: number;
    y: number;
};

export type ClientBricksDestroyBatchMessage = {
    type: typeof ClientMsg.BRICKS_DESTROY_BATCH;
    list: BrickPos[];
    ownerId?: string;
    bulletId?: string;
};

export type ClientDeploySmokeMessage = { type: typeof ClientMsg.DEPLOY_SMOKE; x: number; y: number };

export type ClientAddBotMessage = {
    type: typeof ClientMsg.ADD_BOT;
    team?: number;
    difficulty?: number;
};

export type ClientRemoveBotMessage = {
    type: typeof ClientMsg.REMOVE_BOT;
    botId?: string;
};

/** Сообщения, которые маршрутизирует `dispatch` на сервере. */
export type ClientInboundMessage =
    | ClientCreateLobbyMessage
    | ClientJoinLobbyMessage
    | ClientUpdatePlayerMessage
    | ClientChangeTeamMessage
    | ClientToggleReadyMessage
    | ClientStartGameMessage
    | ClientBulletMessage
    | ClientBulletRemoveMessage
    | ClientDealDamageMessage
    | ClientStateMessage
    | ClientDeathMessage
    | ClientRestartMatchMessage
    | ClientDeployMineMessage
    | ClientLaunchRocketMessage
    | ClientCollisionDamageMessage
    | ClientBoostPickupMessage
    | ClientBricksDestroyBatchMessage
    | ClientDeploySmokeMessage
    | ClientAddBotMessage
    | ClientRemoveBotMessage;

// --- сервер → клиент ---

export type ServerLobbyListMessage = { type: typeof ServerMsg.LOBBY_LIST; lobbies: LobbyListRow[] };

export type ServerLobbyCreatedMessage = {
    type: typeof ServerMsg.LOBBY_CREATED;
    lobbyId: string;
    playerId: string;
    team: number;
    nickname: string;
    color: string;
    isHost: boolean;
};

export type ServerLobbyJoinedMessage = {
    type: typeof ServerMsg.LOBBY_JOINED;
    lobbyId: string;
    playerId: string;
    team: number;
    nickname: string;
    color: string;
    isHost: boolean;
};

export type ServerLobbyStateMessage = {
    type: typeof ServerMsg.LOBBY_STATE;
    players: LobbyPlayerRow[];
    hostId: string;
    name: string;
};

export type ServerErrorMessage = { type: typeof ServerMsg.ERROR; msg: string };

export type ServerStartMessage = {
    type: typeof ServerMsg.START;
    team: number;
    playerId: string;
    color: string;
    allPlayers: PlayerSummary[];
    map: MapPayload;
};

export type ServerBulletBroadcast = {
    type: typeof ServerMsg.BULLET;
    bulletId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    ownerId: string;
    ownerTeam: number;
};

export type ServerBulletRemoveMessage = { type: typeof ServerMsg.BULLET_REMOVE; bulletId: string };

export type ServerBulletHitMessage = {
    type: typeof ServerMsg.BULLET_HIT;
    damage: number;
    hitX: number;
    hitY: number;
    attackerId: string;
    targetId: string;
    bulletId?: string;
};

export type ServerBulletHitVisualMessage = {
    type: typeof ServerMsg.BULLET_HIT_VISUAL;
    hitX: number;
    hitY: number;
    targetId: string;
};

export type ServerStateBroadcast = {
    type: typeof ServerMsg.STATE;
    id: string;
    team: number;
    color: string;
    x: number;
    y: number;
    angle: number;
    turretAngle: number;
    hp: number;
    vx: number;
    vy: number;
    spawnImmunityTimer: number;
};

export type ServerGameOverMessage = { type: typeof ServerMsg.GAME_OVER; winner: number };

export type ServerPlayerDiedMessage = { type: typeof ServerMsg.PLAYER_DIED; playerId: string };

export type ServerRestartMatchMessage = { type: typeof ServerMsg.RESTART_MATCH; map: MapPayload | null };

export type ServerDeployMineBroadcast = {
    type: typeof ServerMsg.DEPLOY_MINE;
    x: number;
    y: number;
    ownerId: string;
    ownerTeam: number;
    mineId: string | number;
};

export type ServerLaunchRocketBroadcast = {
    type: typeof ServerMsg.LAUNCH_ROCKET;
    tx: number;
    ty: number;
    ownerId: string;
    ownerTeam: number;
    rocketId: string;
};

export type ServerExplosionEventMessage = {
    type: typeof ServerMsg.EXPLOSION_EVENT;
    x: number;
    y: number;
    radius: number;
    damage?: number;
    ownerId: string;
    ownerTeam: number;
    destroyedBricks?: BrickPos[];
    spawnedBoosts?: BoostEntity[];
    rocketId?: string;
};

export type ServerExplosionDamageMessage = {
    type: typeof ServerMsg.EXPLOSION_DAMAGE;
    damage: number;
    x: number;
    y: number;
    rocketId?: string;
};

export type ServerCollisionHitMessage = { type: typeof ServerMsg.COLLISION_HIT; damage: number };

export type ServerBoostPickupBroadcast = {
    type: typeof ServerMsg.BOOST_PICKUP;
    boostId: string;
    x: number;
    y: number;
    playerId: string;
};

export type ServerBoostSpawnMessage = {
    type: typeof ServerMsg.BOOST_SPAWN;
    x: number;
    y: number;
    bType: number;
    id: string;
};

export type ServerBricksDestroyBatchBroadcast = {
    type: typeof ServerMsg.BRICKS_DESTROY_BATCH;
    list: BrickPos[];
    ownerId?: string;
    ownerTeam?: number;
    spawnedBoosts?: BoostEntity[];
    bulletId?: string;
};

export type ServerDeploySmokeBroadcast = {
    type: typeof ServerMsg.DEPLOY_SMOKE;
    x: number;
    y: number;
    ownerId: string;
    ownerTeam: number;
};

export type ServerScoreUpdateMessage = { type: typeof ServerMsg.SCORE_UPDATE; scores: Record<number, number> };

export type ServerMineTriggeredMessage = { type: typeof ServerMsg.MINE_TRIGGERED; mineId: string | number };

export type ServerMineRemovedMessage = { type: typeof ServerMsg.MINE_REMOVED; mineId: string | number };

/** Исходящие от сервера по игре / лобби (не исчерпывающий union редких вариантов). */
export type ServerOutboundGameMessage =
    | ServerLobbyListMessage
    | ServerLobbyCreatedMessage
    | ServerLobbyJoinedMessage
    | ServerLobbyStateMessage
    | ServerErrorMessage
    | ServerStartMessage
    | ServerBulletBroadcast
    | ServerBulletRemoveMessage
    | ServerBulletHitMessage
    | ServerBulletHitVisualMessage
    | ServerStateBroadcast
    | ServerGameOverMessage
    | ServerPlayerDiedMessage
    | ServerRestartMatchMessage
    | ServerDeployMineBroadcast
    | ServerLaunchRocketBroadcast
    | ServerExplosionEventMessage
    | ServerExplosionDamageMessage
    | ServerCollisionHitMessage
    | ServerBoostPickupBroadcast
    | ServerBoostSpawnMessage
    | ServerBricksDestroyBatchBroadcast
    | ServerDeploySmokeBroadcast
    | ServerScoreUpdateMessage
    | ServerMineTriggeredMessage
    | ServerMineRemovedMessage;
