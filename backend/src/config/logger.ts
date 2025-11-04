/**
 * Logger simples para o sistema
 * Pode ser expandido para usar Winston, Pino ou outro logger mais robusto
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
    private formatMessage(level: LogLevel, message: string, meta?: any): string {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    }

    info(message: string, meta?: any): void {
        console.log(this.formatMessage('info', message, meta));
    }

    warn(message: string, meta?: any): void {
        console.warn(this.formatMessage('warn', message, meta));
    }

    error(message: string, meta?: any): void {
        console.error(this.formatMessage('error', message, meta));
    }

    debug(message: string, meta?: any): void {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(this.formatMessage('debug', message, meta));
        }
    }
}

const logger = new Logger();
export default logger;
