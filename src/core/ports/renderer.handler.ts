export type ProgressCallback = (percent: number, info?: Record<string, unknown>) => void

export type RenderHandler = (projectId: string, sceneId: string, onProgress: ProgressCallback, signal?: AbortSignal) => Promise<void>

export default RenderHandler
