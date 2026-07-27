import React, { useEffect, useState } from 'react'
import type { Settings } from '../../shared/domain/settings'

const SETTINGS_KEY = 'vas:settings'

function loadLocalSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Settings
  } catch {
    return null
  }
}

function saveLocalSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<Partial<Settings>>({})

  useEffect(() => {
    const local = loadLocalSettings()
    if (local) setSettings(local)
    else setSettings({})
  }, [])

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...(s ?? {}), ...patch }))

  return (
    <article className="panel" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <p className="panel-label">Settings</p>
          <h3>Application preferences</h3>
        </div>
      </div>

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
          <button className="ghost-button" onClick={() => { const s = loadLocalSettings() ?? {}; saveLocalSettings(s as Settings) }}>Reload</button>
          <button className="ghost-button" onClick={() => { saveLocalSettings(settings as Settings) }}>Save</button>
        </div>
      </div>
    </article>
  )
}
