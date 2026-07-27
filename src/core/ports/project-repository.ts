import type { Project } from '../../shared/domain/project'

export interface ProjectRepositoryPort {
  initialize(): Promise<void>
  getAll(): Promise<readonly Project[]>
  getById(projectId: string): Promise<Project | null>
  save(project: Project): Promise<void>
}