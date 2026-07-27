export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): Promise<void>
  info(message: string, meta?: Record<string, unknown>): Promise<void>
  warn(message: string, meta?: Record<string, unknown>): Promise<void>
  error(message: string, meta?: Record<string, unknown>): Promise<void>
  child(context: Record<string, unknown>): Logger
  flush?(): Promise<void>
  rotateNow?(): Promise<void>
  cleanupOldLogs?(): Promise<void>
}

export default Logger
