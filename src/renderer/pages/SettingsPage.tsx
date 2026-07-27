import React, { useEffect, useState } from 'react'
import type { SettingsDto } from '../../shared/ipc/contracts'
import { DEFAULT_SETTINGS } from '../../shared/domain/settings'

function FieldLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ color: 'var(--muted)', marginBottom: 8, ...(style ?? {}) }}>{children}</div>
}

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<Partial<SettingsDto>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const api = (window as any).studioApi
      if (!api) return
      try {
        const loaded = await api.getSettings()
        setSettings(loaded)
      } catch {
        setStatus('Failed to load settings')
      }
    }
    void load()
  }, [])

  const update = (patch: Partial<SettingsDto>) => setSettings((s) => ({ ...(s ?? {}), ...patch }))

  const validatePath = async (key: string, p: string | null) => {
    const api = (window as any).studioApi
    if (!api || !p) return true
    try {
      const ok = await api.validatePath(p)
      setErrors((e) => ({ ...e, [key]: ok ? '' : 'Path does not exist' }))
      return ok
    } catch {
      setErrors((e) => ({ ...e, [key]: 'Validation failed' }))
      return false
    }
  }

  const browseFile = async (key: string, opts?: any) => {
    const api = (window as any).studioApi
    if (!api) return
    const p = await api.openFileDialog(opts)
    if (p) {
      update({ [key]: p } as Partial<SettingsDto>)
      void validatePath(key, p)
    }
  }

  const browseFolder = async (key: string, opts?: any) => {
    const api = (window as any).studioApi
    if (!api) return
    const p = await api.openFolderDialog(opts)
    if (p) {
      update({ [key]: p } as Partial<SettingsDto>)
      void validatePath(key, p)
    }
  }

  const save = async () => {
    const api = (window as any).studioApi
    if (!api) {
      setStatus('Desktop bridge not available')
      return
    }
    setStatus('Saving...')
    try {
      const saved = await api.updateSettings(settings)
      setSettings(saved)
      setStatus('Saved')
      setTimeout(() => setStatus(null), 1500)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  const resetToDefaults = async () => {
    const api = (window as any).studioApi
    if (!api) return
    // use shared DEFAULT_SETTINGS as source of truth
    const defaults = DEFAULT_SETTINGS as unknown as SettingsDto
    try {
      const saved = await api.updateSettings(defaults)
      setSettings(saved)
      setStatus('Reset to defaults')
      setTimeout(() => setStatus(null), 1500)
    } catch {
      setStatus('Failed to reset')
    }
  }

  const leftNav = (
    <div className="panel sidebar-panel sidebar-panel--compact panel" style={{ padding: 18 }}>
      <div className="panel-label">Settings</div>
      <h3>Preferences</h3>
      <div style={{ height: 12 }} />
      <nav style={{ display: 'grid', gap: 8 }}>
        <button className="ghost-button">Browser</button>
        <button className="ghost-button">Automation</button>
        <button className="ghost-button">Video</button>
        <button className="ghost-button">Application</button>
      </nav>
    </div>
  )

  const rightPanel = (
    <aside className="panel side-panel" style={{ padding: 18 }}>
      <div className="panel-label">Actions</div>
      <h3>Save & Defaults</h3>
      <div style={{ height: 12 }} />
      <div style={{ display: 'grid', gap: 8 }}>
        <button className="ghost-button" onClick={() => void save()}>Save</button>
        <button className="ghost-button" onClick={() => void resetToDefaults()}>Reset to Defaults</button>
        <div style={{ height: 12 }} />
        {status && <div style={{ color: 'var(--accent)', marginTop: 8 }}>{status}</div>}
      </div>
    </aside>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 320px', gap: 20 }}>
      {leftNav}

      <main className="panel" style={{ padding: 20 }}>
        <div className="panel-heading">
          <div>
            <div className="panel-label">Browser Settings</div>
            <h3>Chrome</h3>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <label>
            <FieldLabel>Chrome Executable Path</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={settings.chromeExecutablePath ?? DEFAULT_SETTINGS.chromeExecutablePath ?? ''} onChange={(e) => update({ chromeExecutablePath: e.target.value })} onBlur={(e) => void validatePath('chromeExecutablePath', e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8 }} />
              <button className="ghost-button" onClick={() => void browseFile('chromeExecutablePath', { title: 'Select Chrome Executable' })}>Browse</button>
            </div>
            {errors.chromeExecutablePath && <div style={{ color: '#fca5a5' }}>{errors.chromeExecutablePath}</div>}
          </label>

          <label>
            <FieldLabel>Chrome Profile Path</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={settings.chromeProfilePath ?? ''} onChange={(e) => update({ chromeProfilePath: e.target.value })} onBlur={(e) => void validatePath('chromeProfilePath', e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8 }} />
              <button className="ghost-button" onClick={() => void browseFolder('chromeProfilePath', { title: 'Select Chrome Profile Folder' })}>Browse</button>
            </div>
            {errors.chromeProfilePath && <div style={{ color: '#fca5a5' }}>{errors.chromeProfilePath}</div>}
          </label>

          <hr />

          <div>
            <div className="panel-label">Automation Settings</div>
            <h3>Flow & Timing</h3>
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              <label>
                <FieldLabel>Flow URL</FieldLabel>
                <input value={settings.flowUrl ?? DEFAULT_SETTINGS.flowUrl} onChange={(e) => update({ flowUrl: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8 }} />
              </label>

              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ flex: 1 }}>
                  <FieldLabel>Delay Between Actions (ms)</FieldLabel>
                  <input type="number" value={settings.automation?.delayBetweenActionsMs ?? DEFAULT_SETTINGS.automation.delayBetweenActionsMs} onChange={(e) => update({ automation: { ...(settings.automation as any), delayBetweenActionsMs: Number(e.target.value) } } as Partial<SettingsDto>)} style={{ width: '100%', padding: 10, borderRadius: 8 }} />
                </label>

                <label style={{ width: 160 }}>
                  <FieldLabel>Retry Count</FieldLabel>
                  <input type="number" value={settings.automation?.retryCount ?? DEFAULT_SETTINGS.automation.retryCount} onChange={(e) => update({ automation: { ...(settings.automation as any), retryCount: Number(e.target.value) } } as Partial<SettingsDto>)} style={{ width: '100%', padding: 10, borderRadius: 8 }} />
                </label>
              </div>
            </div>
          </div>

          <hr />

          <div>
            <div className="panel-label">Video Settings</div>
            <h3>FFmpeg & Files</h3>
            <label>
              <FieldLabel>FFmpeg Path</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={settings.ffmpegPath ?? ''} onChange={(e) => update({ ffmpegPath: e.target.value })} onBlur={(e) => void validatePath('ffmpegPath', e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8 }} />
                <button className="ghost-button" onClick={() => void browseFile('ffmpegPath', { title: 'Select FFmpeg executable' })}>Browse</button>
              </div>
              {errors.ffmpegPath && <div style={{ color: '#fca5a5' }}>{errors.ffmpegPath}</div>}
            </label>

            <label>
              <FieldLabel>Download Folder</FieldLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={settings.downloadFolder ?? DEFAULT_SETTINGS.downloadFolder} onChange={(e) => update({ downloadFolder: e.target.value })} onBlur={(e) => void validatePath('downloadFolder', e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8 }} />
                <button className="ghost-button" onClick={() => void browseFolder('downloadFolder', { title: 'Select download folder' })}>Browse</button>
              </div>
              {errors.downloadFolder && <div style={{ color: '#fca5a5' }}>{errors.downloadFolder}</div>}
            </label>
          </div>

          <hr />

          <div>
            <div className="panel-label">Application Settings</div>
            <h3>Appearance & Autosave</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <label style={{ flex: 1 }}>
                <FieldLabel>Theme</FieldLabel>
                <select value={settings.theme ?? DEFAULT_SETTINGS.theme} onChange={(e) => update({ theme: (e.target.value as any) })} style={{ width: '100%', padding: 10, borderRadius: 8 }}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="system">System</option>
                </select>
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', width: 200 }}>
                <FieldLabel style={{ marginBottom: 6 }}>Autosave</FieldLabel>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={Boolean(settings.autosaveEnabled ?? DEFAULT_SETTINGS.autosaveEnabled)} onChange={(e) => update({ autosaveEnabled: e.target.checked } as Partial<SettingsDto>)} />
                    <span style={{ color: 'var(--muted)' }}>Enabled</span>
                  </label>
                </div>
                <div style={{ height: 8 }} />
                <label>
                  <FieldLabel>Autosave Interval (ms)</FieldLabel>
                  <input type="number" value={settings.autosaveIntervalMs ?? DEFAULT_SETTINGS.autosaveIntervalMs} onChange={(e) => update({ autosaveIntervalMs: Number(e.target.value) })} style={{ width: '100%', padding: 8, borderRadius: 8 }} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </main>

      {rightPanel}
    </div>
  )
}
