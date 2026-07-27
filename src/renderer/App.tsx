import { useEffect, useMemo, useState } from 'react'

import type { AppEnvironment } from '../shared/ipc/contracts'
import StoryboardPage from './pages/StoryboardPage'
import PromptEditorPage from './pages/PromptEditorPage'
import SettingsPage from './pages/SettingsPage'

type Route = 'storyboard' | 'prompt' | 'settings'

export function App(): JSX.Element {
  const [environment, setEnvironment] = useState<AppEnvironment | null>(null)
  const [route, setRoute] = useState<Route>('storyboard')
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).studioApi && typeof (window as any).studioApi.getEnvironment === 'function') {
      void (window as any).studioApi.getEnvironment().then(setEnvironment).catch(() => undefined)
    }
  }, [])

  const header = useMemo(() => {
    switch (route) {
      case 'storyboard': return { title: 'Storyboard', subtitle: 'Scene queue' }
      case 'prompt': return { title: 'Prompt editor', subtitle: 'Edit scene prompts' }
      case 'settings': return { title: 'Settings', subtitle: 'Application preferences' }
    }
  }, [route])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">VA</div>
          <div>
            <p className="eyebrow">Desktop workflow studio</p>
            <h1>Video Automation Studio</h1>
          </div>
        </div>

        <nav className="panel sidebar-panel">
          <p className="panel-label">Navigation</p>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            <button className="ghost-button" onClick={() => setRoute('storyboard')}>Storyboard</button>
            <button className="ghost-button" onClick={() => setRoute('prompt')}>Prompt editor</button>
            <button className="ghost-button" onClick={() => setRoute('settings')}>Settings</button>
          </div>
        </nav>

        <section className="panel sidebar-panel sidebar-panel--compact">
          <p className="panel-label">Runtime</p>
          <p className="runtime-value">{environment?.appVersion ?? 'Loading'}</p>
          <p className="runtime-subtitle">
            {environment ? `${environment.platform} · ${environment.electronVersion}` : 'Waiting'}
          </p>
        </section>
      </aside>

      <main className="workspace">
        <header className="hero panel">
          <div>
            <p className="eyebrow">{header.subtitle}</p>
            <h2>{header.title}</h2>
          </div>

          <div className="hero-meta">
            <div className="meta-card">
              <span className="meta-label">Scenes</span>
              <strong>—</strong>
            </div>
            <div className="meta-card">
              <span className="meta-label">Render mode</span>
              <strong>Sequential</strong>
            </div>
            <div className="meta-card">
              <span className="meta-label">Output</span>
              <strong>MP4</strong>
            </div>
          </div>
        </header>

        <section className="content-grid">
          {route === 'storyboard' && (
            <StoryboardPage onEditScene={(id) => { setEditingSceneId(id); setRoute('prompt') }} />
          )}

          {route === 'prompt' && (
            <PromptEditorPage sceneId={editingSceneId} onDone={() => setRoute('storyboard')} />
          )}

          {route === 'settings' && (
            <SettingsPage />
          )}
        </section>
      </main>
    </div>
  )
}