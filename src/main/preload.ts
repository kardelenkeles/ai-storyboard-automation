import { contextBridge, ipcRenderer } from 'electron'

// Expose a safe version of the API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Add methods that can be called from the renderer
  // These will forward to the actual implementations in the main process
  getProjects: () => ipcRenderer.invoke('get-projects'),
  createProject: (name: string) => ipcRenderer.invoke('create-project', name),
  addScene: (projectId: string, prompt: string) => ipcRenderer.invoke('add-scene', projectId, prompt),
  updateScene: (scene: any) => ipcRenderer.invoke('update-scene', scene),
  renderScene: (sceneId: string, projectId: string) => ipcRenderer.invoke('render-scene', sceneId, projectId),
  renderAllScenes: (projectId: string) => ipcRenderer.invoke('render-all-scenes', projectId),
  generateFinalVideo: (projectId: string) => ipcRenderer.invoke('generate-final-video', projectId),
  exportProject: () => ipcRenderer.invoke('export-project'),
  importProject: () => ipcRenderer.invoke('import-project')
})