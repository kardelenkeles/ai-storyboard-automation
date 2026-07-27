import { useEffect, useState } from 'react'

import type { AppEnvironment } from '../shared/ipc/contracts'

interface SceneCard {
  readonly title: string
  readonly prompt: string
  readonly status: 'Draft' | 'Ready' | 'Queued'
  readonly reference: string
}

const storyboardPreview: readonly SceneCard[] = [
  {
    title: 'Scene 01',
    prompt: 'An aerial sunrise reveal over a futuristic city skyline, cinematic and warm.',
    status: 'Ready',
    reference: 'No reference'
  },
  {
    title: 'Scene 02',
    prompt: 'A close-up of the lead character looking at a holographic map in a quiet alley.',
    status: 'Draft',
    reference: 'Uses Scene 01'
  },
  {
    title: 'Scene 03',
    prompt: 'The camera pulls back to reveal the full team preparing for launch.',
    status: 'Queued',
    reference: 'Uses Scene 02'
  }
]

export function App(): JSX.Element {
  const [environment, setEnvironment] = useState<AppEnvironment | null>(null)

  useEffect(() => {
    void window.studioApi.getEnvironment().then(setEnvironment)
  }, [])

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

        <section className="panel sidebar-panel">
          <p className="panel-label">Project</p>
          <h2>Blueprint session</h2>
          <p className="panel-copy">
            Paste your script, review the storyboard, and keep each scene linked to the frame that came before it.
          </p>
        </section>

        <section className="panel sidebar-panel sidebar-panel--compact">
          <p className="panel-label">Runtime</p>
          <p className="runtime-value">{environment?.appVersion ?? 'Loading environment'}</p>
          <p className="runtime-subtitle">
            {environment ? `${environment.platform} · ${environment.electronVersion}` : 'Waiting for preload bridge'}
          </p>
        </section>
      </aside>

      <main className="workspace">
        <header className="hero panel">
          <div>
            <p className="eyebrow">Storyboard-first automation</p>
            <h2>Build once, render sequentially, export a finished cut.</h2>
            <p className="hero-copy">
              The foundation is ready for project creation, prompt editing, Playwright-based Flow automation,
              SQLite persistence, and FFmpeg output.
            </p>
          </div>

          <div className="hero-meta">
            <div className="meta-card">
              <span className="meta-label">Scenes</span>
              <strong>3</strong>
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
          <article className="panel storyboard-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-label">Storyboard</p>
                <h3>Scene queue</h3>
              </div>
              <button className="ghost-button" type="button">Add scene</button>
            </div>

            <div className="storyboard-grid">
              {storyboardPreview.map((scene) => (
                <article className="scene-card" key={scene.title}>
                  <div className="scene-card__header">
                    <span>{scene.title}</span>
                    <span className={`status-pill status-pill--${scene.status.toLowerCase()}`}>{scene.status}</span>
                  </div>
                  <p className="scene-card__prompt">{scene.prompt}</p>
                  <div className="scene-card__footer">
                    <span>{scene.reference}</span>
                    <span>Edit before render</span>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="panel side-panel">
            <p className="panel-label">Workflow</p>
            <h3>Foundation checkpoints</h3>
            <ul className="checklist">
              <li>Electron shell and secure preload bridge</li>
              <li>Shared domain and IPC contracts</li>
              <li>Renderer shell with storyboard layout</li>
              <li>Build and packaging configuration</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  )
}