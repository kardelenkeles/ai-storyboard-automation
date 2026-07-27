export type Theme = 'light' | 'dark' | 'system'

export interface RenderingOptions {
  readonly transitionDuration: number
  readonly fps: number
  readonly resolution: string
}

export interface Settings {
  readonly chromeExecutablePath: string | null
  readonly chromeProfilePath: string | null
  readonly automation: {
    readonly delayBetweenActionsMs: number
    readonly retryCount: number
  }
  readonly flowUrl: string
  readonly downloadFolder: string
  readonly ffmpegPath: string | null
  readonly autosaveEnabled: boolean
  readonly theme: Theme
  readonly autosaveIntervalMs: number
  readonly rendering: RenderingOptions
  readonly sqliteLocation: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  chromeExecutablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  chromeProfilePath: null,
  automation: { delayBetweenActionsMs: 2000, retryCount: 3 },
  flowUrl: 'https://labs.google/fx/tools/flow',
  downloadFolder: 'downloads',
  ffmpegPath: null,
  theme: 'system',
  autosaveEnabled: true,
  autosaveIntervalMs: 30_000,
  rendering: { transitionDuration: 1.0, fps: 30, resolution: '1920x1080' },
  sqliteLocation: null,
}

export default Settings
