export type PromptChangeKind = 'create' | 'edit' | 'replace' | 'duplicate'

export interface PromptDocument {
  readonly id: string
  readonly projectId: string
  readonly title: string
  readonly body: string
  readonly createdAt: number
  readonly updatedAt: number
  readonly version: number
  readonly lastAutosavedAt: number | null
  readonly sourcePromptId: string | null
}

export interface PromptRevision {
  readonly id: string
  readonly promptId: string
  readonly revisionNo: number
  readonly kind: PromptChangeKind
  readonly beforeBody: string | null
  readonly afterBody: string
  readonly createdAt: number
}

export interface PromptSearchMatch {
  readonly start: number
  readonly end: number
  readonly value: string
}

export interface PromptMetrics {
  readonly characterCount: number
  readonly lineCount: number
  readonly wordCount: number
  readonly tokenEstimate: number
}

export interface PromptEditInput {
  readonly promptId: string
  readonly title?: string
  readonly body?: string
}

export interface PromptReplaceInput {
  readonly promptId: string
  readonly searchText: string
  readonly replaceText: string
  readonly replaceAll?: boolean
}

export interface PromptDuplicateResult {
  readonly prompt: PromptDocument
  readonly revision: PromptRevision
}