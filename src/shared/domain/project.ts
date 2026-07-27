export type SceneStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Scene {
  readonly id: string
  readonly projectId: string
  readonly order: number
  readonly prompt: string
  readonly referenceSceneId?: string
  readonly referenceImagePath?: string
  readonly status: SceneStatus
  readonly outputImagePath?: string
  readonly errorMessage?: string
  readonly createdAt: number
  readonly updatedAt: number
}

export interface Project {
  readonly id: string
  readonly name: string
  readonly createdAt: number
  readonly updatedAt: number
  readonly scenes: readonly Scene[]
}