import { SqliteConnection } from './sqlite-connection'
import { PromptDocument, PromptRevision } from '../../shared/domain/prompt'
import { PromptRepositoryPort } from '../../core/ports/prompt.repository'

export class PromptSqliteRepository implements PromptRepositoryPort {
  constructor(private db: SqliteConnection) {}

  async initialize(): Promise<void> {
    await this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        version INTEGER NOT NULL,
        lastAutosavedAt INTEGER,
        sourcePromptId TEXT
      );

      CREATE TABLE IF NOT EXISTS prompt_revisions (
        id TEXT PRIMARY KEY,
        promptId TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
        revisionNo INTEGER NOT NULL,
        kind TEXT NOT NULL,
        beforeBody TEXT,
        afterBody TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_revision_no ON prompt_revisions(promptId, revisionNo);

      CREATE TABLE IF NOT EXISTS prompt_autosaves (
        promptId TEXT PRIMARY KEY REFERENCES prompts(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        savedAt INTEGER NOT NULL
      );
    `)
  }

  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    await this.db.exec('BEGIN')
    try {
      const result = await operation()
      await this.db.exec('COMMIT')
      return result
    } catch (err) {
      await this.db.exec('ROLLBACK')
      throw err
    }
  }

  async createPrompt(prompt: PromptDocument): Promise<void> {
    await this.db.run(
      `INSERT INTO prompts (id, projectId, title, body, createdAt, updatedAt, version, lastAutosavedAt, sourcePromptId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prompt.id, prompt.projectId, prompt.title, prompt.body, prompt.createdAt, prompt.updatedAt, prompt.version, prompt.lastAutosavedAt, prompt.sourcePromptId]
    )
  }

  async getPrompt(promptId: string): Promise<PromptDocument | null> {
    const row: any = await this.db.get(`SELECT * FROM prompts WHERE id = ?`, [promptId])
    if (!row) return null
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
      lastAutosavedAt: row.lastAutosavedAt ?? null,
      sourcePromptId: row.sourcePromptId ?? null,
    }
  }

  async getPromptByProjectAndTitle(projectId: string, title: string): Promise<PromptDocument | null> {
    const row: any = await this.db.get(`SELECT * FROM prompts WHERE projectId = ? AND title = ? LIMIT 1`, [projectId, title])
    if (!row) return null
    return {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
      lastAutosavedAt: row.lastAutosavedAt ?? null,
      sourcePromptId: row.sourcePromptId ?? null,
    }
  }

  async savePrompt(prompt: PromptDocument): Promise<void> {
    await this.db.run(
      `UPDATE prompts SET title = ?, body = ?, updatedAt = ?, version = ?, lastAutosavedAt = ?, sourcePromptId = ? WHERE id = ?`,
      [prompt.title, prompt.body, prompt.updatedAt, prompt.version, prompt.lastAutosavedAt, prompt.sourcePromptId, prompt.id]
    )
  }

  async deletePrompt(promptId: string): Promise<void> {
    await this.db.run(`DELETE FROM prompts WHERE id = ?`, [promptId])
  }

  async appendRevision(revision: PromptRevision): Promise<void> {
    await this.db.run(
      `INSERT INTO prompt_revisions (id, promptId, revisionNo, kind, beforeBody, afterBody, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [revision.id, revision.promptId, revision.revisionNo, revision.kind, revision.beforeBody, revision.afterBody, revision.createdAt]
    )
  }

  async listRevisions(promptId: string): Promise<readonly PromptRevision[]> {
    const rows: any[] = await this.db.all(`SELECT * FROM prompt_revisions WHERE promptId = ? ORDER BY revisionNo ASC`, [promptId])
    return rows.map((r: any) => ({ id: r.id, promptId: r.promptId, revisionNo: r.revisionNo, kind: r.kind as any, beforeBody: r.beforeBody ?? null, afterBody: r.afterBody, createdAt: r.createdAt }))
  }

  async getRevision(promptId: string, revisionNo: number): Promise<PromptRevision | null> {
    const r: any = await this.db.get(`SELECT * FROM prompt_revisions WHERE promptId = ? AND revisionNo = ?`, [promptId, revisionNo])
    if (!r) return null
    return { id: r.id, promptId: r.promptId, revisionNo: r.revisionNo, kind: r.kind as any, beforeBody: r.beforeBody ?? null, afterBody: r.afterBody, createdAt: r.createdAt }
  }

  async deleteRevisionsAfter(promptId: string, revisionNo: number): Promise<void> {
    await this.db.run(`DELETE FROM prompt_revisions WHERE promptId = ? AND revisionNo > ?`, [promptId, revisionNo])
  }

  async saveAutosave(promptId: string, body: string, updatedAt: number): Promise<void> {
    await this.db.run(
      `INSERT INTO prompt_autosaves (promptId, body, savedAt) VALUES (?, ?, ?) ON CONFLICT(promptId) DO UPDATE SET body = excluded.body, savedAt = excluded.savedAt`,
      [promptId, body, updatedAt]
    )
  }

  async restoreAutosave(promptId: string): Promise<string | null> {
    const row: any = await this.db.get(`SELECT body FROM prompt_autosaves WHERE promptId = ?`, [promptId])
    return row ? row.body : null
  }
}

export default PromptSqliteRepository
