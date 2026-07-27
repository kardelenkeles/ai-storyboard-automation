import type {
  ManagedProject,
  ProjectRecoverySnapshot,
  RecoverableProject,
} from '../../shared/domain/project-manager'

export interface ProjectCatalogRepositoryPort {
  initialize(): Promise<void>
  saveProject(project: ManagedProject): Promise<void>
  getProjectById(projectId: string): Promise<ManagedProject | null>
  getProjectByRootPath(rootPath: string): Promise<ManagedProject | null>
  listRecentProjects(limit: number): Promise<readonly ManagedProject[]>
  listRecoverableProjects(): Promise<readonly RecoverableProject[]>
  saveSnapshot(projectId: string, snapshot: ProjectRecoverySnapshot): Promise<void>
  getSnapshot(projectId: string): Promise<ProjectRecoverySnapshot | null>
  deleteProject(projectId: string): Promise<void>
}