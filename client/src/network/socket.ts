/**
 * WebSocket: подключение и отправка без размазывания состояния по модулям.
 */
let socket: WebSocket | null = null;

export type GameSocketCallbacks = {
    onOpen?: () => void;
    onMessage?: (data: unknown) => void;
    onError?: (e: Event) => void;
    onClose?: () => void;
    setConnectingStatus?: (text: string) => void;
};

export function connectGameSocket(url: string, callbacks: GameSocketCallbacks = {}): WebSocket {
    disconnectGameSocket();
    const { onOpen, onMessage, onError, onClose, setConnectingStatus } = callbacks;
    setConnectingStatus?.('Подключение...');
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => {
        onOpen?.();
        setConnectingStatus?.('');
    };
    ws.onmessage = (e) => {
        let data: unknown;
        try {
            data = JSON.parse(String(e.data));
        } catch {
            return;
        }
        onMessage?.(data);
    };
    ws.onerror = (ev) => {
        console.error('WS Error', ev);
        onError?.(ev);
        setConnectingStatus?.('Ошибка сети');
    };
    ws.onclose = () => {
        onClose?.();
    };
    return ws;
}

export function disconnectGameSocket(): void {
    if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        socket = null;
    }
}

export function sendGameMessage(payload: Record<string, unknown>): void {
    if (socket && socket.readyState === 1) {
        socket.send(JSON.stringify(payload));
    }
}

export function isGameSocketOpen(): boolean {
    return Boolean(socket && socket.readyState === 1);
}
