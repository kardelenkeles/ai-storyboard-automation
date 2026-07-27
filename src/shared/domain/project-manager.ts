export interface ProjectFolderLayout {
  readonly rootPath: string
  readonly imagesPath: string
  readonly downloadsPath: string
  readonly tempPath: string
  readonly cachePath: string
  readonly storyboardPath: string
  readonly settingsPath: string
  readonly databasePath: string
  readonly autosavePath: string
}

export interface ManagedProject {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly rootPath: string
  readonly createdAt: number
  readonly updatedAt: number
  readonly lastOpenedAt: number | null
  readonly lastAutosavedAt: number | null
  readonly hasRecoverySnapshot: boolean
}

export interface ProjectSnapshotPayload {
  readonly storyboard: Readonly<Record<string, unknown>>
  readonly settings: Readonly<Record<string, unknown>>
}

export interface ProjectRecoverySnapshot extends ProjectSnapshotPayload {
  readonly projectId: string
  readonly projectName: string
  readonly savedAt: number
}

export interface RecoverableProject {
  readonly project: ManagedProject
  readonly snapshot: ProjectRecoverySnapshot
}

export interface CreateProjectDirectoryInput {
  readonly projectsRoot: string
  readonly projectId: string
  readonly projectName: string
  readonly projectSlug: string
}

export interface RenameProjectDirectoryInput {
  readonly currentRootPath: string
  readonly projectsRoot: string
  readonly projectId: string
  readonly projectName: string
  readonly projectSlug: string
}

export interface DuplicateProjectDirectoryInput {
  readonly sourceRootPath: string
  readonly projectsRoot: string
  readonly projectId: string
  readonly projectName: string
  readonly projectSlug: string
}