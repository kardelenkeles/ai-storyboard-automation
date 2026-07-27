export type StorySceneStatus = 'draft' | 'ready' | 'queued' | 'rendering' | 'rendered' | 'failed'

export interface StoryScene {
  readonly id: string
  readonly title: string
  readonly prompt: string
  readonly status: StorySceneStatus
  readonly duration: number
  readonly referenceSceneId: string | null
  readonly generatedImage: string | null
  readonly createdAt: number
  readonly updatedAt: number
}

export interface Storyboard {
  readonly projectId: string
  readonly scenes: readonly StoryScene[]
}

export interface StoryboardReference {
  readonly sceneId: string
  readonly title: string
  readonly prompt: string
}

export interface CircularReferencePath {
  readonly sceneIds: readonly string[]
  readonly hasCycle: boolean
}
