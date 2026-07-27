export interface DownloadRequest {
  readonly url: string
  readonly suggestedFilename?: string | null
}

export interface DownloadMetadata {
  readonly id: string
  readonly url: string
  readonly filename: string
  readonly destPath: string
  readonly tempPath: string
  readonly startedAt: number | null
  readonly finishedAt: number | null
  readonly status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  readonly size?: number | null
  readonly downloaded: number
  readonly sha256?: string | null
  readonly error?: string | null
}

export interface DownloadManager {
  initialize(): Promise<void>
  download(projectRoot: string, request: DownloadRequest): Promise<DownloadMetadata>
  cancel(id: string): Promise<void>
  list(projectRoot: string): Promise<readonly DownloadMetadata[]>
  get(projectRoot: string, id: string): Promise<DownloadMetadata | null>
}

export default DownloadManager
