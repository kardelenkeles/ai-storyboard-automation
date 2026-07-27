import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  ManagedProject,
  ProjectRecoverySnapshot,
  RecoverableProject,
} from '../../shared/domain/project-manager'
import type { ProjectCatalogRepositoryPort } from '../../core/ports/project-catalog.repository'
import { SqliteConnection } from './sqlite-connection'

interface ProjectRow {
  id: string
  name: string
  slug: string
  root_path: string
  created_at: number
  updated_at: number
  last_opened_at: number | null
  last_autosaved_at: number | null
  deleted_at: number | null
  has_recovery_snapshot: number
}

interface SnapshotRow {
  project_id: string
  snapshot_json: string
  updated_at: number
}

function deserializeProject(row: ProjectRow): ManagedProject {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    rootPath: row.root_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    lastAutosavedAt: row.last_autosaved_at,
    hasRecoverySnapshot: row.has_recovery_snapshot === 1,
  }
}

function deserializeSnapshot(projectId: string, snapshotJson: string): ProjectRecoverySnapshot {
  const parsed = JSON.parse(snapshotJson) as ProjectRecoverySnapshot

  return {
    projectId,
    projectName: parsed.projectName,
    storyboard: parsed.storyboard,
    settings: parsed.settings,
    savedAt: parsed.savedAt,
  }
}

export class ProjectCatalogSqliteRepository implements ProjectCatalogRepositoryPort {
  private constructor(private readonly connection: SqliteConnection) {}

  static async create(databasePath: string): Promise<ProjectCatalogSqliteRepository> {
    const connection = await SqliteConnection.open(databasePath)
    const repository = new ProjectCatalogSqliteRepository(connection)
    await repository.initialize()
    return repository
  }

  async initialize(): Promise<void> {
    await this.connection.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        root_path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_opened_at INTEGER,
        last_autosaved_at INTEGER,
        deleted_at INTEGER,
        has_recovery_snapshot INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_projects_recent
        ON projects (deleted_at, last_opened_at DESC, updated_at DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS project_snapshots (
        project_id TEXT PRIMARY KEY,
        snapshot_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `)
  }

  async saveProject(project: ManagedProject): Promise<void> {
    await this.connection.run(
      `
        INSERT INTO projects (
          id,
          name,
          slug,
          root_path,
          created_at,
          updated_at,
          last_opened_at,
          last_autosaved_at,
          deleted_at,
          has_recovery_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          root_path = excluded.root_path,
          updated_at = excluded.updated_at,
          last_opened_at = excluded.last_opened_at,
          last_autosaved_at = excluded.last_autosaved_at,
          deleted_at = NULL,
          has_recovery_snapshot = excluded.has_recovery_snapshot
      `,
      [
        project.id,
        project.name,
        project.slug,
        project.rootPath,
        project.createdAt,
        project.updatedAt,
        project.lastOpenedAt,
        project.lastAutosavedAt,
        project.hasRecoverySnapshot ? 1 : 0,
      ],
    )
  }

  async getProjectById(projectId: string): Promise<ManagedProject | null> {
    const row = await this.connection.get<ProjectRow>(
      `
        SELECT id, name, slug, root_path, created_at, updated_at, last_opened_at, last_autosaved_at, deleted_at, has_recovery_snapshot
        FROM projects
        WHERE id = ? AND deleted_at IS NULL
      `,
      [projectId],
    )

    return row ? deserializeProject(row) : null
  }

  async getProjectByRootPath(rootPath: string): Promise<ManagedProject | null> {
    const row = await this.connection.get<ProjectRow>(
      `
        SELECT id, name, slug, root_path, created_at, updated_at, last_opened_at, last_autosaved_at, deleted_at, has_recovery_snapshot
        FROM projects
        WHERE root_path = ? AND deleted_at IS NULL
      `,
      [rootPath],
    )

    return row ? deserializeProject(row) : null
  }

  async listRecentProjects(limit: number): Promise<readonly ManagedProject[]> {
    const rows = await this.connection.all<ProjectRow>(
      `
        SELECT id, name, slug, root_path, created_at, updated_at, last_opened_at, last_autosaved_at, deleted_at, has_recovery_snapshot
        FROM projects
        WHERE deleted_at IS NULL
        ORDER BY COALESCE(last_opened_at, updated_at, created_at) DESC, updated_at DESC
        LIMIT ?
      `,
      [limit],
    )

    return rows.map(deserializeProject)
  }

  async listRecoverableProjects(): Promise<readonly RecoverableProject[]> {
    const rows = await this.connection.all<ProjectRow>(
      `
        SELECT id, name, slug, root_path, created_at, updated_at, last_opened_at, last_autosaved_at, deleted_at, has_recovery_snapshot
        FROM projects
        WHERE deleted_at IS NULL AND has_recovery_snapshot = 1
        ORDER BY COALESCE(last_autosaved_at, updated_at, created_at) DESC
      `,
    )

    const recoverable: RecoverableProject[] = []

    for (const row of rows) {
      const snapshotRow = await this.connection.get<SnapshotRow>(
        `SELECT project_id, snapshot_json, updated_at FROM project_snapshots WHERE project_id = ?`,
        [row.id],
      )

      if (snapshotRow === undefined) {
        continue
      }

      recoverable.push({
        project: deserializeProject(row),
        snapshot: deserializeSnapshot(snapshotRow.project_id, snapshotRow.snapshot_json),
      })
    }

    return recoverable
  }

  async saveSnapshot(projectId: string, snapshot: ProjectRecoverySnapshot): Promise<void> {
    const serializedSnapshot = JSON.stringify(snapshot)
    const timestamp = snapshot.savedAt

    await this.connection.run(
      `
        INSERT INTO project_snapshots (project_id, snapshot_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          snapshot_json = excluded.snapshot_json,
          updated_at = excluded.updated_at
      `,
      [projectId, serializedSnapshot, timestamp],
    )

    await this.connection.run(
      `
        UPDATE projects
        SET last_autosaved_at = ?, updated_at = ?, has_recovery_snapshot = 1
        WHERE id = ?
      `,
      [timestamp, timestamp, projectId],
    )
  }

  async getSnapshot(projectId: string): Promise<ProjectRecoverySnapshot | null> {
    const row = await this.connection.get<SnapshotRow>(
      `SELECT project_id, snapshot_json, updated_at FROM project_snapshots WHERE project_id = ?`,
      [projectId],
    )

    if (row === undefined) {
      return null
    }

    return deserializeSnapshot(row.project_id, row.snapshot_json)
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.connection.run(`DELETE FROM project_snapshots WHERE project_id = ?`, [projectId])
    await this.connection.run(`DELETE FROM projects WHERE id = ?`, [projectId])
  }

  async close(): Promise<void> {
    await this.connection.close()
  }
}