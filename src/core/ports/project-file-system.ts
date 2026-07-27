import type {
  CreateProjectDirectoryInput,
  DuplicateProjectDirectoryInput,
  ProjectFolderLayout,
  ProjectRecoverySnapshot,
  RenameProjectDirectoryInput,
} from '../../shared/domain/project-manager'

export interface ProjectFileSystemPort {
  createProjectDirectory(input: CreateProjectDirectoryInput): Promise<ProjectFolderLayout>
  renameProjectDirectory(input: RenameProjectDirectoryInput): Promise<ProjectFolderLayout>
  duplicateProjectDirectory(input: DuplicateProjectDirectoryInput): Promise<ProjectFolderLayout>
  deleteProjectDirectory(rootPath: string): Promise<void>
  writeSnapshot(layout: ProjectFolderLayout, snapshot: ProjectRecoverySnapshot): Promise<void>
  readSnapshot(rootPath: string): Promise<ProjectRecoverySnapshot | null>
}