import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import zlib from 'node:zlib'
import { promisify } from 'node:util'
import type Logger from '../../core/ports/logger.port'
import type { LogLevel } from '../../core/ports/logger.port'

const gzip = promisify(zlib.gzip)

export interface FileLoggerOptions {
  readonly logsRoot: string
  readonly appName?: string
  readonly level?: LogLevel
  readonly retentionDays?: number
  readonly maxFileSizeBytes?: number
}

export class FileLogger implements Logger {
  private readonly appName: string
  private readonly logsRoot: string
  private readonly level: LogLevel
  private readonly retentionDays: number
  private readonly maxFileSizeBytes: number
  private cleanupTimer: NodeJS.Timeout | null = null
  private context: Record<string, unknown> | null = null

  constructor(opts: FileLoggerOptions) {
    this.logsRoot = opts.logsRoot
    this.appName = opts.appName ?? 'vas'
    this.level = opts.level ?? 'info'
    this.retentionDays = opts.retentionDays ?? 14
    this.maxFileSizeBytes = opts.maxFileSizeBytes ?? 10 * 1024 * 1024

    void fsp.mkdir(this.logsRoot, { recursive: true })
    // schedule daily cleanup
    this.cleanupTimer = setInterval(() => { void this.cleanupOldLogs() }, 24 * 60 * 60 * 1000)
    // run on startup
    void this.cleanupOldLogs()
  }

  child(context: Record<string, unknown>): Logger {
    const c = new FileLogger({ logsRoot: this.logsRoot, appName: this.appName, level: this.level, retentionDays: this.retentionDays, maxFileSizeBytes: this.maxFileSizeBytes })
    c.context = { ...(this.context ?? {}), ...context }
    return c
  }

  async debug(message: string, meta?: Record<string, unknown>): Promise<void> { return this.log('debug', message, meta) }
  async info(message: string, meta?: Record<string, unknown>): Promise<void> { return this.log('info', message, meta) }
  async warn(message: string, meta?: Record<string, unknown>): Promise<void> { return this.log('warn', message, meta) }
  async error(message: string, meta?: Record<string, unknown>): Promise<void> { return this.log('error', message, meta) }

  private levelOrder(l: LogLevel): number {
    switch (l) {
      case 'debug': return 10
      case 'info': return 20
      case 'warn': return 30
      case 'error': return 40
    }
  }

  private async log(level: LogLevel, message: string, meta?: Record<string, unknown>): Promise<void> {
    if (this.levelOrder(level) < this.levelOrder(this.level)) return

    const now = new Date()
    const date = now.toISOString().slice(0,10)
    const time = now.toISOString()
    const pid = process.pid
    const ctx = this.context ?? {}
    const payload = { time, pid, level, message, meta: meta ?? {}, ctx }
    const line = JSON.stringify(payload) + '\n'

    const filename = `${this.appName}-${date}.log`
    const filePath = path.join(this.logsRoot, filename)

    try {
      await fsp.appendFile(filePath, line, 'utf8')
      await this.rotateIfNeeded(filePath)
    } catch (err) {
      // swallow errors but output to stderr as fallback
      try { process.stderr.write(`Logger write failed: ${String(err)}\n`) } catch {}
    }
  }

  private async rotateIfNeeded(filePath: string): Promise<void> {
    try {
      const stat = await fsp.stat(filePath)
      if (stat.size <= this.maxFileSizeBytes) return

      // rotate: find next index
      const dir = path.dirname(filePath)
      const base = path.basename(filePath)
      let idx = 1
      while (true) {
        const candidate = path.join(dir, `${base}.${idx}`)
        try { await fsp.access(candidate); idx += 1 } catch { 
          // move file to candidate and gzip it
          await fsp.rename(filePath, candidate)
          const data = await fsp.readFile(candidate)
          const gz = await gzip(data)
          await fsp.writeFile(candidate + '.gz', gz)
          await fsp.unlink(candidate)
          break
        }
      }
    } catch {
      // ignore
    }
  }

  async rotateNow(): Promise<void> {
    const date = new Date().toISOString().slice(0,10)
    const filename = `${this.appName}-${date}.log`
    const filePath = path.join(this.logsRoot, filename)
    await this.rotateIfNeeded(filePath)
  }

  async cleanupOldLogs(): Promise<void> {
    try {
      const files = await fsp.readdir(this.logsRoot)
      const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000
      for (const f of files) {
        if (!f.startsWith(this.appName)) continue
        const p = path.join(this.logsRoot, f)
        try {
          const st = await fsp.stat(p)
          if (st.mtime.getTime() < cutoff) {
            await fsp.unlink(p)
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      try { process.stderr.write(`Log cleanup failed: ${String(err)}\n`) } catch {}
    }
  }

  async flush(): Promise<void> { /* no-op for file logger */ }

  close(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

export default FileLogger
