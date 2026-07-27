import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { randomUUID } from 'node:crypto'
import EventEmitter from 'node:events'
import http from 'node:http'
import https from 'node:https'

import type { DownloadManager, DownloadRequest, DownloadMetadata } from '../../core/ports/downloadManager.port'

type InternalMetadata = { -readonly [K in keyof DownloadMetadata]: DownloadMetadata[K] }

export class DownloadManagerImpl extends EventEmitter implements DownloadManager {
  // metadata file per project
  constructor(private readonly metadataFilename = 'cache/downloads.json') {
    super()
  }

  async initialize(): Promise<void> {
    // nothing globally to initialize
  }

  private metadataPath(projectRoot: string): string {
    return path.join(projectRoot, this.metadataFilename)
  }

  private async readAll(projectRoot: string): Promise<Record<string, InternalMetadata>> {
    try {
      const raw = await fsp.readFile(this.metadataPath(projectRoot), 'utf8')
      return JSON.parse(raw) as Record<string, InternalMetadata>
    } catch {
      return {}
    }
  }

  private async writeAll(projectRoot: string, data: Record<string, InternalMetadata>): Promise<void> {
    await fsp.mkdir(path.join(projectRoot, 'cache'), { recursive: true })
    await fsp.writeFile(this.metadataPath(projectRoot), JSON.stringify(data, null, 2), 'utf8')
  }

  private async ensureUniqueFilename(destDir: string, baseName: string): Promise<string> {
    let candidate = baseName
    let i = 1
    while (true) {
      const p = path.join(destDir, candidate)
      try {
        await fsp.access(p)
        // exists -> generate new
        const ext = path.extname(baseName)
        const name = path.basename(baseName, ext)
        candidate = `${name}-${i}${ext}`
        i += 1
      } catch {
        return candidate
      }
    }
  }

  async list(projectRoot: string): Promise<readonly DownloadMetadata[]> {
    const all = await this.readAll(projectRoot)
    return Object.values(all)
  }

  async get(projectRoot: string, id: string): Promise<DownloadMetadata | null> {
    const all = await this.readAll(projectRoot)
    return all[id] ?? null
  }

  async download(projectRoot: string, request: DownloadRequest): Promise<DownloadMetadata> {
    const all = await this.readAll(projectRoot)
    const id = randomUUID()
    const downloadsDir = path.join(projectRoot, 'downloads')
    await fsp.mkdir(downloadsDir, { recursive: true })

    const url = request.url
    const suggested = (request.suggestedFilename ?? path.basename(new URL(url).pathname)) ?? `download-${id}`
    const filename = await this.ensureUniqueFilename(downloadsDir, suggested)
    const destPath = path.join(downloadsDir, filename)
    const tempPath = destPath + '.part'

    const meta: InternalMetadata = {
      id,
      url,
      filename,
      destPath,
      tempPath,
      startedAt: null,
      finishedAt: null,
      status: 'pending',
      size: null,
      downloaded: 0,
      sha256: null,
      error: null,
    }

    all[id] = meta
    await this.writeAll(projectRoot, all)

    // kick off async download but return metadata immediately
    void this._performDownload(projectRoot, id).catch((err) => this.emit('error', err))

    return meta
  }

  async cancel(id: string): Promise<void> {
    // simple cancellation: mark in metadata; active stream check not implemented per-download handle
    // For now we set status cancelled and emit event; streaming handlers should check metadata if supported
    // Read through all project roots is expensive; caller should provide projectRoot. We'll search in workspace cache.
    throw new Error('cancel requires projectRoot; use get and then cancel via metadata file operations')
  }

  private async _performDownload(projectRoot: string, id: string): Promise<void> {
    const all = await this.readAll(projectRoot)
    const meta = all[id]
    if (!meta) throw new Error(`Download metadata not found: ${id}`)

    // prepare request
    const url = new URL(meta.url)
    const httpLib = url.protocol === 'http:' ? http : https

    // check existing partial file size for resume
    let existingSize = 0
    try {
      const stat = await fsp.stat(meta.tempPath)
      existingSize = stat.size
    } catch {
      existingSize = 0
    }

    meta.status = 'downloading'
    meta.startedAt = Date.now()
    meta.error = null
    meta.downloaded = existingSize
    all[id] = meta
    await this.writeAll(projectRoot, all)
    this.emit('started', meta)

    // send request with Range if resuming
    const headers: Record<string, string> = {}
    if (existingSize > 0) headers['Range'] = `bytes=${existingSize}-`

    await new Promise<void>((resolve, reject) => {
      const req = httpLib.get({ hostname: url.hostname, path: url.pathname + url.search, port: url.port || undefined, protocol: url.protocol, headers }, (res) => {
        const statusCode = res.statusCode ?? 0
        if (statusCode >= 400) {
          meta.status = 'failed'
          meta.error = `HTTP ${statusCode}`
          all[id] = meta
          void this.writeAll(projectRoot, all)
          this.emit('failed', meta)
          reject(new Error(`Download failed: ${statusCode}`))
          return
        }

        // compute content length
        const contentLength = res.headers['content-length'] ? parseInt(res.headers['content-length'] as string, 10) : null
        if (contentLength !== null) {
          meta.size = existingSize + contentLength
        }

        const hash = crypto.createHash('sha256')
        const writeStream = fs.createWriteStream(meta.tempPath, { flags: existingSize > 0 ? 'a' : 'w' })

        res.on('data', (chunk) => {
          hash.update(chunk)
          meta.downloaded += chunk.length
          this.emit('progress', { id: meta.id, downloaded: meta.downloaded, size: meta.size })
        })

        res.pipe(writeStream)

        writeStream.on('finish', async () => {
          try {
            const digest = hash.digest('hex')
            meta.sha256 = digest
            // verify size if available
            try {
              const st = await fsp.stat(meta.tempPath)
              if (meta.size !== null && st.size !== meta.size) {
                meta.status = 'failed'
                meta.error = `Size mismatch: expected ${meta.size}, got ${st.size}`
                all[id] = meta
                await this.writeAll(projectRoot, all)
                this.emit('failed', meta)
                reject(new Error(meta.error))
                return
              }
            } catch (err) {
              // ignore
            }

            // move temp to final
            await fsp.rename(meta.tempPath, meta.destPath)
            meta.status = 'completed'
            meta.finishedAt = Date.now()
            all[id] = meta
            await this.writeAll(projectRoot, all)
            this.emit('completed', meta)
            resolve()
          } catch (err) {
            meta.status = 'failed'
            meta.error = String(err)
            all[id] = meta
            await this.writeAll(projectRoot, all)
            this.emit('failed', meta)
            reject(err)
          }
        })

        writeStream.on('error', async (err) => {
          meta.status = 'failed'
          meta.error = String(err)
          all[id] = meta
          await this.writeAll(projectRoot, all)
          this.emit('failed', meta)
          reject(err)
        })
      })

      req.on('error', async (err) => {
        meta.status = 'failed'
        meta.error = String(err)
        all[id] = meta
        await this.writeAll(projectRoot, all)
        this.emit('failed', meta)
        reject(err)
      })
    })
  }
}

export default DownloadManagerImpl
