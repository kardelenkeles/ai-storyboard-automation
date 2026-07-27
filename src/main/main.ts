import { app } from 'electron'

import { createMainWindow } from './createMainWindow'
import { registerAppIpc } from './registerAppIpc'

let mainWindow: ReturnType<typeof createMainWindow> | null = null

const hasSingleInstance = app.requestSingleInstanceLock()

if (!hasSingleInstance) {
  app.quit()
}

app.setName('Video Automation Studio')

app.whenReady().then(async (): Promise<void> => {
  await registerAppIpc()
  mainWindow = createMainWindow()

  app.on('activate', (): void => {
    if (mainWindow === null) {
      mainWindow = createMainWindow()
    }
  })
})

app.on('second-instance', (): void => {
  if (mainWindow !== null) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }

    mainWindow.focus()
  }
})

app.on('window-all-closed', (): void => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})