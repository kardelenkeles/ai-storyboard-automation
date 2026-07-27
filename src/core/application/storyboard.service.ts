import { randomUUID } from 'node:crypto'

import type { CircularReferencePath, StoryScene, StorySceneStatus, Storyboard, StoryboardReference } from '../../shared/domain/storyboard'
import type { StoryboardRepositoryPort } from '../ports/storyboard.repository'

export interface StoryboardServiceDependencies {
  readonly repository: StoryboardRepositoryPort
  readonly now?: () => number
  readonly idFactory?: () => string
}

export interface StoryboardService {
  createScene(projectId: string, input: CreateSceneInput): Promise<StoryScene>
  deleteScene(projectId: string, sceneId: string): Promise<void>
  duplicateScene(projectId: string, sceneId: string): Promise<StoryScene>
  reorderScenes(projectId: string, sceneIdsInOrder: readonly string[]): Promise<Storyboard>
  editPrompt(projectId: string, sceneId: string, prompt: string): Promise<StoryScene>
  editDuration(projectId: string, sceneId: string, duration: number): Promise<StoryScene>
  findReferences(projectId: string, sceneId: string): Promise<readonly StoryboardReference[]>
  detectCircularReferences(projectId: string): Promise<readonly CircularReferencePath[]>
  getStoryboard(projectId: string): Promise<Storyboard>
}

export interface CreateSceneInput {
  readonly title: string
  readonly prompt: string
  readonly duration: number
  readonly referenceSceneId?: string | null
  readonly status?: StorySceneStatus
  readonly generatedImage?: string | null
}

export function createStoryboardService(dependencies: StoryboardServiceDependencies): StoryboardService {
  const clock = dependencies.now ?? (() => Date.now())
  const idFactory = dependencies.idFactory ?? (() => randomUUID())

  const ensureText = (value: string, fieldName: string): string => {
    const normalized = value.trim()

    if (normalized.length === 0) {
      throw new Error(`${fieldName} is required`)
    }

    return normalized
  }

  const ensureDuration = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('Duration must be greater than zero')
    }

    return value
  }

  const ensureReferenceExists = async (projectId: string, referenceSceneId: string | null | undefined): Promise<void> => {
    if (referenceSceneId === null || referenceSceneId === undefined) {
      return
    }

    const referencedScene = await dependencies.repository.getScene(projectId, referenceSceneId)
    if (referencedScene === null) {
      throw new Error(`Reference scene not found: ${referenceSceneId}`)
    }
  }

  const updateScene = async (
    projectId: string,
    sceneId: string,
    updater: (scene: StoryScene) => StoryScene,
  ): Promise<StoryScene> => {
    const scene = await dependencies.repository.getScene(projectId, sceneId)

    if (scene === null) {
      throw new Error(`Scene not found: ${sceneId}`)
    }

    const updatedScene = updater(scene)
    await dependencies.repository.updateScene(projectId, updatedScene)
    return updatedScene
  }

  const detectCycles = (storyboard: Storyboard): CircularReferencePath[] => {
    const sceneById = new Map(storyboard.scenes.map((scene) => [scene.id, scene] as const))
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const cycles: CircularReferencePath[] = []

    const walk = (sceneId: string, path: string[]): void => {
      if (visiting.has(sceneId)) {
        const cycleStartIndex = path.indexOf(sceneId)
        const cycle = cycleStartIndex >= 0 ? path.slice(cycleStartIndex).concat(sceneId) : [...path, sceneId]

        cycles.push({ hasCycle: true, sceneIds: cycle })
        return
      }

      if (visited.has(sceneId)) {
        return
      }

      visiting.add(sceneId)
      path.push(sceneId)

      const current = sceneById.get(sceneId)
      const nextSceneId = current?.referenceSceneId ?? null

      if (nextSceneId !== null && sceneById.has(nextSceneId)) {
        walk(nextSceneId, path)
      }

      path.pop()
      visiting.delete(sceneId)
      visited.add(sceneId)
    }

    for (const scene of storyboard.scenes) {
      walk(scene.id, [])
    }

    return cycles
  }

  return {
    async createScene(projectId: string, input: CreateSceneInput): Promise<StoryScene> {
      const title = ensureText(input.title, 'Title')
      const prompt = ensureText(input.prompt, 'Prompt')
      const duration = ensureDuration(input.duration)
      const referenceSceneId = input.referenceSceneId ?? null

      await ensureReferenceExists(projectId, referenceSceneId)

      const timestamp = clock()
      const scene: StoryScene = {
        id: idFactory(),
        title,
        prompt,
        status: input.status ?? 'draft',
        duration,
        referenceSceneId,
        generatedImage: input.generatedImage ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      await dependencies.repository.createScene(projectId, scene)
      return scene
    },

    async deleteScene(projectId: string, sceneId: string): Promise<void> {
      const scene = await dependencies.repository.getScene(projectId, sceneId)
      if (scene === null) {
        throw new Error(`Scene not found: ${sceneId}`)
      }

      const references = await dependencies.repository.findReferences(projectId, sceneId)
      if (references.length > 0) {
        throw new Error(`Scene is referenced by ${references.length} other scene(s)`)
      }

      await dependencies.repository.deleteScene(projectId, sceneId)
    },

    async duplicateScene(projectId: string, sceneId: string): Promise<StoryScene> {
      const scene = await dependencies.repository.getScene(projectId, sceneId)
      if (scene === null) {
        throw new Error(`Scene not found: ${sceneId}`)
      }

      const timestamp = clock()
      const duplicatedScene: StoryScene = {
        ...scene,
        id: idFactory(),
        title: `${scene.title} Copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
      }

      await dependencies.repository.createScene(projectId, duplicatedScene)
      return duplicatedScene
    },

    async reorderScenes(projectId: string, sceneIdsInOrder: readonly string[]): Promise<Storyboard> {
      const storyboard = await dependencies.repository.loadStoryboard(projectId)
      const sceneIds = new Set(storyboard.scenes.map((scene) => scene.id))

      if (sceneIdsInOrder.length !== sceneIds.size) {
        throw new Error('Reorder list must include every scene exactly once')
      }

      for (const sceneId of sceneIdsInOrder) {
        if (!sceneIds.has(sceneId)) {
          throw new Error(`Unknown scene in reorder list: ${sceneId}`)
        }
      }

      await dependencies.repository.reorderScenes(projectId, sceneIdsInOrder)
      return dependencies.repository.loadStoryboard(projectId)
    },

    async editPrompt(projectId: string, sceneId: string, prompt: string): Promise<StoryScene> {
      const nextPrompt = ensureText(prompt, 'Prompt')

      return updateScene(projectId, sceneId, (scene) => ({
        ...scene,
        prompt: nextPrompt,
        updatedAt: clock(),
      }))
    },

    async editDuration(projectId: string, sceneId: string, duration: number): Promise<StoryScene> {
      const nextDuration = ensureDuration(duration)

      return updateScene(projectId, sceneId, (scene) => ({
        ...scene,
        duration: nextDuration,
        updatedAt: clock(),
      }))
    },

    async findReferences(projectId: string, sceneId: string): Promise<readonly StoryboardReference[]> {
      return dependencies.repository.findReferences(projectId, sceneId)
    },

    async detectCircularReferences(projectId: string): Promise<readonly CircularReferencePath[]> {
      const storyboard = await dependencies.repository.loadStoryboard(projectId)
      return detectCycles(storyboard)
    },

    async getStoryboard(projectId: string): Promise<Storyboard> {
      return dependencies.repository.loadStoryboard(projectId)
    },
  }
}
