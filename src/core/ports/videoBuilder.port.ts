export interface VideoBuildOptions {
  readonly images: readonly { path: string; duration: number }[]
  readonly outputPath: string
  readonly transitionDuration?: number
  readonly fps?: number
  readonly resolution?: string // e.g. '1920x1080'
  readonly narrationPath?: string | null
  readonly musicPath?: string | null
}

export interface VideoBuildProgress {
  readonly percent?: number
  readonly time?: number
  readonly message?: string
}

export interface VideoBuildResult {
  readonly outputPath: string
  readonly durationMs: number
}

export interface VideoBuilder {
  initialize(): Promise<void>
  build(options: VideoBuildOptions, onProgress?: (p: VideoBuildProgress) => void): Promise<VideoBuildResult>
}

export default VideoBuilder
