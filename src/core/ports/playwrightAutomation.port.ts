export interface PlaywrightAutomationOptions {
  /** URL of the Flow web app to open */
  flowUrl?: string
  /** Optional CSS selector for the prompt input element inside Flow */
  inputSelector?: string
  /** Optional CSS selector for the send button inside Flow */
  sendButtonSelector?: string
  /** Optional CSS selector that indicates Flow finished processing */
  finishedSelector?: string
}

export interface PlaywrightAutomation {
  start(opts?: { userDataDir?: string; executablePath?: string; cdpEndpoint?: string } & PlaywrightAutomationOptions): Promise<void>
  stop(): Promise<void>
  openFlow(): Promise<void>
  sendPrompt(text: string): Promise<void>
  downloadImage(selector: string, destPath: string): Promise<void>
  waitUntilFinished(timeoutMs?: number): Promise<void>
}

export default PlaywrightAutomation
