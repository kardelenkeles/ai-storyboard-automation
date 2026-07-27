import { randomUUID } from 'node:crypto'

import type {
  ManagedProject,
  ProjectRecoverySnapshot,
  ProjectSnapshotPayload,
  RecoverableProject,
} from '../../shared/domain/project-manager'
import type { ProjectCatalogRepositoryPort } from '../ports/project-catalog.repository'
import type { ProjectFileSystemPort } from '../ports/project-file-system'

export interface ProjectManagerServiceDependencies {
  readonly projectsRoot: string
  readonly catalogRepository: ProjectCatalogRepositoryPort
  readonly fileSystem: ProjectFileSystemPort
  readonly now?: () => number
  readonly idFactory?: () => string
}

export interface ProjectManagerService {
  createProject(name: string): Promise<ManagedProject>
  openProject(projectId: string): Promise<ManagedProject>
  deleteProject(projectId: string): Promise<void>
  renameProject(projectId: string, name: string): Promise<ManagedProject>
  duplicateProject(projectId: string, name?: string): Promise<ManagedProject>
  listRecentProjects(limit?: number): Promise<readonly ManagedProject[]>
  autosaveProject(projectId: string, payload: ProjectSnapshotPayload): Promise<ManagedProject>
  recoverUnfinishedProjects(): Promise<readonly RecoverableProject[]>
}

