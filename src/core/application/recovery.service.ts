import fs from 'node:fs/promises'
import path from 'node:path'
import { SqliteConnection } from '../../infrastructure/sqlite/sqlite-connection'

import type { ProjectFileSystemPort } from '../ports/project-file-system'
import type { ProjectCatalogRepositoryPort } from '../ports/project-catalog.repository'
import type { StoryboardRepositoryPort } from '../ports/storyboard.repository'

export interface RecoveryManagerDependencies {
  readonly projectFileSystem: ProjectFileSystemPort
  readonly projectCatalogRepository: ProjectCatalogRepositoryPort
  readonly storyboardRepository: StoryboardRepositoryPort
}

export interface RecoveryReport {
  readonly projectId: string
  readonly queueRecovered: boolean
  readonly downloadsRecovered: boolean
  readonly dbRecovered: boolean
  readonly scenesRecovered: number
}

export function createRecoveryManager(deps: RecoveryManagerDependencies) {
  const queuePath = (projectRoot: string) => path.join(projectRoot, 'cache', 'render-queue.json')
  const downloadsPath = (projectRoot: string) => path.join(projectRoot, 'cache', 'downloads.json')
  const storyboardPath = (projectRoot: string) => path.join(projectRoot, 'storyboard.json')
  const dbPath = (projectRoot: string) => path.join(projectRoot, 'database.sqlite')

  async function normalizeQueue(projectRoot: string): Promise<boolean> {
    try {
      const p = queuePath(projectRoot)
      const raw = await fs.readFile(p, 'utf8')
      const state = JSON.parse(raw) as any
      let changed = false
      if (state && Array.isArray(state.items)) {
        for (const it of state.items) {
          if (it.status === 'in-progress') { it.status = 'pending'; changed = true }
        }
        state.current = null
      }
      if (changed) await fs.writeFile(p, JSON.stringify(state, null, 2), 'utf8')
      return true
    } catch {
      return false
    }
  }

  async function normalizeDownloads(projectRoot: string): Promise<boolean> {
    try {
      const p = downloadsPath(projectRoot)
      const raw = await fs.readFile(p, 'utf8')
      const state = JSON.parse(raw) as any
      let changed = false
      for (const id of Object.keys(state ?? {})) {
        const meta = state[id]
        if (!meta) continue
        if (meta.status === 'downloading') {
          meta.status = 'pending'
          meta.error = null
          changed = true
        }
      }
      if (changed) await fs.writeFile(p, JSON.stringify(state, null, 2), 'utf8')
      return true
    } catch {
      return false
    }
  }

  async function checkAndRestoreDatabase(projectRoot: string, projectId: string): Promise<boolean> {
    const db = dbPath(projectRoot)
    try {
      const conn = await SqliteConnection.open(db)
      try {
        const res = await conn.all('PRAGMA integrity_check')
        const ok = Array.isArray(res) && res.length > 0 && Object.values(res[0] as any).some((v: any) => v === 'ok')
        await conn.close()
        if (ok) return true
      } catch {
        try { await conn.close() } catch {}
      }
    } catch {
      // cannot open DB
    }

    // attempt restore from snapshot
    try {
      const snap = await deps.projectFileSystem.readSnapshot(projectRoot)
      if (!snap) return false
      await deps.projectFileSystem.writeSnapshot(projectRoot, { ...snap })
      return true
    } catch {
      return false
    }
  }

  async function recoverScenes(projectRoot: string, projectId: string): Promise<number> {
    // mark scenes that were 'rendering' as 'queued' so processing resumes from last successful
    const storyboard = await deps.storyboardRepository.loadStoryboard(projectId)
    let count = 0
    for (const scene of storyboard.scenes) {
      if (scene.status === 'rendering') {
        const updated = { ...scene, status: 'queued' as const }
        await deps.storyboardRepository.updateScene(projectId, updated)
        count += 1
      }
    }
    return count
  }

  async function recoverProject(projectRoot: string, projectId?: string): Promise<RecoveryReport> {
    // try infer projectId
    let pid = projectId
    if (!pid) {
      try {
        const raw = await fs.readFile(storyboardPath(projectRoot), 'utf8')
        const parsed = JSON.parse(raw) as any
        pid = parsed.projectId
      } catch {
        // fallback to provided projectId
      }
    }
    if (!pid) throw new Error('projectId not provided and could not be inferred')

    const q = await normalizeQueue(projectRoot)
    const d = await normalizeDownloads(projectRoot)
    const db = await checkAndRestoreDatabase(projectRoot, pid)
    const scenesRecovered = await recoverScenes(projectRoot, pid)

    return { projectId: pid, queueRecovered: q, downloadsRecovered: d, dbRecovered: db, scenesRecovered }
  }

  return { recoverProject }
}

export default createRecoveryManager
