import { log } from '../logger.js';
import type { RawData, WebSocket, WebSocketServer } from 'ws';
import { dispatchClientMessage } from './dispatch.js';

export function handleGameMessage(wss: WebSocketServer, ws: WebSocket, raw: RawData): void {
    let data: unknown;
    try {
        data = JSON.parse(String(raw));
    } catch {
        log.warn('ws_json_parse_failed');
        return;
    }
    if (!data || typeof data !== 'object' || typeof (data as { type?: unknown }).type !== 'string') {
        log.debug('ws_message_skip_invalid_shape');
        return;
    }
    dispatchClientMessage(wss, ws, data as Record<string, unknown>);
}
