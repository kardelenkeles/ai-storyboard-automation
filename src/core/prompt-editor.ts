export type {
  PromptChangeKind,
  PromptDocument,
  PromptDuplicateResult,
  PromptEditInput,
  PromptMetrics,
  PromptRevision,
  PromptReplaceInput,
  PromptSearchMatch,
} from '../shared/domain/prompt'

export type { PromptEditorService, PromptEditorServiceDependencies } from './application/prompt-editor.service'
export { createPromptEditorService } from './application/prompt-editor.service'