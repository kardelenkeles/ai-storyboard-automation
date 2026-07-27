import React, { useEffect, useState } from 'react'
import type { SettingsDto } from '../../shared/ipc/contracts'

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<Partial<SettingsDto>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const api = (window as any).studioApi
      if (!api) {
        setError('Desktop bridge is not available. Start the app with Electron.')
        return
      }

      try {
        const loaded = await api.getSettings()
        setSettings(loaded)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load settings')
      }
    }

    void load()
  }, [])

  const update = (patch: Partial<SettingsDto>) => setSettings((s) => ({ ...(s ?? {}), ...patch }))

  const save = async (): Promise<void> => {
    const api = (window as any).studioApi
    if (!api) {
      setError('Desktop bridge is not available. Start the app with Electron.')
      return
    }

    try {
      const saved = await api.updateSettings(settings)
      setSettings(saved)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings')
    }
  }

  const reload = async (): Promise<void> => {
    const api = (window as any).studioApi
    if (!api) {
      setError('Desktop bridge is not available. Start the app with Electron.')
      return
    }

    try {
      const loaded = await api.getSettings()
      setSettings(loaded)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reload settings')
    }
  }

  return (
    <article className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <p className="panel-label">Settings</p>
          <h3>Application preferences</h3>
        </div>
      </div>

      {error && <p style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Flow URL</div>
          <input value={settings.flowUrl ?? ''} onChange={(e) => update({ flowUrl: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }} />
        </label>

        <label>
          <div style={{ color: 'var(--muted)', marginBottom: 6 }}>Download folder</div>
          <input value={settings.downloadFolder ?? ''} onChange={(e) => update({ downloadFolder: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }} />
        </label>

        <label>
          <div style={{ color: 'var(--muted)', marginBottom: 6 }}>FFmpeg path</div>
          <input value={settings.ffmpegPath ?? ''} onChange={(e) => update({ ffmpegPath: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 8 }} />
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="ghost-button" onClick={() => void reload()}>Reload</button>
          <button className="ghost-button" onClick={() => void save()}>Save</button>
        </div>
      </div>
    </article>
  )
}
