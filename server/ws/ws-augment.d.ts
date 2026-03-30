import 'ws';

declare module 'ws' {
    interface WebSocket {
        id: string | null;
        lobbyId: string | null;
        nickname: string;
        team: number;
        ready: boolean;
        color: string;
        camo: string;
        tankType: string;
        isInGame: boolean;
        isBot: boolean;
        w: number;
        h: number;
        lastPos: { x: number; y: number; hp: number; team?: number };
        lastPosAt: number;
        x: number;
        y: number;
        angle: number;
        turretAngle: number;
        vx: number;
        vy: number;
        hp: number;
        spawnTime: number;
        healCount: number;
        smokeCount: number;
        mineCount: number;
        rocketCount: number;
        /** Время отключения (для реконнекта). undefined = подключён. */
        disconnectedAt?: number;
        /** ID последнего атакующего (для killtracking). */
        _lastAttackerId?: string;
        botDifficulty?: number;
        botBrain?: {
            targetId: string | null;
            wanderAngle: number;
            lastShotAt: number;
            nextDecisionAt: number;
            path: { x: number; y: number }[];
            pathKey: string;
            lastPathAt: number;
            stuckTicks: number;
        };
    }
}

export { };

