import { BrowserWindow, app } from 'electron'
import path from 'path'

export function createMainWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0b1020',
    title: 'Video Automation Studio',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '..', '..', 'preload', 'preload', 'index.js')
    }
  })

  mainWindow.once('ready-to-show', (): void => {
    mainWindow.show()
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  } else {
    mainWindow.loadURL('http://localhost:4444')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  return mainWindow
}