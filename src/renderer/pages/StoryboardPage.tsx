import React, { useEffect, useState } from 'react'
import type { StorySceneDto } from '../../shared/ipc/contracts'

const PROJECT_ID = 'default-project'

function statusLabel(status: string): 'Draft' | 'Ready' | 'Queued' {
  if (status === 'ready') return 'Ready'
  if (status === 'queued') return 'Queued'
  return 'Draft'
}

export default function StoryboardPage(props: { onEditScene: (id: string) => void }): JSX.Element {
  const [scenes, setScenes] = useState<readonly StorySceneDto[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    const api = (window as any).studioApi
    if (!api) {
      setError('Desktop bridge is not available. Start the app with Electron.')
      return
    }

    try {
      const board = await api.getStoryboard(PROJECT_ID)
      setScenes(board.scenes)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load storyboard')
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const onAdd = async (): Promise<void> => {
    const api = (window as any).studioApi
    if (!api) {
      setError('Desktop bridge is not available. Start the app with Electron.')
      return
    }

    try {
      await api.createScene(PROJECT_ID, {
        title: `Scene ${String(scenes.length + 1).padStart(2, '0')}`,
        prompt: 'Describe the shot...',
        duration: 4,
      })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create scene')
    }
  }

  const onDelete = async (sceneId: string): Promise<void> => {
    const api = (window as any).studioApi
    if (!api) {
      setError('Desktop bridge is not available. Start the app with Electron.')
      return
    }

    try {
      await api.deleteScene(PROJECT_ID, sceneId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete scene')
    }
  }

  return (
    <>
      <article className="panel storyboard-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-label">Storyboard</p>
            <h3>Scene queue</h3>
          </div>
          <button className="ghost-button" type="button" onClick={() => void onAdd()}>Add scene</button>
        </div>

        {error && <p style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</p>}

        <div className="storyboard-grid">
          {scenes.map((scene) => {
            const label = statusLabel(scene.status)
            return (
            <article className="scene-card" key={scene.id}>
              <div className="scene-card__header">
                <span>{scene.title}</span>
                <span className={`status-pill status-pill--${label.toLowerCase()}`}>{label}</span>
              </div>
              <p className="scene-card__prompt">{scene.prompt}</p>
              <div className="scene-card__footer">
                <span>{scene.referenceSceneId ? `Uses ${scene.referenceSceneId}` : 'No reference'}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ghost-button" onClick={() => props.onEditScene(scene.id)}>Edit</button>
                  <button className="ghost-button" onClick={() => void onDelete(scene.id)}>Delete</button>
                </div>
              </div>
            </article>
          )})}
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
    </>
  )
}
