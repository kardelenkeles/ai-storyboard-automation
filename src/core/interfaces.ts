import { Scene, Project } from './common/types'

export interface IProjectRepository {
  initialize(): Promise<void>
  getAll(): Promise<Project[]>
  getById(projectId: string): Promise<Project | null>
  save(project: Project): Promise<void>
}

export interface IAutomationService {
  initialize(): Promise<void>
  renderScene(scene: Scene, project: Project): Promise<{ imagePath: string }>
}

export interface IFFmpegService {
  generateVideo(imagePaths: string[], outputPath: string): Promise<string>
}

export interface IProjectService {
  createProject(name: string): Promise<Project>
  addScene(projectId: string, prompt: string): Promise<Scene>
  updateScene(scene: Scene): Promise<Scene>
  getProject(projectId: string): Promise<Project | null>
  renderProject(projectId: string): Promise<Project>
  generateFinalVideo(projectId: string): Promise<string>
}