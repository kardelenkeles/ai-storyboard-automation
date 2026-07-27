import EventEmitter from 'node:events'
import path from 'node:path'

import type { Settings, DEFAULT_SETTINGS } from '../../shared/domain/settings'
import { DEFAULT_SETTINGS as DEFAULTS } from '../../shared/domain/settings'
import type SettingsRepository from '../ports/settings.repository'

export interface SettingsService {
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  resetToDefaults(): Promise<Settings>
  on(event: 'changed', listener: (settings: Settings) => void): this
}

export function createSettingsService(repository: SettingsRepository): SettingsService {
  const emitter = new EventEmitter()

  type Mutable<T> = { -readonly [K in keyof T]: T[K] }

  const getSettings = async (): Promise<Settings> => {
    return repository.load()
  }

  const validate = (s: Partial<Settings>): Partial<Settings> => {
    const out: any = {}
    if (s.flowUrl !== undefined) out.flowUrl = String(s.flowUrl).trim()
    if (s.chromeProfilePath !== undefined) out.chromeProfilePath = s.chromeProfilePath === null ? null : String(s.chromeProfilePath)
    if (s.downloadFolder !== undefined) out.downloadFolder = String(s.downloadFolder)
    if (s.ffmpegPath !== undefined) out.ffmpegPath = s.ffmpegPath === null ? null : String(s.ffmpegPath)
    if (s.theme !== undefined) out.theme = (s.theme as any) ?? DEFAULTS.theme
    if (s.autosaveEnabled !== undefined) out.autosaveEnabled = Boolean(s.autosaveEnabled)
    if (s.autosaveIntervalMs !== undefined) out.autosaveIntervalMs = Number(s.autosaveIntervalMs) || DEFAULTS.autosaveIntervalMs
    if (s.rendering !== undefined) {
      out.rendering = {
        transitionDuration: Number(s.rendering.transitionDuration) || DEFAULTS.rendering.transitionDuration,
        fps: Number(s.rendering.fps) || DEFAULTS.rendering.fps,
        resolution: String(s.rendering.resolution) || DEFAULTS.rendering.resolution,
      }
    }
    if (s.sqliteLocation !== undefined) out.sqliteLocation = s.sqliteLocation === null ? null : String(s.sqliteLocation)
    return out
  }

  const updateSettings = async (patch: Partial<Settings>): Promise<Settings> => {
    const current = await repository.load()
    const valid = validate(patch)
    const next: Mutable<Settings> = { ...(current as Mutable<Settings>), ...(valid as Mutable<Settings>) }

    // normalize downloadFolder to absolute path if relative
    if (next.downloadFolder && !path.isAbsolute(next.downloadFolder)) {
      next.downloadFolder = path.resolve(process.cwd(), next.downloadFolder)
    }

    await repository.save(next as Settings)
    emitter.emit('changed', next)
    return next
  }

  const resetToDefaults = async (): Promise<Settings> => {
    await repository.save(DEFAULTS)
    emitter.emit('changed', DEFAULTS)
    return DEFAULTS
  }

  return Object.assign(emitter, { getSettings, updateSettings, resetToDefaults }) as unknown as SettingsService
}

export default createSettingsService
