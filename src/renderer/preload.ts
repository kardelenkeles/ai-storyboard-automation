import { contextBridge, ipcRenderer } from 'electron'

// Type definitions for the API
export interface Scene {
  id: string
  prompt: string
  referenceImage?: string
  referenceSceneId?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  resultImage?: string
  error?: string
}

export interface Project {
  id: string
  name: string
  createdAt: number
  scenes: Scene[]
}

export interface ElectronAPI {
  getProjects: () => Promise<Project[]>
  createProject: (name: string) => Promise<Project>
  addScene: (projectId: string, prompt: string) => Promise<Scene>
  updateScene: (scene: Scene) => Promise<Scene>
  renderScene: (sceneId: string, projectId: string) => Promise<{ success: boolean; scene?: Scene; error?: string }>
  renderAllScenes: (projectId: string) => Promise<Project>
  generateFinalVideo: (projectId: string) => Promise<string>
  exportProject: () => Promise<any>
  importProject: () => Promise<Project | null>
}

// Expose a safe version of the API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  createProject: (name: string) => ipcRenderer.invoke('create-project', name),
  addScene: (projectId: string, prompt: string) => ipcRenderer.invoke('add-scene', projectId, prompt),
  updateScene: (scene: Scene) => ipcRenderer.invoke('update-scene', scene),
  renderScene: (sceneId: string, projectId: string) => ipcRenderer.invoke('render-scene', sceneId, projectId),
  renderAllScenes: (projectId: string) => ipcRenderer.invoke('render-all-scenes', projectId),
  generateFinalVideo: (projectId: string) => ipcRenderer.invoke('generate-final-video', projectId),
  exportProject: () => ipcRenderer.invoke('export-project'),
  importProject: () => ipcRenderer.invoke('import-project')
})