export function createProjectManagerService(
  dependencies: ProjectManagerServiceDependencies,
): ProjectManagerService {
  const clock = dependencies.now ?? (() => Date.now())
  const idFactory = dependencies.idFactory ?? (() => randomUUID())

  const createSlug = (name: string): string => {
    const normalized = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    return normalized.length > 0 ? normalized : 'project'
  }

  const ensureProjectName = (value: string): string => {
    const normalized = value.trim()

    if (normalized.length === 0) {
      throw new Error('Project name is required')
    }

    return normalized
  }

  const buildProject = (project: ManagedProject, updates: Partial<ManagedProject>): ManagedProject => ({
    ...project,
    ...updates,
  })

  const refreshProject = async (project: ManagedProject): Promise<ManagedProject> => {
    await dependencies.catalogRepository.saveProject(project)
    return project
  }

  return {
    async createProject(name: string): Promise<ManagedProject> {
      const projectName = ensureProjectName(name)
      const projectId = idFactory()
      const projectSlug = createSlug(projectName)
      const createdAt = clock()

      const layout = await dependencies.fileSystem.createProjectDirectory({
        projectsRoot: dependencies.projectsRoot,
        projectId,
        projectName,
        projectSlug,
      })

      const project: ManagedProject = {
        id: projectId,
        name: projectName,
        slug: projectSlug,
        rootPath: layout.rootPath,
        createdAt,
        updatedAt: createdAt,
        lastOpenedAt: createdAt,
        lastAutosavedAt: null,
        hasRecoverySnapshot: false,
      }

      await dependencies.catalogRepository.saveProject(project)
      return project
    },

    async openProject(projectId: string): Promise<ManagedProject> {
      const project = await dependencies.catalogRepository.getProjectById(projectId)
      if (project === null) {
        throw new Error(`Project not found: ${projectId}`)
      }

      const updatedProject = buildProject(project, {
        lastOpenedAt: clock(),
        updatedAt: clock(),
      })

      return refreshProject(updatedProject)
    },

    async deleteProject(projectId: string): Promise<void> {
      const project = await dependencies.catalogRepository.getProjectById(projectId)
      if (project === null) {
        throw new Error(`Project not found: ${projectId}`)
      }

      await dependencies.fileSystem.deleteProjectDirectory(project.rootPath)
      await dependencies.catalogRepository.deleteProject(projectId)
    },

    async renameProject(projectId: string, name: string): Promise<ManagedProject> {
      const project = await dependencies.catalogRepository.getProjectById(projectId)
      if (project === null) {
        throw new Error(`Project not found: ${projectId}`)
      }

      const nextName = ensureProjectName(name)
      const nextSlug = createSlug(nextName)
      const updatedAt = clock()

      const layout = await dependencies.fileSystem.renameProjectDirectory({
        currentRootPath: project.rootPath,
        projectsRoot: dependencies.projectsRoot,
        projectId: project.id,
        projectName: nextName,
        projectSlug: nextSlug,
      })

      const updatedProject = buildProject(project, {
        name: nextName,
        slug: nextSlug,
        rootPath: layout.rootPath,
        updatedAt,
      })

      return refreshProject(updatedProject)
    },

    async duplicateProject(projectId: string, name?: string): Promise<ManagedProject> {
      const sourceProject = await dependencies.catalogRepository.getProjectById(projectId)
      if (sourceProject === null) {
        throw new Error(`Project not found: ${projectId}`)
      }

      const duplicateName = ensureProjectName(name ?? `${sourceProject.name} Copy`)
      const duplicateSlug = createSlug(duplicateName)
      const duplicateId = idFactory()
      const duplicatedAt = clock()

      const layout = await dependencies.fileSystem.duplicateProjectDirectory({
        sourceRootPath: sourceProject.rootPath,
        projectsRoot: dependencies.projectsRoot,
        projectId: duplicateId,
        projectName: duplicateName,
        projectSlug: duplicateSlug,
      })

      const duplicatedProject: ManagedProject = {
        id: duplicateId,
        name: duplicateName,
        slug: duplicateSlug,
        rootPath: layout.rootPath,
        createdAt: duplicatedAt,
        updatedAt: duplicatedAt,
        lastOpenedAt: duplicatedAt,
        lastAutosavedAt: sourceProject.lastAutosavedAt,
        hasRecoverySnapshot: sourceProject.hasRecoverySnapshot,
      }

      await dependencies.catalogRepository.saveProject(duplicatedProject)

      const existingSnapshot = await dependencies.catalogRepository.getSnapshot(sourceProject.id)
      if (existingSnapshot !== null) {
        const clonedSnapshot: ProjectRecoverySnapshot = {
          ...existingSnapshot,
          projectId: duplicateId,
          projectName: duplicateName,
          savedAt: duplicatedAt,
        }

        await dependencies.catalogRepository.saveSnapshot(duplicateId, clonedSnapshot)
      }

      return duplicatedProject
    },

    async listRecentProjects(limit = 10): Promise<readonly ManagedProject[]> {
      return dependencies.catalogRepository.listRecentProjects(limit)
    },

    async autosaveProject(projectId: string, payload: ProjectSnapshotPayload): Promise<ManagedProject> {
      const project = await dependencies.catalogRepository.getProjectById(projectId)
      if (project === null) {
        throw new Error(`Project not found: ${projectId}`)
      }

      const savedAt = clock()
      const snapshot: ProjectRecoverySnapshot = {
        projectId: project.id,
        projectName: project.name,
        storyboard: payload.storyboard,
        settings: payload.settings,
        savedAt,
      }

      await dependencies.fileSystem.writeSnapshot(project.rootPath, snapshot)

      await dependencies.catalogRepository.saveSnapshot(project.id, snapshot)

      const updatedProject = buildProject(project, {
        updatedAt: savedAt,
        lastAutosavedAt: savedAt,
        hasRecoverySnapshot: true,
      })

      return refreshProject(updatedProject)
    },

    async recoverUnfinishedProjects(): Promise<readonly RecoverableProject[]> {
      const candidates = await dependencies.catalogRepository.listRecoverableProjects()

      const recovered: RecoverableProject[] = []

      for (const candidate of candidates) {
        const snapshot = await dependencies.fileSystem.readSnapshot(candidate.project.rootPath)

        recovered.push({
          project: candidate.project,
          snapshot: snapshot ?? candidate.snapshot,
        })
      }

      return recovered
    },
  }
}