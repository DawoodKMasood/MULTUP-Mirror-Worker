export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogContext {
  jobId?: string
  fileId?: string
  service?: string
  [key: string]: unknown
}

class Logger {
  private context: LogContext = {}

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context }
  }

  clearContext(): void {
    this.context = {}
  }

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    console.log(JSON.stringify({
      level,
      message,
      ...this.context,
      ...extra,
      timestamp: new Date().toISOString(),
    }))
  }

  info(message: string, extra?: Record<string, unknown>): void {
    this.log('info', message, extra)
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.log('warn', message, extra)
  }

  error(message: string, extra?: Record<string, unknown>): void {
    this.log('error', message, extra)
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.log('debug', message, extra)
  }
}

export const logger = new Logger()
