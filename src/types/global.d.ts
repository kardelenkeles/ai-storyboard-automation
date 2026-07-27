import type { StudioApi } from '../shared/ipc/contracts'

declare global {
  interface Window {
    studioApi: StudioApi
  }
}

export {}