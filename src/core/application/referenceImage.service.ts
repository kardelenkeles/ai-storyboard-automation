import type { StoryScene } from '../../shared/domain/storyboard'
import type { StoryboardRepositoryPort } from '../ports/storyboard.repository'
import type { PlaywrightAutomation } from '../ports/playwrightAutomation.port'

export interface ReferenceImageServiceDependencies {
  readonly repository: StoryboardRepositoryPort
}

export interface ReferenceResolveResult {
  readonly filePath: string
  readonly chain: readonly string[]
}

export interface ReferenceImageService {
  resolveReference(projectId: string, sceneId: string): Promise<ReferenceResolveResult | null>
  detectMissingReferences(projectId: string): Promise<readonly { sceneId: string; missingRefId: string }[]>
  attachReferenceToFlow(projectId: string, sceneId: string, playwright: PlaywrightAutomation, targetSelector?: string): Promise<void>
}

export function createReferenceImageService(deps: ReferenceImageServiceDependencies): ReferenceImageService {
  const resolveReference = async (projectId: string, sceneId: string): Promise<ReferenceResolveResult | null> => {
    const start = await deps.repository.getScene(projectId, sceneId)
    if (!start) throw new Error(`Scene not found: ${sceneId}`)

    let currentRef = start.referenceSceneId
    if (!currentRef) return null

    const chain: string[] = []
    const visited = new Set<string>()

    while (currentRef) {
      if (visited.has(currentRef)) {
        throw new Error(`Circular reference detected: ${[...visited, currentRef].join(' -> ')}`)
      }
      visited.add(currentRef)
      const referenced = await deps.repository.getScene(projectId, currentRef)
      if (!referenced) throw new Error(`Missing referenced scene: ${currentRef}`)
      chain.push(currentRef)
      if (referenced.generatedImage) {
        return { filePath: referenced.generatedImage, chain }
      }
      currentRef = referenced.referenceSceneId
    }

    // no image found in chain
    throw new Error(`No generated image found for reference chain: ${chain.join(' -> ')}`)
  }

  const detectMissingReferences = async (projectId: string): Promise<readonly { sceneId: string; missingRefId: string }[]> => {
    const storyboard = await deps.repository.loadStoryboard(projectId)
    const missing: { sceneId: string; missingRefId: string }[] = []

    for (const scene of storyboard.scenes) {
      const refId = scene.referenceSceneId
      if (!refId) continue
      const referenced = await deps.repository.getScene(projectId, refId)
      if (!referenced) missing.push({ sceneId: scene.id, missingRefId: refId })
    }

    return missing
  }

  const attachReferenceToFlow = async (projectId: string, sceneId: string, playwright: PlaywrightAutomation, targetSelector?: string): Promise<void> => {
    const resolved = await resolveReference(projectId, sceneId)
    if (!resolved) return
    // perform drag & drop
    await playwright.dragAndDropImage(resolved.filePath, targetSelector)
  }

  return { resolveReference, detectMissingReferences, attachReferenceToFlow }
}

export default createReferenceImageService
