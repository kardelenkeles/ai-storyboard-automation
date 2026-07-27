import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { Project, Scene } from '@common/types'
import { ProjectRepository } from '@infrastructure/sqlite/ProjectRepository'
import { PlaywrightAutomationService } from '@infrastructure/playwright/PlaywrightAutomationService'
import { FFmpegService } from '@infrastructure/ffmpeg/FFmpegService'
import { autoUpdater } from 'electron-updater'
import fs from 'fs'

class MainApplication {
  private mainWindow: BrowserWindow | null = null
  private projectRepository: ProjectRepository
  private automationService: PlaywrightAutomationService
  private ffmpegService: FFmpegService

  constructor() {
    this.projectRepository = new ProjectRepository()
    this.automationService = new PlaywrightAutomationService()
    this.ffmpegService = new FFmpegService()
    
    this.initializeApp()
  }

  private async initializeApp(): Promise<void> {
    await this.projectRepository.initialize()
    await this.automationService.initialize()
    
    app.whenReady().then(() => {
      this.createWindow()
      this.setupIPC()
      this.setupAutoUpdater()
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    })

    this.mainWindow.loadURL('http://localhost:4444')
    
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })
  }

  private setupIPC(): void {
    if (!this.mainWindow) return

    ipcMain.handle('get-projects', async (): Promise<Project[]> => {
      return await this.projectRepository.getAll()
    })

    ipcMain.handle('create-project', async (_, name: string): Promise<Project> => {
      const project: Project = {
        id: crypto.randomUUID(),
        name,
        createdAt: Date.now(),
        scenes: []
      }
      return await this.projectRepository.save(project)
    })

    ipcMain.handle('add-scene', async (_, projectId: string, prompt: string): Promise<Scene> => {
      const project = await this.projectRepository.getById(projectId)
      if (!project) throw new Error('Project not found')

      const scene: Scene = {
        id: crypto.randomUUID(),
        prompt,
        status: 'pending'
      }
      project.scenes.push(scene)
      await this.projectRepository.save(project)
      return scene
    })

    ipcMain.handle('update-scene', async (_, scene: Scene): Promise<Scene> => {
      const project = await this.projectRepository.getById(scene.id)
      if (!project) throw new Error('Project not found')

      const sceneIndex = project.scenes.findIndex((s: Scene) => s.id === scene.id)
      if (sceneIndex === -1) throw new Error('Scene not found')

      project.scenes[sceneIndex] = scene
      await this.projectRepository.save(project)
      return scene
    })

    ipcMain.handle('render-scene', async (_, sceneId: string, projectId: string): Promise<{ success: boolean; scene?: Scene; error?: string }> => {
      const project = await this.projectRepository.getById(projectId)
      if (!project) throw new Error('Project not found')

      const scene = project.scenes.find((s: Scene) => s.id === sceneId)
      if (!scene) throw new Error('Scene not found')

      scene.status = 'processing'
      await this.projectRepository.save(project)

      try {
        const result = await this.automationService.renderScene(scene, project)
        scene.status = 'completed'
        scene.resultImage = result.imagePath
        await this.projectRepository.save(project)
        return { success: true, scene }
      } catch (error) {
        scene.status = 'failed'
        scene.error = error instanceof Error ? error.message : 'Unknown error'
        await this.projectRepository.save(project)
        return { success: false, error: scene.error }
      }
    })

    ipcMain.handle('render-all-scenes', async (_, projectId: string): Promise<Project> => {
      const project = await this.projectRepository.getById(projectId)
      if (!project) throw new Error('Project not found')

      const pendingScenes = project.scenes.filter((s: Scene) => s.status === 'pending')
      
      for (const scene of pendingScenes) {
        await this.renderSceneSequentially(scene, project)
      }

      return project
    })

    ipcMain.handle('generate-final-video', async (_, projectId: string): Promise<string> => {
      const project = await this.projectRepository.getById(projectId)
      if (!project) throw new Error('Project not found')

      const completedScenes = project.scenes.filter((s: Scene) => s.status === 'completed' && s.resultImage)
      if (completedScenes.length === 0) {
        throw new Error('No completed scenes to generate video')
      }

      const videoPath = await this.ffmpegService.generateVideo(
        completedScenes.map((s: Scene) => s.resultImage!),
        `output_${projectId}.mp4`
      )

      return videoPath
    })

    ipcMain.handle('export-project', async (_, projectId: string): Promise<string> => {
      const project = await this.projectRepository.getById(projectId)
      if (!project) throw new Error('Project not found')

      const filePath = await dialog.showSaveDialog(this.mainWindow!, {
        title: 'Export Project',
        defaultPath: `${project.name}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (!filePath.canceled) {
        fs.writeFileSync(filePath.filePath, JSON.stringify(project, null, 2))
      }

      return filePath.filePath
    })

    ipcMain.handle('import-project', async (): Promise<Project | null> => {
      const filePath = await dialog.showOpenDialog(this.mainWindow!, {
        title: 'Import Project',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
      })

      if (filePath.canceled || filePath.filePaths.length === 0) {
        return null
      }

      const data = JSON.parse(fs.readFileSync(filePath.filePaths[0], 'utf8'))
      return await this.projectRepository.save(data)
    })
  }

  private async renderSceneSequentially(scene: Scene, project: Project): Promise<void> {
    const projectId = project.id
    const sceneId = scene.id

    try {
      const result = await this.automationService.renderScene(scene, project)
      scene.status = 'completed'
      scene.resultImage = result.imagePath
      await this.projectRepository.save(project)
    } catch (error) {
      scene.status = 'failed'
      scene.error = error instanceof Error ? error.message : 'Unknown error'
      await this.projectRepository.save(project)
      throw error
    }
  }

  private setupAutoUpdater(): void {
    autoUpdater.checkForUpdates()
  }
}

new MainApplication()