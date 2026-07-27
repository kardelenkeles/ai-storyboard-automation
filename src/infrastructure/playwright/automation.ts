import fs from 'fs'
import path from 'path'
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import type { PlaywrightAutomation, PlaywrightAutomationOptions } from '../../core/ports/playwrightAutomation.port'

type StartOpts = { userDataDir?: string; executablePath?: string; cdpEndpoint?: string } & PlaywrightAutomationOptions

export class PlaywrightAutomationImpl implements PlaywrightAutomation {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private connectedExternally = false
  private opts: PlaywrightAutomationOptions = {}

  constructor(private readonly defaultFlowUrl = 'https://flow.google.com') {}

  async start(opts?: StartOpts): Promise<void> {
    this.opts = { flowUrl: opts?.flowUrl ?? this.defaultFlowUrl, inputSelector: opts?.inputSelector, sendButtonSelector: opts?.sendButtonSelector, finishedSelector: opts?.finishedSelector }

    // Try connect to existing Chrome via CDP (reuses running browser)
    if (opts?.cdpEndpoint) {
      try {
        this.browser = await chromium.connectOverCDP(opts.cdpEndpoint)
        this.connectedExternally = true
        // prefer existing context
        const contexts = this.browser.contexts()
        this.context = contexts.length > 0 ? contexts[0] : await this.browser.newContext()
      } catch (e) {
        // ignore and fallthrough to launching with profile
        this.browser = null
      }
    }

    if (!this.browser) {
      // Launch (or reuse) persistent context with provided userDataDir so Chrome profile is used
      const userDataDir = opts?.userDataDir
      if (!userDataDir) throw new Error('PlaywrightAutomation.start: either cdpEndpoint or userDataDir must be provided to use an existing Chrome profile')

      this.context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        executablePath: opts?.executablePath,
      })
      this.browser = this.context.browser()
      this.connectedExternally = false
    }

    // find or create the Flow page
    await this.findOrCreateFlowPage()
  }

  private async findOrCreateFlowPage(): Promise<void> {
    const flowUrl = this.opts.flowUrl ?? this.defaultFlowUrl
    // search all pages
    const pages = this.context ? this.context.pages() : this.browser?.contexts()[0].pages() ?? []
    let found: Page | undefined
    for (const p of pages) {
      try {
        const url = p.url()
        if (url && url.includes(flowUrl)) { found = p; break }
        const title = await p.title()
        if (title && title.toLowerCase().includes('flow')) { found = p; break }
      } catch (e) {
        // ignore cross-origin or closed pages
      }
    }

    if (found) {
      this.page = found
      try { await this.page.bringToFront() } catch {}
      return
    }

    // open new page in available context
    const ctx = this.context ?? this.browser!.contexts()[0]
    this.page = await ctx.newPage()
    await this.page.goto(flowUrl)
  }

  async openFlow(): Promise<void> {
    if (!this.page) await this.findOrCreateFlowPage()
    else {
      try { await this.page.bringToFront() } catch {}
    }
  }

  async sendPrompt(text: string): Promise<void> {
    if (!this.page) throw new Error('Flow page not open')
    const inputSelector = this.opts.inputSelector ?? 'textarea, [contenteditable="true"]'
    const sendButton = this.opts.sendButtonSelector

    // find input
    const handle = await this.page.waitForSelector(inputSelector, { timeout: 5000 })
    if (!handle) throw new Error('Prompt input not found')
    await handle.fill('')
    await handle.type(text, { delay: 20 })

    if (sendButton) {
      const btn = await this.page.$(sendButton)
      if (!btn) throw new Error('Send button selector provided but element not found')
      await btn.click()
    } else {
      // press Enter
      await handle.press('Enter')
    }
  }

  async downloadImage(selector: string, destPath: string): Promise<void> {
    if (!this.page) throw new Error('Flow page not open')
    const el = await this.page.waitForSelector(selector, { timeout: 10000 })
    if (!el) throw new Error('Image element not found')
    const src = await el.getAttribute('src')
    if (!src) throw new Error('Image has no src attribute')

    if (src.startsWith('data:')) {
      const comma = src.indexOf(',')
      const meta = src.substring(5, comma)
      const data = src.substring(comma + 1)
      const buffer = meta.includes('base64') ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data))
      await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
      await fs.promises.writeFile(destPath, buffer)
      return
    }

    // otherwise fetch via page context
    const res = await this.page.request.get(src)
    if (!res.ok()) throw new Error(`Failed to fetch image: ${res.status()}`)
    const buffer = await res.body()
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
    await fs.promises.writeFile(destPath, buffer)
  }

  async waitUntilFinished(timeoutMs = 120_000): Promise<void> {
    if (!this.page) throw new Error('Flow page not open')
    if (!this.opts.finishedSelector) {
      // fallback: wait for network idle
      await this.page.waitForLoadState('networkidle', { timeout: timeoutMs })
      return
    }
    await this.page.waitForSelector(this.opts.finishedSelector, { timeout: timeoutMs })
  }

  async stop(): Promise<void> {
    try {
      if (this.page) {
        try { await this.page.close() } catch {}
        this.page = null
      }
      if (this.context) {
        if (!this.connectedExternally) {
          try { await this.context.close() } catch {}
        }
        this.context = null
      }
      if (this.browser && !this.connectedExternally) {
        try { await this.browser.close() } catch {}
      }
      this.browser = null
    } finally {
      // noop
    }
  }
}

export default PlaywrightAutomationImpl
