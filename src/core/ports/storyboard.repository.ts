import type { CircularReferencePath, StoryScene, Storyboard, StoryboardReference } from '../../shared/domain/storyboard'

export interface StoryboardRepositoryPort {
  initialize(): Promise<void>
  loadStoryboard(projectId: string): Promise<Storyboard>
  saveStoryboard(storyboard: Storyboard): Promise<void>
  createScene(projectId: string, scene: StoryScene): Promise<void>
  updateScene(projectId: string, scene: StoryScene): Promise<void>
  deleteScene(projectId: string, sceneId: string): Promise<void>
  listScenes(projectId: string): Promise<readonly StoryScene[]>
  getScene(projectId: string, sceneId: string): Promise<StoryScene | null>
  findReferences(projectId: string, sceneId: string): Promise<readonly StoryboardReference[]>
  detectCircularReferences(projectId: string): Promise<CircularReferencePath[]>
  reorderScenes(projectId: string, sceneIdsInOrder: readonly string[]): Promise<void>
}