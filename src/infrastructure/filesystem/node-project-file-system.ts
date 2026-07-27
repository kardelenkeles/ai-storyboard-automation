import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  CreateProjectDirectoryInput,
  DuplicateProjectDirectoryInput,
  ProjectFolderLayout,
  ProjectRecoverySnapshot,
  RenameProjectDirectoryInput,
} from '../../shared/domain/project-manager'
import type { ProjectFileSystemPort } from '../../core/ports/project-file-system'
import { SqliteConnection } from '../sqlite/sqlite-connection'

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function sanitizeFolderName(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized.length > 0 ? normalized : 'project'
}

async function resolveUniqueDirectoryPath(basePath: string): Promise<string> {
  if (!(await pathExists(basePath))) {
    return basePath
  }

  const directory = path.dirname(basePath)
  const extension = path.extname(basePath)
  const name = path.basename(basePath, extension)

  let index = 2
  let candidate = `${name}-${index}${extension}`

  while (await pathExists(path.join(directory, candidate))) {
    index += 1
    candidate = `${name}-${index}${extension}`
  }

  return path.join(directory, candidate)
}

async function ensureDirectoryStructure(rootPath: string): Promise<ProjectFolderLayout> {
  const imagesPath = path.join(rootPath, 'images')
  const downloadsPath = path.join(rootPath, 'downloads')
  const tempPath = path.join(rootPath, 'temp')
  const cachePath = path.join(rootPath, 'cache')

  await Promise.all([
    fs.mkdir(imagesPath, { recursive: true }),
    fs.mkdir(downloadsPath, { recursive: true }),
    fs.mkdir(tempPath, { recursive: true }),
    fs.mkdir(cachePath, { recursive: true }),
  ])

  return {
    rootPath,
    imagesPath,
    downloadsPath,
    tempPath,
    cachePath,
    storyboardPath: path.join(rootPath, 'storyboard.json'),
    settingsPath: path.join(rootPath, 'settings.json'),
    databasePath: path.join(rootPath, 'database.sqlite'),
    autosavePath: path.join(cachePath, 'autosave.json'),
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function patchProjectManifestFiles(rootPath: string, projectId: string, projectName: string): Promise<void> {
  const storyboardPath = path.join(rootPath, 'storyboard.json')
  const settingsPath = path.join(rootPath, 'settings.json')

  const storyboard = await readJson<Record<string, unknown>>(storyboardPath)
  const settings = await readJson<Record<string, unknown>>(settingsPath)

  await writeJson(storyboardPath, {
    ...(storyboard ?? {}),
    projectId,
    projectName,
  })

  await writeJson(settingsPath, {
    ...(settings ?? {}),
    projectId,
    projectName,
  })
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function initializeProjectDatabase(databasePath: string, projectId: string, projectName: string): Promise<void> {
  const connection = await SqliteConnection.open(databasePath)

  try {
    await connection.exec(`
      CREATE TABLE IF NOT EXISTS project_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    await connection.run(
      `
        INSERT INTO project_state (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ['projectId', projectId],
    )

    await connection.run(
      `
        INSERT INTO project_state (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ['projectName', projectName],
    )

    await connection.run(
      `
        INSERT INTO project_state (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      ['schemaVersion', '1'],
    )
  } finally {
    await connection.close()
  }
}

async function updateProjectDatabaseMetadata(databasePath: string, projectId: string, projectName: string): Promise<void> {
  const connection = await SqliteConnection.open(databasePath)

  try {
    await connection.exec(`
      CREATE TABLE IF NOT EXISTS project_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    await connection.run(
      `INSERT INTO project_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['projectId', projectId],
    )

    await connection.run(
      `INSERT INTO project_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['projectName', projectName],
    )

    await connection.run(
      `INSERT INTO project_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['schemaVersion', '1'],
    )
  } finally {
    await connection.close()
  }
}

async function copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
  await fs.cp(sourcePath, targetPath, { recursive: true })
}

export class NodeProjectFileSystem implements ProjectFileSystemPort {
  async createProjectDirectory(input: CreateProjectDirectoryInput): Promise<ProjectFolderLayout> {
    const folderName = sanitizeFolderName(input.projectSlug)
    const rootPath = await resolveUniqueDirectoryPath(path.join(input.projectsRoot, folderName))
    const layout = await ensureDirectoryStructure(rootPath)

    await writeJson(layout.storyboardPath, {
      projectId: input.projectId,
      projectName: input.projectName,
      scenes: [],
    })

    await writeJson(layout.settingsPath, {
      projectId: input.projectId,
      projectName: input.projectName,
      version: 1,
    })

    await initializeProjectDatabase(layout.databasePath, input.projectId, input.projectName)
    return layout
  }

  async renameProjectDirectory(input: RenameProjectDirectoryInput): Promise<ProjectFolderLayout> {
    const folderName = sanitizeFolderName(input.projectSlug)
    const targetRootPath = await resolveUniqueDirectoryPath(path.join(input.projectsRoot, folderName))

    await fs.rename(input.currentRootPath, targetRootPath)
    const layout = await ensureDirectoryStructure(targetRootPath)

    await patchProjectManifestFiles(layout.rootPath, input.projectId, input.projectName)

    await updateProjectDatabaseMetadata(layout.databasePath, input.projectId, input.projectName)
    return layout
  }

  async duplicateProjectDirectory(input: DuplicateProjectDirectoryInput): Promise<ProjectFolderLayout> {
    const folderName = sanitizeFolderName(input.projectSlug)
    const targetRootPath = await resolveUniqueDirectoryPath(path.join(input.projectsRoot, folderName))

    await copyDirectory(input.sourceRootPath, targetRootPath)
    const layout = await ensureDirectoryStructure(targetRootPath)

    await patchProjectManifestFiles(layout.rootPath, input.projectId, input.projectName)

    await initializeProjectDatabase(layout.databasePath, input.projectId, input.projectName)
    return layout
  }

  async deleteProjectDirectory(rootPath: string): Promise<void> {
    await fs.rm(rootPath, { force: true, recursive: true })
  }

  async writeSnapshot(rootPath: string, snapshot: ProjectRecoverySnapshot): Promise<void> {
    const layout = await ensureDirectoryStructure(rootPath)

    await writeJson(layout.storyboardPath, snapshot.storyboard)
    await writeJson(layout.settingsPath, snapshot.settings)
    await writeJson(layout.autosavePath, snapshot)
    await updateProjectDatabaseMetadata(layout.databasePath, snapshot.projectId, snapshot.projectName)
  }

  async readSnapshot(rootPath: string): Promise<ProjectRecoverySnapshot | null> {
    const autosavePath = path.join(rootPath, 'cache', 'autosave.json')

    try {
      const raw = await fs.readFile(autosavePath, 'utf8')
      return JSON.parse(raw) as ProjectRecoverySnapshot
    } catch {
      return null
    }
  }
}