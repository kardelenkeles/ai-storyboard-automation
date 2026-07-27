export type Theme = 'light' | 'dark' | 'system'

export interface RenderingOptions {
  readonly transitionDuration: number
  readonly fps: number
  readonly resolution: string
}

export interface Settings {
  readonly chromeProfilePath: string | null
  readonly flowUrl: string
  readonly downloadFolder: string
  readonly ffmpegPath: string | null
  readonly theme: Theme
  readonly autosaveIntervalMs: number
  readonly rendering: RenderingOptions
  readonly sqliteLocation: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  chromeProfilePath: null,
  flowUrl: 'https://flow.google.com',
  downloadFolder: 'downloads',
  ffmpegPath: null,
  theme: 'system',
  autosaveIntervalMs: 30_000,
  rendering: { transitionDuration: 1.0, fps: 30, resolution: '1920x1080' },
  sqliteLocation: null,
}

export default Settings
