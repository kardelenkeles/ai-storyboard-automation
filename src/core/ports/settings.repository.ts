import type { Settings } from '../../shared/domain/settings'

export interface SettingsRepository {
  initialize(): Promise<void>
  load(): Promise<Settings>
  save(settings: Settings): Promise<void>
}

export default SettingsRepository
