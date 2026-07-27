import { randomUUID } from 'node:crypto'

import type {
  PromptDocument,
  PromptDuplicateResult,
  PromptEditInput,
  PromptMetrics,
  PromptReplaceInput,
  PromptRevision,
  PromptSearchMatch,
} from '../../shared/domain/prompt'
import type { PromptRepositoryPort } from '../ports/prompt.repository'

export interface PromptEditorServiceDependencies {
  readonly repository: PromptRepositoryPort
  readonly now?: () => number
  readonly idFactory?: () => string
}

export interface PromptEditorService {
  createPrompt(projectId: string, title: string, body: string): Promise<PromptDocument>
  editPrompt(input: PromptEditInput): Promise<PromptDocument>
  replace(input: PromptReplaceInput): Promise<PromptDocument>
  duplicatePrompt(promptId: string, title?: string): Promise<PromptDuplicateResult>
  deletePrompt(promptId: string): Promise<void>
  searchPrompt(promptId: string, query: string): Promise<readonly PromptSearchMatch[]>
  getHistory(promptId: string): Promise<readonly PromptRevision[]>
  undo(promptId: string): Promise<PromptDocument>
  redo(promptId: string): Promise<PromptDocument>
  calculateMetrics(text: string): PromptMetrics
  autosave(promptId: string, body: string): Promise<void>
  restoreAutosave(promptId: string): Promise<string | null>
}

