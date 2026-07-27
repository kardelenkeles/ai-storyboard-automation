import type { Scene } from '../../shared/domain/project'

export interface FlowRenderRequest {
  readonly scene: Scene
  readonly chromeProfilePath: string
}

export interface FlowAutomationPort {
  initialize(): Promise<void>
  renderScene(request: FlowRenderRequest): Promise<{ readonly imagePath: string }>
}