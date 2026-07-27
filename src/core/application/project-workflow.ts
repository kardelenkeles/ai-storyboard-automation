import type { Project, Scene } from '../../shared/domain/project'

export interface ProjectWorkflowService {
  createProject(name: string): Promise<Project>
  renameProject(projectId: string, name: string): Promise<Project>
  addScene(projectId: string, prompt: string, referenceSceneId?: string): Promise<Scene>
  updateScene(scene: Scene): Promise<Scene>
  renderProject(projectId: string): Promise<Project>
  retryScene(projectId: string, sceneId: string): Promise<Project>
  generateFinalVideo(projectId: string): Promise<string>
}