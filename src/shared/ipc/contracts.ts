export interface AppEnvironment {
  readonly platform: string
  readonly arch: string
  readonly appVersion: string
  readonly electronVersion: string
  readonly chromeVersion: string
  readonly nodeVersion: string
  readonly isPackaged: boolean
}

export interface StorySceneDto {
  readonly id: string
  readonly title: string
  readonly prompt: string
  readonly status: string
  readonly duration: number
  readonly referenceSceneId: string | null
  readonly generatedImage: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface StoryboardDto {
  readonly projectId: string
  readonly scenes: readonly StorySceneDto[]
}

export interface CreateSceneRequest {
  readonly title: string
  readonly prompt: string
  readonly duration: number
  readonly referenceSceneId?: string | null
}

export interface UpdatePromptRequest {
  readonly sceneId: string
  readonly prompt: string
}

export interface SettingsDto {
  readonly chromeExecutablePath: string | null
  readonly chromeProfilePath: string | null
  readonly automation: {
    readonly delayBetweenActionsMs: number
    readonly retryCount: number
  }
  readonly flowUrl: string
  readonly downloadFolder: string
  readonly ffmpegPath: string | null
  readonly theme: 'light' | 'dark' | 'system'
  readonly autosaveEnabled: boolean
  readonly autosaveIntervalMs: number
  readonly rendering: {
    readonly transitionDuration: number
    readonly fps: number
    readonly resolution: string
  }
  readonly sqliteLocation: string | null
}

export interface StudioApi {
  getEnvironment(): Promise<AppEnvironment>
  getStoryboard(projectId: string): Promise<StoryboardDto>
  createScene(projectId: string, input: CreateSceneRequest): Promise<StorySceneDto>
  deleteScene(projectId: string, sceneId: string): Promise<void>
  updatePrompt(projectId: string, input: UpdatePromptRequest): Promise<StorySceneDto>
  getSettings(): Promise<SettingsDto>
  updateSettings(patch: Partial<SettingsDto>): Promise<SettingsDto>
  openFileDialog?(options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null>
  openFolderDialog?(options?: { title?: string; defaultPath?: string }): Promise<string | null>
  validatePath?(path: string): Promise<boolean>
}