import type { PromptDocument, PromptRevision, PromptSearchMatch } from '../../shared/domain/prompt'

export interface PromptRepositoryPort {
  initialize(): Promise<void>
  runInTransaction<T>(operation: () => Promise<T>): Promise<T>
  createPrompt(prompt: PromptDocument): Promise<void>
  getPrompt(promptId: string): Promise<PromptDocument | null>
  getPromptByProjectAndTitle(projectId: string, title: string): Promise<PromptDocument | null>
  savePrompt(prompt: PromptDocument): Promise<void>
  deletePrompt(promptId: string): Promise<void>
  appendRevision(revision: PromptRevision): Promise<void>
  listRevisions(promptId: string): Promise<readonly PromptRevision[]>
  getRevision(promptId: string, revisionNo: number): Promise<PromptRevision | null>
  deleteRevisionsAfter(promptId: string, revisionNo: number): Promise<void>
  saveAutosave(promptId: string, body: string, updatedAt: number): Promise<void>
  restoreAutosave(promptId: string): Promise<string | null>
}