export function createPromptEditorService(dependencies: PromptEditorServiceDependencies): PromptEditorService {
  const clock = dependencies.now ?? (() => Date.now())
  const idFactory = dependencies.idFactory ?? (() => randomUUID())

  const ensureTitle = (value: string): string => {
    const normalized = value.trim()

    if (normalized.length === 0) {
      throw new Error('Title is required')
    }

    return normalized
  }

  const ensureBody = (value: string): string => value

  const ensurePrompt = async (promptId: string): Promise<PromptDocument> => {
    const prompt = await dependencies.repository.getPrompt(promptId)

    if (prompt === null) {
      throw new Error(`Prompt not found: ${promptId}`)
    }

    return prompt
  }

  const countWords = (text: string): number => {
    const words = text.trim().split(/\s+/).filter((word) => word.length > 0)
    return words.length
  }

  const calculateMetrics = (text: string): PromptMetrics => ({
    characterCount: text.length,
    lineCount: text.length === 0 ? 0 : text.split(/\r?\n/).length,
    wordCount: countWords(text),
    tokenEstimate: Math.max(1, Math.ceil(countWords(text) * 1.33 + text.length / 4)),
  })

  const createRevision = (
    promptId: string,
    revisionNo: number,
    kind: PromptRevision['kind'],
    beforeBody: string | null,
    afterBody: string,
  ): PromptRevision => ({
    id: idFactory(),
    promptId,
    revisionNo,
    kind,
    beforeBody,
    afterBody,
    createdAt: clock(),
  })

  const commitPrompt = async (
    prompt: PromptDocument,
    revision: PromptRevision,
    beforeBody: string | null,
  ): Promise<PromptDocument> => {
    const latestRevision = await dependencies.repository.getRevision(prompt.id, prompt.version)

    if (latestRevision !== null && latestRevision.revisionNo > prompt.version) {
      await dependencies.repository.deleteRevisionsAfter(prompt.id, prompt.version)
    }

    await dependencies.repository.savePrompt(prompt)
    await dependencies.repository.appendRevision(revision)

    return { ...prompt, lastAutosavedAt: prompt.lastAutosavedAt, updatedAt: prompt.updatedAt }
  }

  const replaceText = (source: string, searchText: string, replaceText: string, replaceAll: boolean): string => {
    if (searchText.length === 0) {
      throw new Error('Search text is required')
    }

    return replaceAll ? source.split(searchText).join(replaceText) : source.replace(searchText, replaceText)
  }

  const searchMatches = (source: string, query: string): readonly PromptSearchMatch[] => {
    const normalizedQuery = query.trim()

    if (normalizedQuery.length === 0) {
      return []
    }

    const lowerSource = source.toLowerCase()
    const lowerQuery = normalizedQuery.toLowerCase()
    const matches: PromptSearchMatch[] = []
    let index = 0

    while (index >= 0) {
      index = lowerSource.indexOf(lowerQuery, index)

      if (index < 0) {
        break
      }

      matches.push({
        start: index,
        end: index + normalizedQuery.length,
        value: source.slice(index, index + normalizedQuery.length),
      })

      index += Math.max(1, normalizedQuery.length)
    }

    return matches
  }

  return {
    async createPrompt(projectId: string, title: string, body: string): Promise<PromptDocument> {
      const nextTitle = ensureTitle(title)
      const nextBody = ensureBody(body)

      return dependencies.repository.runInTransaction(async () => {
        const existing = await dependencies.repository.getPromptByProjectAndTitle(projectId, nextTitle)

        if (existing !== null) {
          throw new Error(`Prompt already exists: ${nextTitle}`)
        }

        const timestamp = clock()
        const prompt: PromptDocument = {
          id: idFactory(),
          projectId,
          title: nextTitle,
          body: nextBody,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          lastAutosavedAt: null,
          sourcePromptId: null,
        }

        await dependencies.repository.createPrompt(prompt)
        await dependencies.repository.appendRevision(createRevision(prompt.id, 1, 'create', null, nextBody))
        return prompt
      })
    },

    async editPrompt(input: PromptEditInput): Promise<PromptDocument> {
      const prompt = await ensurePrompt(input.promptId)
      const nextTitle = input.title !== undefined ? ensureTitle(input.title) : prompt.title
      const nextBody = input.body !== undefined ? ensureBody(input.body) : prompt.body

      return dependencies.repository.runInTransaction(async () => {
        if (nextTitle !== prompt.title) {
          const existing = await dependencies.repository.getPromptByProjectAndTitle(prompt.projectId, nextTitle)

          if (existing !== null && existing.id !== prompt.id) {
            throw new Error(`Prompt already exists: ${nextTitle}`)
          }
        }

        const latestRevision = await dependencies.repository.getRevision(prompt.id, prompt.version)
        const nextVersion = prompt.version + 1

        if (latestRevision !== null && latestRevision.revisionNo > prompt.version) {
          await dependencies.repository.deleteRevisionsAfter(prompt.id, prompt.version)
        }

        const updatedAt = clock()
        const updatedPrompt: PromptDocument = {
          ...prompt,
          title: nextTitle,
          body: nextBody,
          updatedAt,
          version: nextVersion,
        }

        await dependencies.repository.savePrompt(updatedPrompt)
        await dependencies.repository.appendRevision(createRevision(prompt.id, nextVersion, 'edit', prompt.body, nextBody))
        return updatedPrompt
      })
    },

    async replace(input: PromptReplaceInput): Promise<PromptDocument> {
      const prompt = await ensurePrompt(input.promptId)
      const nextBody = replaceText(prompt.body, input.searchText, input.replaceText, input.replaceAll === true)

      if (nextBody === prompt.body) {
        return prompt
      }

      return dependencies.repository.runInTransaction(async () => {
        const latestRevision = await dependencies.repository.getRevision(prompt.id, prompt.version)
        const nextVersion = prompt.version + 1

        if (latestRevision !== null && latestRevision.revisionNo > prompt.version) {
          await dependencies.repository.deleteRevisionsAfter(prompt.id, prompt.version)
        }

        const updatedPrompt: PromptDocument = {
          ...prompt,
          body: nextBody,
          updatedAt: clock(),
          version: nextVersion,
        }

        await dependencies.repository.savePrompt(updatedPrompt)
        await dependencies.repository.appendRevision(createRevision(prompt.id, nextVersion, 'replace', prompt.body, nextBody))
        return updatedPrompt
      })
    },

    async duplicatePrompt(promptId: string, title?: string): Promise<PromptDuplicateResult> {
      const prompt = await ensurePrompt(promptId)
      const nextTitle = title !== undefined ? ensureTitle(title) : `${prompt.title} Copy`

      return dependencies.repository.runInTransaction(async () => {
        const existing = await dependencies.repository.getPromptByProjectAndTitle(prompt.projectId, nextTitle)

        if (existing !== null) {
          throw new Error(`Prompt already exists: ${nextTitle}`)
        }

        const timestamp = clock()
        const duplicate: PromptDocument = {
          id: idFactory(),
          projectId: prompt.projectId,
          title: nextTitle,
          body: prompt.body,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          lastAutosavedAt: null,
          sourcePromptId: prompt.id,
        }

        const revision = createRevision(duplicate.id, 1, 'duplicate', null, duplicate.body)
        await dependencies.repository.createPrompt(duplicate)
        await dependencies.repository.appendRevision(revision)
        return { prompt: duplicate, revision }
      })
    },

    async deletePrompt(promptId: string): Promise<void> {
      const prompt = await ensurePrompt(promptId)
      await dependencies.repository.deletePrompt(prompt.id)
    },

    async searchPrompt(promptId: string, query: string): Promise<readonly PromptSearchMatch[]> {
      const prompt = await ensurePrompt(promptId)
      return searchMatches(prompt.body, query)
    },

    async getHistory(promptId: string): Promise<readonly PromptRevision[]> {
      return dependencies.repository.listRevisions(promptId)
    },

    async undo(promptId: string): Promise<PromptDocument> {
      const prompt = await ensurePrompt(promptId)

      if (prompt.version <= 1) {
        throw new Error('Nothing to undo')
      }

      const previousRevision = await dependencies.repository.getRevision(prompt.id, prompt.version - 1)
      if (previousRevision === null) {
        throw new Error('Undo history is unavailable')
      }

      const updatedPrompt: PromptDocument = {
        ...prompt,
        body: previousRevision.afterBody,
        updatedAt: clock(),
        version: prompt.version - 1,
      }

      await dependencies.repository.runInTransaction(async () => {
        await dependencies.repository.savePrompt(updatedPrompt)
      })

      return updatedPrompt
    },

    async redo(promptId: string): Promise<PromptDocument> {
      const prompt = await ensurePrompt(promptId)
      const nextRevision = await dependencies.repository.getRevision(prompt.id, prompt.version + 1)

      if (nextRevision === null) {
        throw new Error('Nothing to redo')
      }

      const updatedPrompt: PromptDocument = {
        ...prompt,
        body: nextRevision.afterBody,
        updatedAt: clock(),
        version: prompt.version + 1,
      }

      await dependencies.repository.runInTransaction(async () => {
        await dependencies.repository.savePrompt(updatedPrompt)
      })

      return updatedPrompt
    },

    calculateMetrics(text: string): PromptMetrics {
      return calculateMetrics(text)
    },

    async autosave(promptId: string, body: string): Promise<void> {
      const prompt = await ensurePrompt(promptId)
      const timestamp = clock()

      await dependencies.repository.runInTransaction(async () => {
        await dependencies.repository.saveAutosave(promptId, body, timestamp)
        await dependencies.repository.savePrompt({
          ...prompt,
          lastAutosavedAt: timestamp,
          updatedAt: timestamp,
        })
      })
    },

    async restoreAutosave(promptId: string): Promise<string | null> {
      await ensurePrompt(promptId)
      return dependencies.repository.restoreAutosave(promptId)
    },
  }
}