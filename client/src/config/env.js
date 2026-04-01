/**
 * WebSocket URL: VITE_WS_URL переопределяет адрес (локально — тот же порт, что PORT сервера, см. client/.env.development).
 * Otherwise same host/port as the page (production on :80).
 */
export function getWebSocketUrl() {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return String(explicit);
  const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname;
  const port = location.port || (location.protocol === 'https:' ? '443' : '80');
  return `${proto}://${host}:${port}`;
}
