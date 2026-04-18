type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function fmt(level: string, scope: string, msg: string): string {
  return `${new Date().toISOString()} [${level.toUpperCase()}] [${scope}] ${msg}`;
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => {
      if (!shouldLog('debug')) return;
      process.stdout.write(fmt('debug', scope, msg) + (meta ? ' ' + JSON.stringify(meta) : '') + '\n');
    },
    info: (msg: string, meta?: Record<string, unknown>) => {
      if (!shouldLog('info')) return;
      process.stdout.write(fmt('info', scope, msg) + (meta ? ' ' + JSON.stringify(meta) : '') + '\n');
    },
    warn: (msg: string, meta?: Record<string, unknown>) => {
      if (!shouldLog('warn')) return;
      process.stderr.write(fmt('warn', scope, msg) + (meta ? ' ' + JSON.stringify(meta) : '') + '\n');
    },
    error: (msg: string, err?: unknown) => {
      if (!shouldLog('error')) return;
      const extra = err instanceof Error ? ` | ${err.message}` : err ? ` | ${JSON.stringify(err)}` : '';
      process.stderr.write(fmt('error', scope, msg + extra) + '\n');
    },
  };
}
