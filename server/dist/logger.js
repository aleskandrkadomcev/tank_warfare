/** Минимальный лог без зависимостей: уровень через `LOG_LEVEL`, по умолчанию `info` в prod и `debug` в dev. */
const ORDER = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
function configuredLevel() {
    const raw = (process.env.LOG_LEVEL || '').toLowerCase();
    if (raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug')
        return raw;
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}
function allow(level) {
    return ORDER[level] <= ORDER[configuredLevel()];
}
function stamp() {
    return new Date().toISOString();
}
export const log = {
    error(msg, extra) {
        if (!allow('error'))
            return;
        console.error(`[tanks] ${stamp()} ERROR`, msg, extra !== undefined ? extra : '');
    },
    warn(msg, extra) {
        if (!allow('warn'))
            return;
        console.warn(`[tanks] ${stamp()} WARN`, msg, extra !== undefined ? extra : '');
    },
    info(msg, extra) {
        if (!allow('info'))
            return;
        console.log(`[tanks] ${stamp()} INFO`, msg, extra !== undefined ? extra : '');
    },
    debug(msg, extra) {
        if (!allow('debug'))
            return;
        console.log(`[tanks] ${stamp()} DEBUG`, msg, extra !== undefined ? extra : '');
    },
};
//# sourceMappingURL=logger.js.map