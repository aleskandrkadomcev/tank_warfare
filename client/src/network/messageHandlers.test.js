/**
 * Маршрутизация входящих WS-сообщений: известный type → нужный колбэк/ветка (план фазы 2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/audio.js', () => ({
    audioCtx: {},
    initAudio: vi.fn(),
    calcPan: vi.fn(() => 0),
    playAlert: vi.fn(),
    playBombBeep: vi.fn(),
    playRocketFlyBy: vi.fn(),
    playSound_BrickHit: vi.fn(),
    playSound_Explosion: vi.fn(),
    playSound_Heal: vi.fn(),
    playSound_Hit: vi.fn(),
    playSound_Shot: vi.fn(),
    playSound_ShotHeavy: vi.fn(),
    playSound_StoneHit: vi.fn(),
    playSound_Victory: vi.fn(),
    TankEngine: vi.fn().mockImplementation(() => ({ start: vi.fn() })),
}));

vi.mock('../game/cameraShake.js', () => ({
    triggerShake: vi.fn(),
}));

// Stub global document for handlers that access DOM
if (typeof document === 'undefined') {
    const noop = () => null;
    globalThis.document = /** @type {any} */ ({ getElementById: noop });
}

import { battle, session } from '../game/gameState.js';
import { playSound_Hit } from '../lib/audio.js';
import { ServerMsg } from '../../../shared/dist/protocol.js';
import {
    configureServerMessages,
    gameMessageHooks,
    handleServerMessage,
} from './messageHandlers.js';

describe('handleServerMessage', () => {
    const send = vi.fn();

    beforeEach(() => {
        configureServerMessages({ send });
        session.myId = null;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('вызывает updateLobbyListUI для type lobby_list', () => {
        const spy = vi.spyOn(gameMessageHooks, 'updateLobbyListUI');
        const lobbies = [{ id: 'abc', name: 'Room', players: 1, max: 6 }];
        handleServerMessage({ type: ServerMsg.LOBBY_LIST, lobbies });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(lobbies);
    });

    it('вызывает resetMatch для type restart_match', () => {
        const spy = vi.spyOn(gameMessageHooks, 'resetMatch');
        handleServerMessage({ type: ServerMsg.RESTART_MATCH, map: { bricks: [], biome: 0 } });
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('для bullet_hit с targetId === myId вызывает createBulletHitEffect', () => {
        session.myId = 'player_me';
        battle.tank.hp = 100;
        battle.tank.spawnImmunityTimer = 0;
        battle.tank.x = 1;
        battle.tank.y = 2;
        const spy = vi.spyOn(gameMessageHooks, 'createBulletHitEffect');
        handleServerMessage({
            type: ServerMsg.BULLET_HIT,
            targetId: 'player_me',
            damage: 5,
        });
        expect(spy).toHaveBeenCalled();
    });

    it('для bullet_hit с другим targetId вызывает только playSound_Hit', () => {
        session.myId = 'me';
        const particles = vi.spyOn(gameMessageHooks, 'spawnParticles');
        handleServerMessage({
            type: ServerMsg.BULLET_HIT,
            targetId: 'other',
            damage: 5,
        });
        expect(playSound_Hit).toHaveBeenCalledTimes(1);
        expect(particles).not.toHaveBeenCalled();
    });

    it('игнорирует сообщение без type и неизвестный type', () => {
        const spy = vi.spyOn(gameMessageHooks, 'updateLobbyListUI');
        handleServerMessage({});
        handleServerMessage({ type: 'totally_unknown_message' });
        expect(spy).not.toHaveBeenCalled();
    });
});
