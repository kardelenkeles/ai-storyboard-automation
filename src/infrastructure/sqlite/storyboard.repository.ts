import type { CircularReferencePath, StoryScene, Storyboard, StoryboardReference } from '../../shared/domain/storyboard'
import type { StoryboardRepositoryPort } from '../../core/ports/storyboard.repository'
import { SqliteConnection } from './sqlite-connection'

interface StorySceneRow {
  id: string
  project_id: string
  title: string
  prompt: string
  status: string
  duration: number
  reference_scene_id: string | null
  generated_image: string | null
  position: number
  created_at: number
  updated_at: number
}

function deserializeScene(row: StorySceneRow): StoryScene {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    status: row.status as StoryScene['status'],
    duration: row.duration,
    referenceSceneId: row.reference_scene_id,
    generatedImage: row.generated_image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class StoryboardSqliteRepository implements StoryboardRepositoryPort {
  private constructor(private readonly connection: SqliteConnection) {}

  static async create(databasePath: string): Promise<StoryboardSqliteRepository> {
    const connection = await SqliteConnection.open(databasePath)
    const repository = new StoryboardSqliteRepository(connection)
    await repository.initialize()
    return repository
  }

  async initialize(): Promise<void> {
    await this.connection.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS storyboard_scenes (
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL,
        duration REAL NOT NULL,
        reference_scene_id TEXT,
        generated_image TEXT,
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (project_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_storyboard_scenes_project_position
        ON storyboard_scenes (project_id, position);

      CREATE INDEX IF NOT EXISTS idx_storyboard_scenes_reference
        ON storyboard_scenes (project_id, reference_scene_id);
    `)
  }

  async loadStoryboard(projectId: string): Promise<Storyboard> {
    const scenes = await this.listScenes(projectId)
    return {
      projectId,
      scenes,
    }
  }

  async saveStoryboard(storyboard: Storyboard): Promise<void> {
    await this.connection.exec('BEGIN TRANSACTION')

    try {
      await this.connection.run(`DELETE FROM storyboard_scenes WHERE project_id = ?`, [storyboard.projectId])

      for (let index = 0; index < storyboard.scenes.length; index += 1) {
        const scene = storyboard.scenes[index]
        await this.connection.run(
          `
            INSERT INTO storyboard_scenes (
              id,
              project_id,
              title,
              prompt,
              status,
              duration,
              reference_scene_id,
              generated_image,
              position,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            scene.id,
            storyboard.projectId,
            scene.title,
            scene.prompt,
            scene.status,
            scene.duration,
            scene.referenceSceneId,
            scene.generatedImage,
            index,
            scene.createdAt,
            scene.updatedAt,
          ],
        )
      }

      await this.connection.exec('COMMIT')
    } catch (error) {
      await this.connection.exec('ROLLBACK')
      throw error
    }
  }

  async createScene(projectId: string, scene: StoryScene): Promise<void> {
    const maxPositionRow = await this.connection.get<{ max_position: number | null }>(
      `SELECT MAX(position) AS max_position FROM storyboard_scenes WHERE project_id = ?`,
      [projectId],
    )
    const nextPosition = (maxPositionRow?.max_position ?? -1) + 1

    await this.connection.run(
      `
        INSERT INTO storyboard_scenes (
          id,
          project_id,
          title,
          prompt,
          status,
          duration,
          reference_scene_id,
          generated_image,
          position,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        scene.id,
        projectId,
        scene.title,
        scene.prompt,
        scene.status,
        scene.duration,
        scene.referenceSceneId,
        scene.generatedImage,
        nextPosition,
        scene.createdAt,
        scene.updatedAt,
      ],
    )
  }

  async updateScene(projectId: string, scene: StoryScene): Promise<void> {
    await this.connection.run(
      `
        UPDATE storyboard_scenes
        SET title = ?,
            prompt = ?,
            status = ?,
            duration = ?,
            reference_scene_id = ?,
            generated_image = ?,
            updated_at = ?
        WHERE project_id = ? AND id = ?
      `,
      [
        scene.title,
        scene.prompt,
        scene.status,
        scene.duration,
        scene.referenceSceneId,
        scene.generatedImage,
        scene.updatedAt,
        projectId,
        scene.id,
      ],
    )
  }

  async deleteScene(projectId: string, sceneId: string): Promise<void> {
    await this.connection.exec('BEGIN TRANSACTION')

    try {
      await this.connection.run(`DELETE FROM storyboard_scenes WHERE project_id = ? AND id = ?`, [projectId, sceneId])
      await this.connection.run(
        `UPDATE storyboard_scenes SET reference_scene_id = NULL WHERE project_id = ? AND reference_scene_id = ?`,
        [projectId, sceneId],
      )
      await this.connection.exec('COMMIT')
    } catch (error) {
      await this.connection.exec('ROLLBACK')
      throw error
    }
  }

  async listScenes(projectId: string): Promise<readonly StoryScene[]> {
    const rows = await this.connection.all<StorySceneRow>(
      `
        SELECT id, project_id, title, prompt, status, duration, reference_scene_id, generated_image, position, created_at, updated_at
        FROM storyboard_scenes
        WHERE project_id = ?
        ORDER BY position ASC, created_at ASC
      `,
      [projectId],
    )

    return rows.map(deserializeScene)
  }

  async getScene(projectId: string, sceneId: string): Promise<StoryScene | null> {
    const row = await this.connection.get<StorySceneRow>(
      `
        SELECT id, project_id, title, prompt, status, duration, reference_scene_id, generated_image, position, created_at, updated_at
        FROM storyboard_scenes
        WHERE project_id = ? AND id = ?
      `,
      [projectId, sceneId],
    )

    return row ? deserializeScene(row) : null
  }

  async findReferences(projectId: string, sceneId: string): Promise<readonly StoryboardReference[]> {
    const rows = await this.connection.all<Pick<StorySceneRow, 'id' | 'title' | 'prompt'>>(
      `
        SELECT id, title, prompt
        FROM storyboard_scenes
        WHERE project_id = ? AND reference_scene_id = ?
        ORDER BY position ASC, created_at ASC
      `,
      [projectId, sceneId],
    )

    return rows.map((row) => ({
      sceneId: row.id,
      title: row.title,
      prompt: row.prompt,
    }))
  }

  async detectCircularReferences(projectId: string): Promise<CircularReferencePath[]> {
    const scenes = await this.listScenes(projectId)
    const sceneById = new Map(scenes.map((scene) => [scene.id, scene] as const))
    const cycles: CircularReferencePath[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()

    const walk = (sceneId: string, stack: string[]): void => {
      if (visiting.has(sceneId)) {
        const start = stack.indexOf(sceneId)
        cycles.push({ hasCycle: true, sceneIds: stack.slice(start >= 0 ? start : 0).concat(sceneId) })
        return
      }

      if (visited.has(sceneId)) {
        return
      }

      visiting.add(sceneId)
      stack.push(sceneId)

      const nextSceneId = sceneById.get(sceneId)?.referenceSceneId
      if (nextSceneId !== null && nextSceneId !== undefined && sceneById.has(nextSceneId)) {
        walk(nextSceneId, stack)
      }

      stack.pop()
      visiting.delete(sceneId)
      visited.add(sceneId)
    }

    for (const scene of scenes) {
      walk(scene.id, [])
    }

    return cycles
  }

  async reorderScenes(projectId: string, sceneIdsInOrder: readonly string[]): Promise<void> {
    await this.connection.exec('BEGIN TRANSACTION')

    try {
      for (let index = 0; index < sceneIdsInOrder.length; index += 1) {
        await this.connection.run(
          `UPDATE storyboard_scenes SET position = ?, updated_at = updated_at WHERE project_id = ? AND id = ?`,
          [index, projectId, sceneIdsInOrder[index]],
        )
      }

      await this.connection.exec('COMMIT')
    } catch (error) {
      await this.connection.exec('ROLLBACK')
      throw error
    }
  }

  async close(): Promise<void> {
    await this.connection.close()
  }
}