import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '../shared/ipc/channels'
import type {
  AppEnvironment,
  CreateSceneRequest,
  SettingsDto,
  StorySceneDto,
  StoryboardDto,
  StudioApi,
  UpdatePromptRequest,
} from '../shared/ipc/contracts'

const studioApi: StudioApi = {
  getEnvironment: (): Promise<AppEnvironment> => {
    return ipcRenderer.invoke(IPC_CHANNELS.app.getEnvironment) as Promise<AppEnvironment>
  },
  getStoryboard: (projectId: string): Promise<StoryboardDto> => {
    return ipcRenderer.invoke(IPC_CHANNELS.storyboard.getStoryboard, projectId) as Promise<StoryboardDto>
  },
  createScene: (projectId: string, input: CreateSceneRequest): Promise<StorySceneDto> => {
    return ipcRenderer.invoke(IPC_CHANNELS.storyboard.createScene, projectId, input) as Promise<StorySceneDto>
  },
  deleteScene: (projectId: string, sceneId: string): Promise<void> => {
    return ipcRenderer.invoke(IPC_CHANNELS.storyboard.deleteScene, projectId, sceneId) as Promise<void>
  },
  updatePrompt: (projectId: string, input: UpdatePromptRequest): Promise<StorySceneDto> => {
    return ipcRenderer.invoke(IPC_CHANNELS.storyboard.updatePrompt, projectId, input) as Promise<StorySceneDto>
  },
  getSettings: (): Promise<SettingsDto> => {
    return ipcRenderer.invoke(IPC_CHANNELS.settings.get) as Promise<SettingsDto>
  },
  updateSettings: (patch: Partial<SettingsDto>): Promise<SettingsDto> => {
    return ipcRenderer.invoke(IPC_CHANNELS.settings.update, patch) as Promise<SettingsDto>
  },
  openFileDialog: (options?: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.dialog.openFile, options) as Promise<string | null>
  },
  openFolderDialog: (options?: { title?: string; defaultPath?: string }): Promise<string | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.dialog.openFolder, options) as Promise<string | null>
  },
  validatePath: (p: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.fs.exists, p) as Promise<boolean>
  },
}

contextBridge.exposeInMainWorld('studioApi', studioApi)