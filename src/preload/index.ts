import { contextBridge, ipcRenderer } from 'electron'

import { IPC_CHANNELS } from '../shared/ipc/channels'
import type { AppEnvironment, StudioApi } from '../shared/ipc/contracts'

const studioApi: StudioApi = {
  getEnvironment: (): Promise<AppEnvironment> => {
    return ipcRenderer.invoke(IPC_CHANNELS.app.getEnvironment) as Promise<AppEnvironment>
  }
}

contextBridge.exposeInMainWorld('studioApi', studioApi)