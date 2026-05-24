type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const minLevel: Level = process.env['NODE_ENV'] === 'production' ? 'info' : 'debug';

function format(level: Level, context: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString().slice(11, 23); // HH:mm:ss.mmm
  const base = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${context}] ${msg}`;
  if (data === undefined) return base;
  const extra = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return `${base}  ${extra}`;
}

export function createLogger(context: string) {
  const log = (level: Level, msg: string, data?: unknown) => {
    if (LEVELS[level] < LEVELS[minLevel]) return;
    const line = format(level, context, msg, data);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (msg: string, data?: unknown) => log('debug', msg, data),
    info:  (msg: string, data?: unknown) => log('info',  msg, data),
    warn:  (msg: string, data?: unknown) => log('warn',  msg, data),
    error: (msg: string, data?: unknown) => log('error', msg, data),
  };
}
