import fsp from 'node:fs/promises'
import path from 'node:path'

import type { Settings } from '../../shared/domain/settings'
import { DEFAULT_SETTINGS } from '../../shared/domain/settings'
import type SettingsRepository from '../../core/ports/settings.repository'

export class FileSettingsRepository implements SettingsRepository {
  private filePath: string

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(process.cwd(), 'settings.json')
  }

  async initialize(): Promise<void> {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      await fsp.access(this.filePath)
    } catch {
      await this.save(DEFAULT_SETTINGS)
    }
  }

  async load(): Promise<Settings> {
    try {
      const raw = await fsp.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<Settings>
      return { ...DEFAULT_SETTINGS, ...(parsed ?? {}) }
    } catch {
      return DEFAULT_SETTINGS
    }
  }

  async save(settings: Settings): Promise<void> {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true })
    await fsp.writeFile(this.filePath, JSON.stringify(settings, null, 2) + '\n', 'utf8')
  }
}

export default FileSettingsRepository
