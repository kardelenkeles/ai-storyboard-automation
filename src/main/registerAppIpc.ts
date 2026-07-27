import path from 'node:path'
import { app, ipcMain } from 'electron'

import { createSettingsService } from '../core/application/settings.service'
import { createStoryboardService } from '../core/application/storyboard.service'
import type { StoryScene } from '../shared/domain/storyboard'
import { IPC_CHANNELS } from '../shared/ipc/channels'
import type {
  AppEnvironment,
  CreateSceneRequest,
  SettingsDto,
  StoryboardDto,
  UpdatePromptRequest,
} from '../shared/ipc/contracts'
import FileSettingsRepository from '../infrastructure/filesystem/settings.repository'
import { StoryboardSqliteRepository } from '../infrastructure/sqlite/storyboard.repository'

const DEFAULT_PROJECT_ID = 'default-project'

const mapScene = (scene: StoryScene) => ({
  id: scene.id,
  title: scene.title,
  prompt: scene.prompt,
  status: scene.status,
  duration: scene.duration,
  referenceSceneId: scene.referenceSceneId,
  generatedImage: scene.generatedImage,
  createdAt: scene.createdAt,
  updatedAt: scene.updatedAt,
})

export async function registerAppIpc(): Promise<void> {
  const userDataRoot = app.getPath('userData')
  const sqlitePath = path.join(userDataRoot, 'database.sqlite')
  const settingsPath = path.join(userDataRoot, 'settings.json')

  const storyboardRepository = await StoryboardSqliteRepository.create(sqlitePath)
  const storyboardService = createStoryboardService({ repository: storyboardRepository })

  const settingsRepository = new FileSettingsRepository(settingsPath)
  await settingsRepository.initialize()
  const settingsService = createSettingsService(settingsRepository)

  ipcMain.handle(IPC_CHANNELS.app.getEnvironment, (): AppEnvironment => ({
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome ?? '',
    electronVersion: process.versions.electron ?? app.getVersion(),
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged
  }))

  ipcMain.handle(IPC_CHANNELS.storyboard.getStoryboard, async (_event, projectId?: string): Promise<StoryboardDto> => {
    const board = await storyboardService.getStoryboard(projectId ?? DEFAULT_PROJECT_ID)
    return {
      projectId: board.projectId,
      scenes: board.scenes.map(mapScene),
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.storyboard.createScene,
    async (_event, projectId: string | undefined, input: CreateSceneRequest) => {
      const scene = await storyboardService.createScene(projectId ?? DEFAULT_PROJECT_ID, {
        title: input.title,
        prompt: input.prompt,
        duration: input.duration,
        referenceSceneId: input.referenceSceneId ?? null,
      })
      return mapScene(scene)
    },
  )

  ipcMain.handle(IPC_CHANNELS.storyboard.deleteScene, async (_event, projectId: string | undefined, sceneId: string): Promise<void> => {
    await storyboardService.deleteScene(projectId ?? DEFAULT_PROJECT_ID, sceneId)
  })

  ipcMain.handle(
    IPC_CHANNELS.storyboard.updatePrompt,
    async (_event, projectId: string | undefined, input: UpdatePromptRequest) => {
      const scene = await storyboardService.editPrompt(projectId ?? DEFAULT_PROJECT_ID, input.sceneId, input.prompt)
      return mapScene(scene)
    },
  )

  ipcMain.handle(IPC_CHANNELS.settings.get, async (): Promise<SettingsDto> => {
    return settingsService.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.settings.update, async (_event, patch: Partial<SettingsDto>): Promise<SettingsDto> => {
    return settingsService.updateSettings(patch)
  })

  ipcMain.handle(IPC_CHANNELS.dialog.openFile, async (_event, options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> => {
    const { dialog } = await import('electron')
    const res = await dialog.showOpenDialog({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      properties: ['openFile']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.dialog.openFolder, async (_event, options?: { title?: string; defaultPath?: string }): Promise<string | null> => {
    const { dialog } = await import('electron')
    const res = await dialog.showOpenDialog({
      title: options?.title,
      defaultPath: options?.defaultPath,
      properties: ['openDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.fs.exists, async (_event, p: string): Promise<boolean> => {
    const fs = await import('fs')
    try {
      await fs.promises.access(p)
      return true
    } catch {
      return false
    }
  })
}