export interface AppEnvironment {
  readonly platform: string
  readonly arch: string
  readonly appVersion: string
  readonly electronVersion: string
  readonly chromeVersion: string
  readonly nodeVersion: string
  readonly isPackaged: boolean
}

export interface StudioApi {
  getEnvironment(): Promise<AppEnvironment>
}