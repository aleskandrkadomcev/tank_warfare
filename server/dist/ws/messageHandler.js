import { log } from '../logger.js';
import { dispatchClientMessage } from './dispatch.js';
export function handleGameMessage(wss, ws, raw) {
    let data;
    try {
        data = JSON.parse(String(raw));
    }
    catch {
        log.warn('ws_json_parse_failed');
        return;
    }
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
        log.debug('ws_message_skip_invalid_shape');
        return;
    }
    dispatchClientMessage(wss, ws, data);
}
//# sourceMappingURL=messageHandler.js.map