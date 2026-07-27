import { app, ipcMain } from 'electron'

import { IPC_CHANNELS } from '../shared/ipc/channels'
import type { AppEnvironment } from '../shared/ipc/contracts'

export function registerAppIpc(): void {
  ipcMain.handle(IPC_CHANNELS.app.getEnvironment, (): AppEnvironment => ({
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome ?? '',
    electronVersion: process.versions.electron ?? app.getVersion(),
    appVersion: app.getVersion(),
    isPackaged: app.isPackaged
  }))
}