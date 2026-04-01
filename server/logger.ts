/** Минимальный лог без зависимостей: уровень через `LOG_LEVEL`, по умолчанию `info` в prod и `debug` в dev. */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const ORDER: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

function configuredLevel(): LogLevel {
    const raw = (process.env.LOG_LEVEL || '').toLowerCase();
    if (raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug') return raw;
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function allow(level: LogLevel): boolean {
    return ORDER[level] <= ORDER[configuredLevel()];
}

function stamp(): string {
    return new Date().toISOString();
}

export const log = {
    error(msg: string, extra?: unknown): void {
        if (!allow('error')) return;
        console.error(`[tanks] ${stamp()} ERROR`, msg, extra !== undefined ? extra : '');
    },
    warn(msg: string, extra?: unknown): void {
        if (!allow('warn')) return;
        console.warn(`[tanks] ${stamp()} WARN`, msg, extra !== undefined ? extra : '');
    },
    info(msg: string, extra?: unknown): void {
        if (!allow('info')) return;
        console.log(`[tanks] ${stamp()} INFO`, msg, extra !== undefined ? extra : '');
    },
    debug(msg: string, extra?: unknown): void {
        if (!allow('debug')) return;
        console.log(`[tanks] ${stamp()} DEBUG`, msg, extra !== undefined ? extra : '');
    },
};
