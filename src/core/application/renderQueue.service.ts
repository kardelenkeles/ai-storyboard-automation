import fs from 'node:fs/promises'
import path from 'node:path'
import EventEmitter from 'node:events'

import type { StoryboardRepositoryPort } from '../ports/storyboard.repository'
import type RenderHandler from '../ports/renderer.handler'
import type { ProgressCallback } from '../ports/renderer.handler'
import type { StoryScene } from '../../shared/domain/storyboard'

export type QueueItemStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled'

export interface QueueItem {
  readonly sceneId: string
  status: QueueItemStatus
  attempts: number
  lastError?: string | null
}

export interface RenderQueueState {
  readonly projectId: string
  items: QueueItem[]
  paused: boolean
  current: string | null
}

export interface RenderQueueDependencies {
  readonly projectId: string
  readonly projectRootPath: string
  readonly repository: StoryboardRepositoryPort
  readonly handler: RenderHandler
  readonly maxAttempts?: number
}

export class RenderQueue extends EventEmitter {
  private state: RenderQueueState
  private running = false
  private abortCurrent: AbortController | null = null
  private persistPath: string
  private maxAttempts: number

  constructor(private deps: RenderQueueDependencies) {
    super()
    this.maxAttempts = deps.maxAttempts ?? 3
    this.persistPath = path.join(deps.projectRootPath, 'cache', 'render-queue.json')
    this.state = { projectId: deps.projectId, items: [], paused: false, current: null }
  }

  async initialize(): Promise<void> {
    await this.load()
    this.processLoop().catch((err) => this.emit('error', err))
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.persistPath), { recursive: true })
      await fs.writeFile(this.persistPath, JSON.stringify(this.state, null, 2), 'utf8')
      this.emit('persisted', this.state)
    } catch (err) {
      this.emit('error', err)
    }
  }

  private async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.persistPath, 'utf8')
      const parsed = JSON.parse(raw) as RenderQueueState
      // basic validation
      if (parsed && parsed.projectId === this.deps.projectId) {
        this.state = parsed
      }
    } catch {
      // ignore missing file
    }
  }

  list(): readonly QueueItem[] {
    return this.state.items
  }

  enqueue(sceneId: string): void {
    if (this.state.items.find((i) => i.sceneId === sceneId)) return
    this.state.items.push({ sceneId, status: 'pending', attempts: 0, lastError: null })
    this.emit('queueUpdated', this.state)
    void this.persist()
  }

  pause(): void {
    this.state.paused = true
    this.emit('paused')
    void this.persist()
  }

  resume(): void {
    if (!this.state.paused) return
    this.state.paused = false
    this.emit('resumed')
    void this.persist()
    void this.processLoop()
  }

  cancel(sceneId?: string): void {
    if (!sceneId) {
      // cancel everything
      for (const it of this.state.items) it.status = it.status === 'in-progress' ? 'cancelled' : it.status === 'pending' ? 'cancelled' : it.status
      if (this.abortCurrent) this.abortCurrent.abort()
      this.emit('cancelled', null)
    } else {
      const item = this.state.items.find((i) => i.sceneId === sceneId)
      if (!item) return
      if (item.status === 'in-progress' && this.abortCurrent) this.abortCurrent.abort()
      item.status = 'cancelled'
      this.emit('cancelled', sceneId)
    }
    void this.persist()
  }

  retry(sceneId: string): void {
    const item = this.state.items.find((i) => i.sceneId === sceneId)
    if (!item) return
    item.status = 'pending'
    item.attempts = 0
    item.lastError = null
    this.emit('retry', sceneId)
    void this.persist()
    void this.processLoop()
  }

  retryFailed(): void {
    for (const item of this.state.items) {
      if (item.status === 'failed') {
        item.status = 'pending'
        item.attempts = 0
        item.lastError = null
      }
    }
    this.emit('retryFailed')
    void this.persist()
    void this.processLoop()
  }

  private async processLoop(): Promise<void> {
    if (this.running) return
    this.running = true

    while (true) {
      if (this.state.paused) break
      const next = this.state.items.find((i) => i.status === 'pending')
      if (!next) break

      this.state.current = next.sceneId
      next.status = 'in-progress'
      next.attempts += 1
      this.emit('started', next.sceneId)
      await this.persist()

      this.abortCurrent = new AbortController()
      const signal = this.abortCurrent.signal

      try {
        await this.deps.handler(this.deps.projectId, next.sceneId, (percent, info) => {
          this.emit('progress', { sceneId: next.sceneId, percent, info })
        }, signal)

        next.status = 'completed'
        this.emit('completed', next.sceneId)
      } catch (err: any) {
        if (signal.aborted) {
          next.status = 'cancelled'
          this.emit('cancelled', next.sceneId)
        } else {
          next.status = 'failed'
          next.lastError = String(err?.message ?? err)
          this.emit('failed', { sceneId: next.sceneId, error: next.lastError })
        }
      } finally {
        this.abortCurrent = null
        this.state.current = null
        await this.persist()
      }

      // if failed and attempts < maxAttempts, automatically retry
      if (next.status === 'failed' && next.attempts < this.maxAttempts) {
        next.status = 'pending'
        this.emit('scheduledRetry', next.sceneId)
        await this.persist()
        continue
      }

      // continue to next item
    }

    this.running = false
  }

  getState(): RenderQueueState {
    return this.state
  }
}

export default RenderQueue
